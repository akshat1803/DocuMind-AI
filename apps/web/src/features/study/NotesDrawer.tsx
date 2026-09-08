import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { artifactsService } from '@/services/artifacts.service';

export default function NotesDrawer({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const notes = useQuery({ queryKey: ['notes'], queryFn: artifactsService.listNotes, enabled: open });
  
  const createNote = useMutation({
    mutationFn: () => artifactsService.createNote({ content: content.trim() }),
    onSuccess: async () => {
      setContent('');
      toast.success('Note saved.');
      await queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-paper p-6 shadow-paper focus:outline-none flex flex-col">
          <div className="flex items-center justify-between border-b border-ink/10 pb-4">
            <div className="flex items-center gap-2">
              <FileText className="text-violet-700" size={20} />
              <Dialog.Title className="font-display text-xl text-ink">Personal Notes</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="Close notes">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a private note or key takeaway..."
              rows={3}
              className="field resize-none"
            />
            <button
              disabled={!content.trim() || createNote.isPending}
              onClick={() => createNote.mutate()}
              className="primary-button self-end flex items-center gap-1.5"
            >
              <Plus size={16} />
              Save Note
            </button>
          </div>

          <div className="mt-6 flex-1 overflow-y-auto space-y-3 pr-1">
            {notes.data?.notes.map((note) => (
              <div key={note.id} className="rounded-xl border border-ink/10 bg-canvas p-4 text-sm">
                <p className="whitespace-pre-wrap text-ink">{note.content}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                  <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {notes.data?.notes.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-muted">No personal notes yet. Save your first note above.</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
