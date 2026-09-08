export interface ContextMessage { role: string; content: string; status: string }

export function boundedHistory(messages: ContextMessage[]): string {
  const completed = messages.filter((message) => message.status === 'COMPLETED').slice(-6);
  let remaining = 12_000;
  const selected: string[] = [];
  for (const message of [...completed].reverse()) {
    const entry = `${message.role}: ${message.content}`;
    const bounded = entry.slice(-remaining);
    if (bounded) selected.unshift(bounded);
    remaining -= bounded.length + 2;
    if (remaining <= 0) break;
  }
  return selected.join('\n\n').slice(-12_000);
}

export const followUpActions = [
  { label: 'Explain simpler', question: 'Explain your previous answer in simpler language, using only the selected documents.' },
  { label: 'Go deeper', question: 'Expand on your previous answer with more detail and examples supported by the selected documents.' },
  { label: 'Show the evidence', question: 'Show the source passages supporting your previous answer and explain how they support it.' },
];
