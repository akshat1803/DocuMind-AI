import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, MessageSquare, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { conversationsService } from '@/services/conversations.service';
import { createDraftChatUrl } from '@/lib/chat-route';

interface ConversationListProps {
  documentIds: string[];
  currentConversationId?: string;
  tone?: 'light' | 'dark';
}

export default function ConversationList({
  documentIds,
  currentConversationId,
  tone = 'light',
}: ConversationListProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const filterKey = [...new Set(documentIds)].sort();
  const history = useQuery({
    queryKey: ['conversations', 'documents', filterKey],
    queryFn: () => conversationsService.list(filterKey),
    enabled: filterKey.length > 0,
  });
  const remove = useMutation({
    mutationFn: conversationsService.remove,
    onSuccess: async (_result, deletedId) => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.removeQueries({ queryKey: ['conversation', deletedId] });
      toast.success('Conversation deleted.');
      navigate(createDraftChatUrl(filterKey), { replace: deletedId === currentConversationId });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const dark = tone === 'dark';

  if (history.isLoading) {
    return <p className={`px-3 py-5 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Loading matching chats…</p>;
  }
  if (history.isError) {
    return <p className={`px-3 py-5 text-xs ${dark ? 'text-red-300' : 'text-red-600'}`}>Could not load chat history.</p>;
  }
  if (history.data?.conversations.length === 0) {
    return (
      <div className={`px-4 py-10 text-center ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
        <MessageSquare className="mx-auto opacity-50" size={28} />
        <p className="mt-3 text-sm font-medium">No chats for this selection</p>
        <p className="mt-1 text-xs leading-5">Start a new chat and it will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {history.data?.conversations.map((conversation) => {
        const active = conversation.id === currentConversationId;
        const names = conversation.documents.map(({ document }) => document.originalName).join(', ');
        return (
          <div
            key={conversation.id}
            className={`group flex items-center rounded-xl transition ${dark
              ? active ? 'bg-white/15' : 'hover:bg-white/10'
              : active ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-slate-50'}`}
          >
            <Link to={`/chat/${conversation.id}`} className="min-w-0 flex-1 px-3 py-3">
              <p className={`truncate text-sm font-medium ${dark ? 'text-white' : 'text-slate-900'}`}>{conversation.title}</p>
              <p className={`mt-1 flex items-center gap-1 truncate text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                <FileText size={11} className="shrink-0" />
                <span className="truncate">{names}</span>
              </p>
              <p className={`mt-1 text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                {conversation._count.messages} messages · {new Date(conversation.updatedAt).toLocaleDateString()}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => { if (window.confirm(`Delete “${conversation.title}”?`)) remove.mutate(conversation.id); }}
              disabled={remove.isPending}
              aria-label={`Delete ${conversation.title}`}
              className={`mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:cursor-wait disabled:opacity-40 ${dark ? 'text-slate-400 hover:bg-red-500/20 hover:text-red-300' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
