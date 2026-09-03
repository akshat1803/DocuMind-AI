import { type DragEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, Files, FileText, LogOut, MessageSquarePlus, Plus, RotateCcw, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { documentsService } from '@/services/documents.service';
import { ApiError } from '@/services/api';
import { getDocumentRefetchInterval } from '@/lib/document-polling';
import { createDraftChatUrl } from '@/lib/chat-route';

const statusStyles = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PROCESSING: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  READY: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  FAILED: 'bg-red-50 text-red-700 ring-red-600/20',
};

export default function DocumentLibrary() {
  const { user, logout } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isDragging, setIsDragging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(
    (searchParams.get('documents') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  ));
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
    onSuccess: async (_result, documentId) => {
      setSelected((current) => { const next = new Set(current); next.delete(documentId); return next; });
      toast.success('Document deleted.');
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const retryDocument = useMutation({
    mutationFn: documentsService.retry,
    onSuccess: async () => { toast.success('Document processing restarted.'); await queryClient.invalidateQueries({ queryKey: ['documents'] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  function uploadFiles(files: FileList | null): void {
    if (!files || files.length === 0 || upload.isPending) return;
    if (files.length > 1) {
      toast.error('Please upload one PDF at a time.');
      return;
    }
    const file = files[0];
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are accepted.');
      return;
    }
    upload.mutate(file);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer.types.includes('Files')) return;
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    uploadFiles(event.dataTransfer.files);
  }

  async function openSource(documentId: string) {
    try {
      const source = await documentsService.source(documentId);
      window.open(source.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open source.');
    }
  }

  function startChat(documentIds: string[]): void {
    navigate(createDraftChatUrl(documentIds));
  }

  function toggleDocument(documentId: string): void {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  }

  const items = documents.data?.documents ?? [];
  useEffect(() => {
    if (!documents.data) return;
    const readyIds = new Set(documents.data.documents.filter((document) => document.status === 'READY').map((document) => document.id));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => readyIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [documents.data]);
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
          <div><p className="text-sm font-semibold text-sky-700">Your knowledge base</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Document library</h1><p className="mt-2 text-sm text-slate-500">Select one or more ready PDFs, then start a grounded chat.</p></div>
          <input ref={inputRef} className="hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => { uploadFiles(event.target.files); event.target.value = ''; }} />
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => startChat([...selected])}
              disabled={selected.size === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MessageSquarePlus size={17} />
              {`Chat with selected${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </button>
            <button onClick={() => inputRef.current?.click()} disabled={upload.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Plus size={17} />{upload.isPending ? 'Uploading…' : 'Upload PDF'}</button>
          </div>
        </div>

        <div
          className={`relative mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm transition ${isDragging ? 'border-sky-500 ring-4 ring-sky-100' : 'border-slate-200'}`}
          onDragEnter={handleDragEnter}
          onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; }}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-busy={upload.isPending}
        >
          {isDragging && items.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-sky-50/95 backdrop-blur-sm">
              <div className="text-center text-sky-800"><UploadCloud className="mx-auto" size={40} /><p className="mt-3 font-semibold">Drop PDF to upload</p><p className="mt-1 text-xs">One PDF at a time</p></div>
            </div>
          )}
          {documents.isLoading && <div className="p-10 text-center text-sm text-slate-500">Loading documents…</div>}
          {documents.isError && <div className="p-10 text-center text-sm text-red-600">Could not load your documents.</div>}
          {!documents.isLoading && !documents.isError && items.length === 0 && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => { if (!upload.isPending) inputRef.current?.click(); }}
              onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && !upload.isPending) { event.preventDefault(); inputRef.current?.click(); } }}
              className={`cursor-pointer p-16 text-center outline-none transition focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sky-200 ${isDragging ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
              aria-label="Upload a PDF by browsing or dragging and dropping"
            >
              <span className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${isDragging ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-400'}`}>
                <UploadCloud size={34} />
              </span>
              <h2 className="mt-5 text-lg font-semibold">{upload.isPending ? 'Uploading PDF…' : isDragging ? 'Drop your PDF here' : 'Drag and drop your PDF'}</h2>
              <p className="mt-2 text-sm text-slate-500">{upload.isPending ? 'Please wait while the upload completes.' : 'or click anywhere in this area to browse'}</p>
              <p className="mt-3 text-xs text-slate-400">PDF only · one file at a time</p>
            </div>
          )}
          {items.map((document) => {
            const isReady = document.status === 'READY';
            const isSelected = selected.has(document.id);
            return (
            <article
              key={document.id}
              onClick={(event) => {
                if (!isReady || (event.target as HTMLElement).closest('button, a')) return;
                toggleDocument(document.id);
              }}
              className={`flex flex-col gap-4 border-b p-5 transition last:border-0 sm:flex-row sm:items-center ${isSelected ? 'border-sky-100 bg-sky-50/80 shadow-[inset_4px_0_0_#0ea5e9]' : isReady ? 'border-slate-100 hover:bg-slate-50/80' : 'border-slate-100'} ${isReady ? 'cursor-pointer' : ''}`}
            >
              <button
                type="button"
                onClick={() => { if (isReady) toggleDocument(document.id); }}
                disabled={!isReady}
                aria-label={`${isSelected ? 'Deselect' : 'Select'} ${document.originalName}`}
                aria-pressed={isSelected}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 transition focus:outline-none focus:ring-4 focus:ring-sky-100 ${isSelected ? 'border-sky-600 bg-sky-600 text-white shadow-sm' : isReady ? 'border-slate-300 bg-white text-transparent hover:border-sky-500' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-transparent opacity-60'}`}
              >
                <Check size={17} strokeWidth={3} />
              </button>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition ${isSelected ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}><FileText size={21} /></span>
              <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{document.originalName}</h2><p className="mt-1 text-xs text-slate-500">{(Number(document.sizeBytes) / 1024 / 1024).toFixed(2)} MB · {new Date(document.createdAt).toLocaleDateString()}{document.errorCode ? ` · ${document.errorCode}` : ''}</p></div>
              <div className="flex items-center gap-2">
                {isSelected && <span className="rounded-full bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white">SELECTED</span>}
                <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${statusStyles[document.status]}`}>{document.status}</span>
              </div>
              <div className="flex gap-2">
                {document.status === 'READY' && <button onClick={() => startChat([document.id])} className="icon-button text-sky-700" aria-label={`Start chat with ${document.originalName}`} title="Start chat"><MessageSquarePlus size={17} /></button>}
                {document.status === 'FAILED' && <button onClick={() => retryDocument.mutate(document.id)} disabled={retryDocument.isPending} className="icon-button text-sky-700 disabled:opacity-40" aria-label="Retry processing"><RotateCcw size={17} /></button>}
                <button onClick={() => void openSource(document.id)} className="icon-button" aria-label="Open source"><ExternalLink size={17} /></button>
                <button onClick={() => { if (window.confirm(`Delete ${document.originalName}?`)) remove.mutate(document.id); }} className="icon-button text-red-600" aria-label="Delete document"><Trash2 size={17} /></button>
              </div>
            </article>
          );})}
        </div>
      </section>
    </main>
  );
}
