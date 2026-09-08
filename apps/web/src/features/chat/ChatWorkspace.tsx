import * as Dialog from '@radix-ui/react-dialog';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, LoaderCircle, Pencil, Send, Sparkles, Square, X } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { conversationsService } from '@/services/conversations.service';
import { documentsService } from '@/services/documents.service';
import type { ChatMessage, Citation } from '@/types/api';
import { NEW_CONVERSATION_ID, readDraftDocumentIds } from '@/lib/chat-route';
import ConversationHistory from './ConversationHistory';
import MarkdownAnswer from './MarkdownAnswer';
import PdfViewer from '../documents/PdfViewer';

function Answer({ message, onCitation, onFollowUp, onRetry }: { message: ChatMessage; onCitation(citation: Citation): void; onFollowUp(question: string): void; onRetry(message: ChatMessage): void }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1600); }
  return <article className="group max-w-3xl rounded-2xl border border-ink/10 bg-paper px-5 py-4 text-sm text-ink shadow-card">
    {message.status === 'FAILED' || message.status === 'CANCELLED' ? <div className="flex items-center justify-between gap-3"><p className="text-ink-muted">{message.content || 'The answer was stopped before it could finish.'}</p><button type="button" className="text-button" onClick={() => onRetry(message)}>Retry</button></div> : <>
      <MarkdownAnswer content={message.content} citations={message.citations} onCitation={onCitation} />
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3"><button type="button" className="message-action" onClick={() => void copy()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button>{message.followUpActions?.map((action) => <button key={action.label} type="button" className="follow-up" onClick={() => onFollowUp(action.question)}>{action.label}</button>)}</div>
    </>}
  </article>;
}

