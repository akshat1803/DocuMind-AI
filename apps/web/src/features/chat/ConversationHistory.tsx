import { MessageSquare, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import ConversationList from './ConversationList';

interface ConversationHistoryProps {
  currentConversationId?: string;
  documentIds: string[];
}

export default function ConversationHistory({ currentConversationId, documentIds }: ConversationHistoryProps) {
  const selectionUrl = `/?documents=${encodeURIComponent([...documentIds].sort().join(','))}`;

  return (
    <aside className="hidden h-screen min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-950 text-white lg:flex">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center gap-2 font-semibold"><MessageSquare size={18} className="text-sky-300" />Related chats</div>
        <p className="mt-1 text-xs leading-5 text-slate-400">Only history for the active PDFs</p>
        <Link to={selectionUrl} className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100"><Plus size={16} />Choose PDFs</Link>
      </div>
      <div className="scrollbar-hidden flex-1 space-y-1 overflow-y-auto p-3">
        <ConversationList documentIds={documentIds} currentConversationId={currentConversationId} tone="dark" />
      </div>
    </aside>
  );
}
