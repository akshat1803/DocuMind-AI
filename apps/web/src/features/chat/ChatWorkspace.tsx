import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Send, Sparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { conversationsService } from '@/services/conversations.service';
import type { ChatMessage, Citation } from '@/types/api';
import ConversationHistory from './ConversationHistory';

function CitedAnswer({ message, onCitation }: { message: ChatMessage; onCitation(citation: Citation): void }) {
  const citations = new Map(message.citations.map((citation) => [citation.citationNumber, citation]));
  const parts = message.content.split(/(\[\d+\])/g);
  return <p className="whitespace-pre-wrap leading-7">{parts.map((part, index) => {
    const number = /^\[(\d+)\]$/.exec(part)?.[1];
    const citation = number ? citations.get(Number(number)) : undefined;
    return citation ? <button key={`${part}-${index}`} onClick={() => onCitation(citation)} className="mx-0.5 rounded bg-sky-100 px-1 font-semibold text-sky-800 hover:bg-sky-200">{part}</button> : part;
  })}</p>;
}

export default function ChatWorkspace() {
  const { conversationId = '' } = useParams();
  const queryClient = useQueryClient();
  const conversation = useQuery({ queryKey: ['conversation', conversationId], queryFn: () => conversationsService.get(conversationId), enabled: Boolean(conversationId) });
  const [question, setQuestion] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const messageScroller = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => conversation.data?.conversation.messages ?? [], [conversation.data]);

  useEffect(() => {
    const scroller = messageScroller.current;
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: streamingAnswer ? 'auto' : 'smooth' });
  }, [messages.length, pendingQuestion, streamingAnswer]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || sending) return;
    setQuestion(''); setPendingQuestion(text); setStreamingAnswer(''); setSending(true);
    try {
      await conversationsService.streamMessage(conversationId, text, {
        onChunk: (chunk) => setStreamingAnswer((current) => current + chunk),
        onDone: () => undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setPendingQuestion(''); setStreamingAnswer('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate an answer.');
    } finally { setSending(false); }
  }

  if (conversation.isLoading) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading conversation…</div>;
  if (!conversation.data) return <div className="grid min-h-screen place-items-center text-sm text-red-600">Conversation could not be loaded.</div>;

  return (
    <main className="grid h-screen overflow-hidden bg-slate-100 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[270px_minmax(0,1fr)_340px]">
      <ConversationHistory currentConversationId={conversationId} />
      <section className="flex h-screen min-h-0 flex-col overflow-hidden bg-white">
        <header className="shrink-0 flex items-center gap-4 border-b border-slate-200 px-5 py-4"><Link to="/" className="icon-button"><ArrowLeft size={18} /></Link><div className="min-w-0"><h1 className="truncate font-semibold">{conversation.data.conversation.title}</h1><p className="text-xs text-slate-500">{conversation.data.conversation.documents.length} selected document(s)</p></div></header>
        <div ref={messageScroller} className="scrollbar-hidden mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-8">
          {messages.length === 0 && !pendingQuestion && <div className="my-auto text-center"><Sparkles className="mx-auto text-sky-500" size={36} /><h2 className="mt-4 text-xl font-semibold">Ask your documents</h2><p className="mt-2 text-sm text-slate-500">Answers will be grounded in the selected PDFs and include citations.</p></div>}
          {messages.map((message) => <article key={message.id} className={message.role === 'USER' ? 'ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-slate-950 px-4 py-3 text-sm text-white' : 'max-w-[92%] rounded-2xl rounded-bl-md bg-slate-100 px-5 py-4 text-sm text-slate-800'}>{message.role === 'ASSISTANT' ? <CitedAnswer message={message} onCitation={setSelectedCitation} /> : message.content}</article>)}
          {pendingQuestion && <article className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-slate-950 px-4 py-3 text-sm text-white">{pendingQuestion}</article>}
          {sending && <article className="max-w-[92%] rounded-2xl rounded-bl-md bg-slate-100 px-5 py-4 text-sm text-slate-800"><p className="whitespace-pre-wrap leading-7">{streamingAnswer || 'Thinking…'}</p></article>}
        </div>
        <form onSubmit={(event) => void submit(event)} className="shrink-0 border-t border-slate-200 bg-white p-4"><div className="mx-auto flex max-w-3xl gap-3"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={2} maxLength={4000} placeholder="Ask a question about the selected documents…" className="min-h-14 flex-1 resize-none rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100" /><button disabled={sending || !question.trim()} className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-white disabled:opacity-40"><Send size={19} /></button></div></form>
      </section>

      <aside className="hidden h-screen overflow-hidden border-l border-slate-200 bg-slate-50 p-6 lg:block"><h2 className="text-sm font-semibold">Sources</h2><div className="mt-4 space-y-2">{conversation.data.conversation.documents.map(({ document }) => <div key={document.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm"><FileText size={17} className="text-slate-500" /><span className="truncate">{document.originalName}</span></div>)}</div>{selectedCitation && <div className="mt-8 rounded-2xl border border-sky-200 bg-sky-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-sky-700">Citation [{selectedCitation.citationNumber}]</p><p className="mt-3 text-sm leading-6 text-slate-700">{selectedCitation.excerpt}</p></div>}</aside>
    </main>
  );
}
