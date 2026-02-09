import { useMemo } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { StickyNote, Pin, Calendar, ArrowRight, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMemos, Memo } from '@/hooks/useMemos';
import { useNavigate } from 'react-router-dom';

export function MemosSummaryWidget() {
  const { memos, isLoading } = useMemos();
  const navigate = useNavigate();

  // Show pinned + upcoming reminders, max 5
  const displayMemos = useMemo(() => {
    const pinned = memos.filter(m => m.is_pinned);
    const reminders = memos.filter(m => m.reminder_at && !m.is_pinned && (isToday(new Date(m.reminder_at)) || isPast(new Date(m.reminder_at))));
    const recent = memos.filter(m => !m.is_pinned && !(m.reminder_at && (isToday(new Date(m.reminder_at)) || isPast(new Date(m.reminder_at)))));
    return [...pinned, ...reminders, ...recent].slice(0, 5);
  }, [memos]);

  const reminderCount = useMemo(() => {
    return memos.filter(m => m.reminder_at && (isToday(new Date(m.reminder_at)) || isPast(new Date(m.reminder_at)))).length;
  }, [memos]);

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <StickyNote className="w-4 h-4" />
            備忘錄
            {reminderCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
                <Bell className="w-2.5 h-2.5" />{reminderCount}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate('/memos')}>
            查看全部 <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {displayMemos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">尚無備忘錄</p>
        ) : (
          <div className="space-y-2">
            {displayMemos.map(memo => (
              <div
                key={memo.id}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-muted/50",
                  memo.is_pinned && "bg-primary/5",
                  memo.reminder_at && isPast(new Date(memo.reminder_at)) && "bg-destructive/5",
                )}
                onClick={() => navigate('/memos')}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {memo.is_pinned && <Pin className="w-3 h-3 text-primary fill-primary flex-shrink-0" />}
                    <span className="text-sm font-medium truncate">{memo.title}</span>
                  </div>
                  {memo.content && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {memo.content.replace(/[#*`>_~\[\]]/g, '').slice(0, 60)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {memo.tag && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: memo.tag.color }} />
                  )}
                  {memo.reminder_at && (
                    <span className={cn("text-[10px]", isPast(new Date(memo.reminder_at)) ? "text-destructive" : "text-muted-foreground")}>
                      {format(new Date(memo.reminder_at), 'MM/dd', { locale: zhTW })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
