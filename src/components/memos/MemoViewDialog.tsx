import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Pin, Calendar, Building2, User } from 'lucide-react';
import { Memo } from '@/hooks/useMemos';

interface MemoViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memo: Memo | null;
}

export default function MemoViewDialog({ open, onOpenChange, memo }: MemoViewDialogProps) {
  if (!memo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {memo.is_pinned && <Pin className="w-4 h-4 text-primary fill-primary" />}
            {memo.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 mb-3">
          {memo.tag && (
            <Badge variant="outline" style={{ borderColor: memo.tag.color, color: memo.tag.color }}>
              {memo.tag.name}
            </Badge>
          )}
          {memo.project && (
            <Badge variant="secondary" className="gap-1">
              <Building2 className="w-3 h-3" />
              {memo.project.project_code} - {memo.project.project_name}
            </Badge>
          )}
          {!memo.is_personal && <Badge variant="outline">團隊共享</Badge>}
          {memo.reminder_at && (
            <Badge variant="outline" className="gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(memo.reminder_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
            </Badge>
          )}
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{memo.content || '*（無內容）*'}</ReactMarkdown>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3 mt-4">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {memo.profile?.full_name || memo.profile?.email?.split('@')[0] || '—'}
          </span>
          <span>更新於 {format(new Date(memo.updated_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
