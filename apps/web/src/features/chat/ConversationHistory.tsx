import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { conversationsService } from '@/services/conversations.service';

interface ConversationHistoryProps { currentConversationId: string }

export default function ConversationHistory({ currentConversationId }: ConversationHistoryProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const history = useQuery({ queryKey: ['conversations'], queryFn: conversationsService.list });
  const remove = useMutation({
    mutationFn: conversationsService.remove,
    onSuccess: async (_result, deletedId) => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.removeQueries({ queryKey: ['conversation', deletedId] });
      if (deletedId === currentConversationId) navigate('/');
      toast.success('Conversation deleted.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <aside className="hidden h-screen min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-950 text-white xl:flex">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center gap-2 font-semibold"><MessageSquare size={18} className="text-sky-300" />Chat history</div>
        <Link to="/" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100"><Plus size={16} />New chat</Link>
      </div>
      <div className="scrollbar-hidden flex-1 space-y-1 overflow-y-auto p-3">
        {history.isLoading && <p className="px-3 py-5 text-xs text-slate-400">Loading history…</p>}
        {history.data?.conversations.length === 0 && <p className="px-3 py-5 text-xs leading-5 text-slate-400">Your saved conversations will appear here.</p>}
        {history.data?.conversations.map((conversation) => {
          const active = conversation.id === currentConversationId;
          return (
            <div key={conversation.id} className={`group flex items-center rounded-xl ${active ? 'bg-white/15' : 'hover:bg-white/10'}`}>
              <Link to={`/chat/${conversation.id}`} className="min-w-0 flex-1 px-3 py-3">
                <p className="truncate text-sm font-medium">{conversation.title}</p>
                <p className="mt-1 text-[11px] text-slate-400">{conversation._count.messages} messages · {new Date(conversation.updatedAt).toLocaleDateString()}</p>
              </Link>
              <button onClick={() => { if (window.confirm(`Delete “${conversation.title}”?`)) remove.mutate(conversation.id); }} aria-label={`Delete ${conversation.title}`} className="mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 opacity-0 hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100 focus:opacity-100"><Trash2 size={15} /></button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
