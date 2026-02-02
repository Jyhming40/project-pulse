import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Undo2, Clock, FileWarning, AlertTriangle, Paperclip } from 'lucide-react';
import type { ActionItemResolution, ResolutionType } from '@/hooks/useActionItemResolutions';

interface ActionHistoryTabProps {
  resolutions: ActionItemResolution[];
  onUnresolve: (id: string) => void;
  isUnresolving: boolean;
}

const typeConfig: Record<ResolutionType, { label: string; icon: React.ReactNode; color: string }> = {
  risk: {
    label: '風險案場',
    icon: <AlertTriangle className="w-3 h-3" />,
    color: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  pending: {
    label: '待補件',
    icon: <FileWarning className="w-3 h-3" />,
    color: 'bg-warning/10 text-warning border-warning/20',
  },
  stuck: {
    label: '超時未更新',
    icon: <Clock className="w-3 h-3" />,
    color: 'bg-warning/10 text-warning border-warning/20',
  },
  linkage_pending: {
    label: '連動待補檔',
    icon: <Paperclip className="w-3 h-3" />,
    color: 'bg-info/10 text-info border-info/20',
  },
};

export function ActionHistoryTab({
  resolutions,
  onUnresolve,
  isUnresolving,
}: ActionHistoryTabProps) {
  const navigate = useNavigate();

  if (resolutions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Clock className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">尚無處理記錄</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px] pr-2">
      <div className="space-y-2">
        {resolutions.map((resolution) => {
          const config = typeConfig[resolution.resolution_type];
          const projectName =
            resolution.projects?.project_code || resolution.projects?.project_name || '未知案場';

          return (
            <div
              key={resolution.id}
              className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{projectName}</span>
                    <Badge variant="outline" className={`text-xs ${config.color}`}>
                      {config.icon}
                      <span className="ml-1">{config.label}</span>
                    </Badge>
                  </div>

                  {resolution.note && (
                    <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                      {resolution.note}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {resolution.profiles?.full_name || resolution.profiles?.email || '系統'} •{' '}
                    {format(new Date(resolution.resolved_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => navigate(`/projects/${resolution.project_id}`)}
                    title="查看案場"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => onUnresolve(resolution.id)}
                    disabled={isUnresolving}
                    title="移回待處理"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
