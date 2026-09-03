import { Children, isValidElement, lazy, Suspense } from 'react';
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Citation } from '@/types/api';
import { parseChartSpec } from './chart-spec';

const ChartBlock = lazy(() => import('./ChartBlock'));

interface MarkdownAnswerProps {
  content: string;
  citations?: Citation[];
  onCitation?(citation: Citation): void;
}

export function addCitationLinks(content: string, citations: Citation[]): string {
  if (citations.length === 0) return content;
  const available = new Set(citations.map((citation) => citation.citationNumber));
  return content.replace(/\[(\d+)\](?!\()/g, (marker, value: string) => (
    available.has(Number(value)) ? `[${value}](citation:${value})` : marker
  ));
}

export default function MarkdownAnswer({ content, citations = [], onCitation }: MarkdownAnswerProps) {
  const citationByNumber = new Map(citations.map((citation) => [citation.citationNumber, citation]));
  const components: Components = {
    h1: ({ children }) => <h1 className="mb-3 mt-6 text-xl font-bold tracking-tight first:mt-0">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-3 mt-6 text-lg font-bold tracking-tight first:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-2 mt-5 text-base font-bold first:mt-0">{children}</h3>,
    p: ({ children }) => <p className="my-3 leading-7 first:mt-0 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="my-3 list-disc space-y-2 pl-6 marker:text-slate-400">{children}</ul>,
    ol: ({ children }) => <ol className="my-3 list-decimal space-y-2 pl-6 marker:font-semibold marker:text-slate-500">{children}</ol>,
    li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-slate-950">{children}</strong>,
    blockquote: ({ children }) => <blockquote className="my-4 border-l-4 border-sky-300 bg-white/70 py-1 pl-4 text-slate-600">{children}</blockquote>,
    hr: () => <hr className="my-5 border-slate-300" />,
    table: ({ children }) => <div className="my-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full border-collapse text-left text-sm">{children}</table></div>,
    th: ({ children }) => <th className="border-b border-slate-200 bg-white px-3 py-2 font-semibold text-slate-950">{children}</th>,
    td: ({ children }) => <td className="border-b border-slate-200 px-3 py-2 align-top last:border-b-0">{children}</td>,
    pre: ({ children }) => {
      const child = Children.toArray(children)[0];
      if (isValidElement<{ className?: string }>(child) && child.props.className === 'language-chart') return <>{children}</>;
      return <pre className="my-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{children}</pre>;
    },
    code: ({ className, children, ...props }) => {
      if (className === 'language-chart') {
        const spec = parseChartSpec(String(children).trim());
        return spec ? <Suspense fallback={<span className="my-4 block rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">Rendering chart…</span>}><ChartBlock spec={spec} /></Suspense> : <span className="my-4 block rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Preparing chart data…</span>;
      }
      return className
        ? <code className={className} {...props}>{children}</code>
        : <code className="rounded bg-slate-200 px-1.5 py-0.5 text-[0.9em] text-slate-900" {...props}>{children}</code>;
    },
    a: ({ href, children, ...props }) => {
      const citationNumber = /^citation:(\d+)$/.exec(href ?? '')?.[1];
      const citation = citationNumber ? citationByNumber.get(Number(citationNumber)) : undefined;
      if (citation) {
        return (
          <button
            type="button"
            onClick={() => onCitation?.(citation)}
            className="mx-0.5 inline-flex rounded-md bg-sky-100 px-1.5 py-0.5 align-baseline text-xs font-bold text-sky-800 transition hover:bg-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label={`Open citation ${citation.citationNumber}`}
          >
            {children}
          </button>
        );
      }
      return <a href={href} target="_blank" rel="noreferrer" className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900" {...props}>{children}</a>;
    },
  };

  return (
    <div className="min-w-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        skipHtml
        urlTransform={(url) => url.startsWith('citation:') ? url : defaultUrlTransform(url)}
      >
        {addCitationLinks(content, citations)}
      </ReactMarkdown>
    </div>
  );
}
