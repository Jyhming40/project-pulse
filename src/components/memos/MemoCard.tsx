import { format, isPast, isToday } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Pin, Calendar, Building2, Pencil, Trash2, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Memo } from '@/hooks/useMemos';
import { useAuth } from '@/contexts/AuthContext';

interface MemoCardProps {
  memo: Memo;
  onEdit: (memo: Memo) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onView: (memo: Memo) => void;
}

export default function MemoCard({ memo, onEdit, onDelete, onTogglePin, onView }: MemoCardProps) {
  const { user } = useAuth();
  const isOwner = user?.id === memo.user_id;
  const reminderPast = memo.reminder_at && isPast(new Date(memo.reminder_at));
  const reminderToday = memo.reminder_at && isToday(new Date(memo.reminder_at));

  return (
    <Card className={cn(
      "group transition-all hover:shadow-md cursor-pointer",
      memo.is_pinned && "border-primary/40 bg-primary/5",
      reminderPast && !reminderToday && "border-destructive/30",
      reminderToday && "border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20",
    )} onClick={() => onView(memo)}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {memo.is_pinned && <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0 fill-primary" />}
            <h3 className="font-medium text-sm truncate">{memo.title}</h3>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <TooltipProvider delayDuration={0}>
              {isOwner && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); onTogglePin(memo.id, !memo.is_pinned); }}>
                        <Pin className={cn("w-3.5 h-3.5", memo.is_pinned && "fill-current")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{memo.is_pinned ? '取消釘選' : '釘選'}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); onEdit(memo); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>編輯</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={e => { e.stopPropagation(); onDelete(memo.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>刪除</TooltipContent>
                  </Tooltip>
                </>
              )}
            </TooltipProvider>
          </div>
        </div>

        {memo.content && (
          <p className="text-xs text-muted-foreground line-clamp-2">{memo.content.replace(/[#*`>_~\[\]]/g, '').slice(0, 120)}</p>
        )}

        <div className="flex items-center flex-wrap gap-1.5">
          {memo.tag && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: memo.tag.color, color: memo.tag.color }}>
              {memo.tag.name}
            </Badge>
          )}
          {memo.project && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
              <Building2 className="w-2.5 h-2.5" />
              {memo.project.project_code}
            </Badge>
          )}
          {!memo.is_personal && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">共享</Badge>
          )}
          {memo.reminder_at && (
            <Badge variant={reminderPast ? 'destructive' : 'outline'} className={cn("text-[10px] px-1.5 py-0 gap-1", reminderToday && "border-amber-500 text-amber-600")}>
              <Calendar className="w-2.5 h-2.5" />
              {format(new Date(memo.reminder_at), 'MM/dd HH:mm', { locale: zhTW })}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
          <span>{memo.profile?.full_name || memo.profile?.email?.split('@')[0] || '—'}</span>
          <span>{format(new Date(memo.updated_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</span>
        </div>
      </CardContent>
    </Card>
  );
}
