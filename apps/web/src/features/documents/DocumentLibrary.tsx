import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Files, FileText, LogOut, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { documentsService } from '@/services/documents.service';
import { conversationsService } from '@/services/conversations.service';
import { ApiError } from '@/services/api';
import { getDocumentRefetchInterval } from '@/lib/document-polling';

const statusStyles = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PROCESSING: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  READY: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  FAILED: 'bg-red-50 text-red-700 ring-red-600/20',
};

export default function DocumentLibrary() {
  const { user, logout } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const documents = useQuery({
    queryKey: ['documents'],
    queryFn: documentsService.list,
    refetchInterval: (query) => getDocumentRefetchInterval(query.state.data?.documents),
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 401) && failureCount < 1,
  });
  const upload = useMutation({
    mutationFn: documentsService.upload,
    onSuccess: async () => { toast.success('PDF uploaded for processing.'); await queryClient.invalidateQueries({ queryKey: ['documents'] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: documentsService.remove,
    onSuccess: async () => { toast.success('Document deleted.'); await queryClient.invalidateQueries({ queryKey: ['documents'] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const createConversation = useMutation({
    mutationFn: () => conversationsService.create([...selected]),
    onSuccess: ({ conversation }) => navigate(`/chat/${conversation.id}`),
    onError: (error: Error) => toast.error(error.message),
  });
  const retryDocument = useMutation({
    mutationFn: documentsService.retry,
    onSuccess: async () => { toast.success('Document processing restarted.'); await queryClient.invalidateQueries({ queryKey: ['documents'] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  async function openSource(documentId: string) {
    try {
      const source = await documentsService.source(documentId);
      window.open(source.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open source.');
    }
  }

  const items = documents.data?.documents ?? [];
  return (
    <main className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 font-semibold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white"><Files size={18} /></span>DocuMind AI</div>
          <div className="flex items-center gap-4"><span className="hidden text-sm text-slate-500 sm:inline">{user?.email}</span><button onClick={() => void logout()} className="icon-button" aria-label="Sign out"><LogOut size={18} /></button></div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-sm font-semibold text-sky-700">Your knowledge base</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Document library</h1><p className="mt-2 text-sm text-slate-500">Upload PDFs, then ask grounded questions with page-level citations.</p></div>
          <input ref={inputRef} className="hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ''; }} />
          <div className="flex gap-3"><button onClick={() => createConversation.mutate()} disabled={selected.size === 0 || createConversation.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"><ExternalLink size={17} />Start chat {selected.size > 0 ? `(${selected.size})` : ''}</button><button onClick={() => inputRef.current?.click()} disabled={upload.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Plus size={17} />{upload.isPending ? 'Uploading…' : 'Upload PDF'}</button></div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {documents.isLoading && <div className="p-10 text-center text-sm text-slate-500">Loading documents…</div>}
          {documents.isError && <div className="p-10 text-center text-sm text-red-600">Could not load your documents.</div>}
          {!documents.isLoading && !documents.isError && items.length === 0 && <div className="p-16 text-center"><FileText className="mx-auto text-slate-300" size={42} /><h2 className="mt-4 font-semibold">No documents yet</h2><p className="mt-1 text-sm text-slate-500">Upload your first PDF to start building the library.</p></div>}
          {items.map((document) => (
            <article key={document.id} className="flex flex-col gap-4 border-b border-slate-100 p-5 last:border-0 sm:flex-row sm:items-center">
              <input type="checkbox" aria-label={`Select ${document.originalName}`} disabled={document.status !== 'READY'} checked={selected.has(document.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(document.id)) next.delete(document.id); else next.add(document.id); return next; })} className="h-4 w-4 rounded border-slate-300 text-sky-600 disabled:opacity-30" />
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><FileText size={21} /></span>
              <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{document.originalName}</h2><p className="mt-1 text-xs text-slate-500">{(Number(document.sizeBytes) / 1024 / 1024).toFixed(2)} MB · {new Date(document.createdAt).toLocaleDateString()}{document.errorCode ? ` · ${document.errorCode}` : ''}</p></div>
              <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${statusStyles[document.status]}`}>{document.status}</span>
              <div className="flex gap-2">{document.status === 'FAILED' && <button onClick={() => retryDocument.mutate(document.id)} disabled={retryDocument.isPending} className="icon-button text-sky-700 disabled:opacity-40" aria-label="Retry processing"><RotateCcw size={17} /></button>}<button onClick={() => void openSource(document.id)} className="icon-button" aria-label="Open source"><ExternalLink size={17} /></button><button onClick={() => { if (window.confirm(`Delete ${document.originalName}?`)) remove.mutate(document.id); }} className="icon-button text-red-600" aria-label="Delete document"><Trash2 size={17} /></button></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