function RenameDialog({ title, onRename }: { title: string; onRename(title: string): Promise<void> }) {
  const [open, setOpen] = useState(false); const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);
  return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger asChild><button type="button" className="icon-button" aria-label="Rename conversation"><Pencil size={16} /></button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-paper p-6 shadow-paper focus:outline-none"><div className="flex items-center justify-between"><Dialog.Title className="font-display text-2xl text-ink">Rename conversation</Dialog.Title><Dialog.Close asChild><button className="icon-button" aria-label="Close"><X size={16} /></button></Dialog.Close></div><form className="mt-5" onSubmit={(event) => { event.preventDefault(); void onRename(value.trim()).then(() => setOpen(false)); }}><input autoFocus value={value} maxLength={120} onChange={(event) => setValue(event.target.value)} className="field" aria-label="Conversation title" /><div className="mt-5 flex justify-end gap-2"><Dialog.Close asChild><button type="button" className="secondary-button">Cancel</button></Dialog.Close><button disabled={!value.trim()} className="primary-button">Save title</button></div></form></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export default function ChatWorkspace() {
  const { conversationId = '' } = useParams(); const navigate = useNavigate(); const [searchParams] = useSearchParams(); const queryClient = useQueryClient();
  const isDraft = conversationId === NEW_CONVERSATION_ID;
  const routeDocumentIds = useMemo(() => readDraftDocumentIds(new URLSearchParams({ documents: searchParams.get('documents') ?? '' })), [searchParams]);
  const conversation = useQuery({ queryKey: ['conversation', conversationId], queryFn: () => conversationsService.get(conversationId), enabled: Boolean(conversationId) && !isDraft, placeholderData: (previous) => previous });
  const matches = !isDraft && conversation.data?.conversation.id === conversationId;
  const contextDocuments = useQuery({ queryKey: ['documents'], queryFn: documentsService.list, enabled: isDraft || !matches });
  const [question, setQuestion] = useState(''); const [pendingQuestion, setPendingQuestion] = useState(''); const [streamingAnswer, setStreamingAnswer] = useState(''); const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'document' | 'chat'>('chat'); const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null); const [viewerPage, setViewerPage] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null); const activeRequest = useRef<AbortController | null>(null);
  const messages = matches ? conversation.data?.conversation.messages ?? [] : [];
  const selectedDocuments = useMemo(() => matches ? conversation.data?.conversation.documents ?? [] : (contextDocuments.data?.documents ?? []).filter((document) => routeDocumentIds.includes(document.id) && document.status === 'READY').map((document) => ({ document: { id: document.id, originalName: document.originalName, status: document.status } })), [contextDocuments.data, conversation.data, matches, routeDocumentIds]);
  const documentIds = selectedDocuments.map(({ document }) => document.id);
  const activeDocument = selectedCitation?.documentId ? selectedDocuments.find(({ document }) => document.id === selectedCitation.documentId)?.document : selectedDocuments[0]?.document;

  useEffect(() => { const node = scroller.current; if (node) node.scrollTo({ top: node.scrollHeight, behavior: streamingAnswer ? 'auto' : 'smooth' }); }, [messages.length, pendingQuestion, streamingAnswer]);
  useEffect(() => () => activeRequest.current?.abort(), []);
  useEffect(() => { activeRequest.current?.abort(); activeRequest.current = null; setQuestion(''); setPendingQuestion(''); setStreamingAnswer(''); setSending(false); setSelectedCitation(null); }, [conversationId]);

  function openCitation(citation: Citation) { setSelectedCitation(citation); setViewerPage(citation.pageStart); setActiveTab('document'); }
  async function send(text: string, retryMessageId?: string) {
    if (!text || sending) return;
    const controller = new AbortController(); activeRequest.current = controller; setQuestion(''); setPendingQuestion(text); setStreamingAnswer(''); setSending(true);
    try {
      let activeId = conversationId;
      if (isDraft) { const created = await conversationsService.create(documentIds); activeId = created.conversation.id; }
      await conversationsService.streamMessage(activeId, text, { onChunk: (chunk) => setStreamingAnswer((value) => value + chunk), onDone: () => undefined }, { requestId: crypto.randomUUID(), retryMessageId }, controller.signal);
      await queryClient.invalidateQueries({ queryKey: ['conversation', activeId] }); await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (isDraft) navigate(`/chat/${activeId}`, { replace: true });
    } catch (error) { if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : 'Could not generate an answer.'); }
    finally { if (activeRequest.current === controller) activeRequest.current = null; setPendingQuestion(''); setStreamingAnswer(''); setSending(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(question.trim()); }
  async function rename(title: string) { if (!matches) return; try { await conversationsService.rename(conversationId, title); await queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] }); await queryClient.invalidateQueries({ queryKey: ['conversations'] }); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not rename the conversation.'); } }

  const loading = (isDraft && contextDocuments.isLoading) || (!isDraft && !matches && !conversation.isError); const invalidDraft = isDraft && !contextDocuments.isLoading && (routeDocumentIds.length === 0 || selectedDocuments.length !== routeDocumentIds.length); const unavailable = !isDraft && conversation.isError && !matches; const title = isDraft ? 'New conversation' : matches ? conversation.data!.conversation.title : 'Loading conversation…'; const selectionUrl = `/?documents=${encodeURIComponent([...documentIds].sort().join(','))}`;
  return <main className="grid h-screen overflow-hidden bg-canvas lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(360px,0.9fr)_minmax(430px,1.1fr)]">
    <ConversationHistory currentConversationId={isDraft ? undefined : conversationId} documentIds={documentIds} />
    <section className={`min-h-0 overflow-hidden border-r border-ink/10 bg-paper ${activeTab === 'document' ? 'block' : 'hidden'} xl:block`}><PdfViewer documentId={activeDocument?.id} documentName={activeDocument?.originalName} page={viewerPage} onPageChange={setViewerPage} /></section>
    <section className={`min-h-0 flex-col overflow-hidden bg-canvas ${activeTab === 'chat' ? 'flex' : 'hidden'} xl:flex`}>
      <header className="flex shrink-0 items-center gap-3 border-b border-ink/10 bg-paper px-4 py-3"><Link to={selectionUrl} className="icon-button"><ArrowLeft size={18} /></Link><div className="min-w-0 flex-1"><h1 className="truncate font-display text-xl text-ink">{title}</h1><p className="text-xs text-ink-muted">{selectedDocuments.length} source{selectedDocuments.length === 1 ? '' : 's'} selected</p></div>{matches && <RenameDialog title={title} onRename={rename} />}</header>
      <div className="flex shrink-0 border-b border-ink/10 bg-paper xl:hidden"><button className={`tab-button ${activeTab === 'document' ? 'tab-button-active' : ''}`} onClick={() => setActiveTab('document')}>Document</button><button className={`tab-button ${activeTab === 'chat' ? 'tab-button-active' : ''}`} onClick={() => setActiveTab('chat')}>Chat</button></div>
      {loading ? <div className="grid flex-1 place-items-center text-ink-muted"><LoaderCircle className="animate-spin text-violet-600" /></div> : invalidDraft || unavailable ? <div className="grid flex-1 place-items-center p-8 text-center text-sm text-red-700"><div><p>{invalidDraft ? 'The selected PDFs are unavailable.' : 'Conversation could not be loaded.'}</p><Link to="/" className="mt-3 inline-block text-violet-700">Return to documents</Link></div></div> : <>
        <div ref={scroller} className="scrollbar-hidden flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-7">
          {messages.length === 0 && !pendingQuestion && <div className="m-auto max-w-md text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles size={22} /></span><h2 className="mt-5 font-display text-3xl text-ink">Ask what matters.</h2><p className="mt-2 text-sm leading-6 text-ink-muted">DocuMind answers from your selected sources, then takes you to the supporting page.</p></div>}
          {messages.map((message) => message.role === 'USER' ? <article key={message.id} className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-violet-700 px-4 py-3 text-sm text-white shadow-sm">{message.content}</article> : <Answer key={message.id} message={message} onCitation={openCitation} onFollowUp={(text) => void send(text)} onRetry={(message) => { const previous = messages[messages.findIndex((item) => item.id === message.id) - 1]; void send(previous?.content ?? '', message.id); }} />)}
          {pendingQuestion && <article className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-violet-700 px-4 py-3 text-sm text-white">{pendingQuestion}</article>}
          {sending && <article className="max-w-3xl rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm text-ink">{streamingAnswer ? <MarkdownAnswer content={streamingAnswer} /> : <p className="flex items-center gap-2 text-ink-muted"><span className="loading-dot" />Finding evidence…</p>}</article>}
        </div>
        <form onSubmit={submit} className="shrink-0 border-t border-ink/10 bg-paper p-4"><div className="mx-auto flex max-w-3xl items-end gap-3"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={2} maxLength={4000} placeholder="Ask about your sources…" className="field min-h-14 flex-1 resize-none" />{sending ? <button type="button" className="stop-button" onClick={() => activeRequest.current?.abort()} aria-label="Stop generation"><Square size={16} fill="currentColor" /></button> : <button disabled={!question.trim()} className="send-button" aria-label="Send question"><Send size={18} /></button>}</div></form>
      </>}
    </section>
  </main>;
}
