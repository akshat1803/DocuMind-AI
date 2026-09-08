import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpenCheck, Check, FileText, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { artifactsService } from '@/services/artifacts.service';
import { documentsService } from '@/services/documents.service';
import type { ArtifactKind } from '@/types/api';

const actions: Array<{ kind: ArtifactKind; title: string; description: string }> = [
  { kind: 'OVERVIEW', title: 'Create overview', description: 'Key points and useful next questions.' },
  { kind: 'FLASHCARDS', title: 'Make flashcards', description: 'Source-backed facts to review.' },
  { kind: 'QUIZ', title: 'Build a quiz', description: 'Questions to test your understanding.' },
];

function Flashcards({ cards }: { cards: Array<{ id: number; front: string; back: string }> }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  return <div className="mt-4 grid gap-3 sm:grid-cols-2">{cards.map((card) => <button key={card.id} type="button" onClick={() => setRevealed((current) => { const next = new Set(current); if (next.has(card.id)) next.delete(card.id); else next.add(card.id); return next; })} className="min-h-36 rounded-xl bg-violet-50 p-4 text-left text-sm transition hover:bg-violet-100"><p className="font-semibold text-violet-900">{revealed.has(card.id) ? card.back : card.front}</p><p className="mt-3 text-xs text-violet-700">{revealed.has(card.id) ? 'Click to hide answer' : 'Click to reveal answer'}</p></button>)}</div>;
}

function Quiz({ artifactId, questions }: { artifactId: string; questions: Array<{ id: number; question: string; options: string[]; correctIndex: number; explanation: string }> }) {
  const [answers, setAnswers] = useState<Record<string, number>>({}); const [submitted, setSubmitted] = useState(false);
  const save = useMutation({ mutationFn: (score: number) => artifactsService.saveQuizAttempt(artifactId, score, answers), onError: (error: Error) => toast.error(error.message) });
  const score = Math.round((questions.filter((question) => answers[String(question.id)] === question.correctIndex).length / questions.length) * 100);
  return <div className="mt-4 space-y-5">{questions.map((question) => <div key={question.id} className="rounded-xl bg-canvas p-4"><p className="font-semibold">{question.id}. {question.question}</p><div className="mt-3 space-y-2">{question.options.map((option, index) => <label key={option} className="flex cursor-pointer gap-2 text-sm"><input type="radio" name={`question-${question.id}`} checked={answers[String(question.id)] === index} onChange={() => setAnswers((current) => ({ ...current, [question.id]: index }))} /><span>{option}</span></label>)}</div>{submitted && <p className="mt-3 text-sm text-ink-muted">{question.explanation}</p>}</div>)}<button disabled={Object.keys(answers).length !== questions.length || save.isPending} onClick={() => { setSubmitted(true); save.mutate(score); }} className="primary-button">{submitted ? `Score: ${score}%` : 'Check answers'}</button></div>;
}

export default function StudyWorkspace() {
  const [selected, setSelected] = useState<Set<string>>(new Set()); const queryClient = useQueryClient();
  const documents = useQuery({ queryKey: ['documents'], queryFn: documentsService.list });
  const artifacts = useQuery({ queryKey: ['artifacts'], queryFn: artifactsService.list, refetchInterval: (query) => query.state.data?.artifacts.some((artifact) => artifact.status === 'QUEUED' || artifact.status === 'GENERATING') ? 2500 : false });
  const ready = useMemo(() => documents.data?.documents.filter((document) => document.status === 'READY') ?? [], [documents.data]);
  const create = useMutation({ mutationFn: ({ kind }: { kind: ArtifactKind }) => artifactsService.create(kind, [...selected]), onSuccess: async () => { toast.success('Study material is being prepared.'); await queryClient.invalidateQueries({ queryKey: ['artifacts'] }); }, onError: (error: Error) => toast.error(error.message) });
  return <main className="min-h-screen bg-canvas text-ink"><header className="border-b border-ink/10 bg-paper"><div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4"><Link to="/" className="icon-button"><ArrowLeft size={18} /></Link><div><h1 className="font-display text-2xl">Study workspace</h1><p className="text-xs text-ink-muted">Turn selected sources into review material.</p></div></div></header><section className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-sm font-semibold text-violet-700">1. Choose sources</p><div className="mt-3 space-y-2 rounded-2xl border border-ink/10 bg-paper p-3">{ready.map((document) => <button key={document.id} type="button" onClick={() => setSelected((current) => { const next = new Set(current); if (next.has(document.id)) next.delete(document.id); else next.add(document.id); return next; })} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm ${selected.has(document.id) ? 'bg-violet-100 text-violet-800' : 'hover:bg-canvas'}`}><span className={`grid h-5 w-5 place-items-center rounded border ${selected.has(document.id) ? 'border-violet-600 bg-violet-600 text-white' : 'border-ink/20'}`}>{selected.has(document.id) && <Check size={14} />}</span><FileText size={16} /><span className="truncate">{document.originalName}</span></button>)}{ready.length === 0 && <p className="p-4 text-sm text-ink-muted">Upload and process a PDF first.</p>}</div></div><div><p className="text-sm font-semibold text-violet-700">2. Choose an activity</p><div className="mt-3 grid gap-3">{actions.map((action) => <button key={action.kind} disabled={!selected.size || create.isPending} onClick={() => create.mutate({ kind: action.kind })} className="rounded-2xl border border-ink/10 bg-paper p-5 text-left shadow-card transition hover:border-violet-300 disabled:opacity-45"><BookOpenCheck className="text-violet-700" size={20} /><h2 className="mt-3 font-semibold">{action.title}</h2><p className="mt-1 text-sm text-ink-muted">{action.description}</p></button>)}</div></div></section><section className="mx-auto max-w-5xl px-6 pb-12"><h2 className="font-display text-3xl">Your study materials</h2><div className="mt-4 space-y-4">{artifacts.data?.artifacts.map((artifact) => <article key={artifact.id} className="rounded-2xl border border-ink/10 bg-paper p-5 shadow-card"><div className="flex items-center justify-between"><div><p className="text-xs font-bold tracking-wide text-violet-700">{artifact.kind}</p><p className="mt-1 text-sm text-ink-muted">{artifact.sources.map((source) => source.document.originalName).join(', ')}</p></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">{artifact.status}</span></div>{artifact.status === 'READY' && (
            <div className="mt-4">
              {artifact.kind === 'FLASHCARDS' && artifact.result?.cards ? (
                <Flashcards cards={artifact.result.cards} />
              ) : artifact.kind === 'QUIZ' && artifact.result?.questions ? (
                <Quiz artifactId={artifact.id} questions={artifact.result.questions} />
              ) : (
                <>
                  <p className="whitespace-pre-line text-sm leading-6">{artifact.result?.overview ?? artifact.result?.items?.map((item) => item.text).join('\n\n')}</p>
                  {artifact.result?.suggestedQuestions && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {artifact.result.suggestedQuestions.map((question) => (
                        <span key={question} className="follow-up">{question}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}{artifact.status === 'FAILED' && <p className="mt-3 text-sm text-red-700">Could not generate this material. Try again.</p>}</article>)}{!artifacts.data?.artifacts.length && <div className="rounded-2xl border border-dashed border-ink/20 p-10 text-center text-sm text-ink-muted"><Sparkles className="mx-auto mb-3 text-violet-500" />Choose a source and create your first study material.</div>}</div></section></main>;
}
