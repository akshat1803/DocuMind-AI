import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileWarning, Minus, Plus } from 'lucide-react';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { documentsService } from '@/services/documents.service';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  documentId?: string;
  documentName?: string;
  page?: number | null;
  onPageChange?(page: number): void;
}

export default function PdfViewer({ documentId, documentName, page, onPageChange }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1.1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const documentRef = useRef<PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!documentId) { setStatus('idle'); return; }
    const controller = new AbortController();
    setStatus('loading'); setCurrentPage(1); setPageCount(0);
    void documentsService.content(documentId, controller.signal)
      .then((bytes) => getDocument({ data: bytes }).promise)
      .then((pdf) => {
        if (controller.signal.aborted) return;
        documentRef.current = pdf;
        setPageCount(pdf.numPages);
        setStatus('ready');
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => {
      controller.abort();
      documentRef.current = null;
    };
  }, [documentId]);

  useEffect(() => { if (page && page >= 1 && page <= pageCount) setCurrentPage(page); }, [page, pageCount]);

  useEffect(() => {
    const pdf = documentRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || status !== 'ready') return;
    let cancelled = false;
    void pdf.getPage(currentPage).then((pdfPage) => {
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale: zoom });
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      return pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [currentPage, status, zoom]);

  function changePage(next: number) {
    const bounded = Math.max(1, Math.min(pageCount, next));
    setCurrentPage(bounded);
    onPageChange?.(bounded);
  }

  if (!documentId) return <div className="grid h-full place-items-center p-8 text-center text-sm text-ink-muted"><div><FileWarning className="mx-auto mb-3 text-violet-500" /><p className="font-medium text-ink">Choose a source to read</p><p className="mt-1">Cited pages will open here.</p></div></div>;
  if (status === 'loading' || status === 'idle') return <div className="grid h-full place-items-center text-sm text-ink-muted"><span className="loading-dot" />Loading {documentName ?? 'document'}…</div>;
  if (status === 'error') return <div className="grid h-full place-items-center p-8 text-center text-sm text-red-700"><div><FileWarning className="mx-auto mb-3" /><p className="font-medium">This document could not be displayed.</p><p className="mt-1 text-ink-muted">Refresh the workspace or try the source link from your library.</p></div></div>;

  return <div className="flex h-full min-h-0 flex-col bg-[#efece8]">
    <div className="flex items-center justify-between border-b border-ink/10 bg-paper px-3 py-2 text-xs text-ink-muted">
      <span className="min-w-0 truncate px-1 font-medium text-ink">{documentName}</span>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" className="viewer-button" onClick={() => setZoom((value) => Math.max(.65, value - .15))} aria-label="Zoom out"><Minus size={15} /></button>
        <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" className="viewer-button" onClick={() => setZoom((value) => Math.min(2.2, value + .15))} aria-label="Zoom in"><Plus size={15} /></button>
      </div>
    </div>
    <div className="scrollbar-hidden min-h-0 flex-1 overflow-auto p-5"><div className="mx-auto w-fit rounded-sm bg-white shadow-paper"><canvas ref={canvasRef} className="block max-w-none" /></div></div>
    <div className="flex items-center justify-center gap-3 border-t border-ink/10 bg-paper p-2 text-xs text-ink-muted">
      <button type="button" className="viewer-button" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
      <span className="min-w-20 text-center tabular-nums">Page {currentPage} of {pageCount}</span>
      <button type="button" className="viewer-button" disabled={currentPage >= pageCount} onClick={() => changePage(currentPage + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
    </div>
  </div>;
}
