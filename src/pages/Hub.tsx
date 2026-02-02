import { useNavigate } from 'react-router-dom';
import { useAppSettingsRead } from '@/hooks/useAppSettings';
import { usePermissions } from '@/hooks/usePermissions';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { 
  getAllWorkspaces, 
  WORKSPACE_REGISTRY,
  WorkspaceDefinition 
} from '@/config/moduleRegistry';
import { ArrowRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Hub() {
  const navigate = useNavigate();
  const { settings } = useAppSettingsRead();
  const { canView } = usePermissions();
  const { setCurrentWorkspace } = useWorkspace();

  const systemName = settings?.company_name_zh || '明群環能';
  
  // Get all workspaces filtered by permission
  const accessibleWorkspaces = getAllWorkspaces().filter(ws => 
    canView(ws.requiredPermission)
  );

  const handleWorkspaceClick = (workspace: WorkspaceDefinition) => {
    setCurrentWorkspace(workspace.id);
  };

  // Color mapping for gradients
  const getGradientClass = (workspaceId: string) => {
    const gradients: Record<string, string> = {
      sales: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10',
      execution: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10',
      governance: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10',
      finance: 'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10',
      risk: 'from-rose-500/10 to-rose-600/5 hover:from-rose-500/20 hover:to-rose-600/10',
    };
    return gradients[workspaceId] || 'from-muted/10 to-muted/5';
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6 overflow-hidden">
          {settings?.logo_light_url ? (
            <img 
              src={settings.logo_light_url} 
              alt="Company Logo" 
              className="w-12 h-12 object-contain"
            />
          ) : (
            <Zap className="w-8 h-8 text-primary" />
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
          {systemName} 營運指揮中心
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          選擇您要進行的工作模式，開始今日任務
        </p>
      </div>

      {/* Workspace Cards Grid */}
      <div className="flex-1 px-4 pb-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accessibleWorkspaces.map((workspace) => {
            const Icon = workspace.icon;
            return (
              <button
                key={workspace.id}
                onClick={() => handleWorkspaceClick(workspace)}
                className={cn(
                  "group relative p-8 rounded-2xl border border-border bg-gradient-to-br transition-all duration-300",
                  "hover:shadow-lg hover:border-primary/30 hover:-translate-y-1",
                  "text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  getGradientClass(workspace.id)
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "inline-flex items-center justify-center w-14 h-14 rounded-xl mb-6",
                  "bg-background/80 shadow-sm",
                  workspace.color
                )}>
                  <Icon className="w-7 h-7" />
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {workspace.label}
                    </h2>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {workspace.id}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {workspace.description}
                  </p>
                </div>

                {/* Arrow indicator */}
                <div className={cn(
                  "absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity",
                  workspace.color
                )}>
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>
            );
          })}
        </div>

        {accessibleWorkspaces.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              您目前沒有任何可存取的工作模式。請聯繫管理員開通權限。
            </p>
          </div>
        )}
      </div>

      {/* Quick Stats Footer */}
      <div className="border-t border-border bg-muted/30 py-6 px-4">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-8 text-center">
          <QuickStat label="進行中案件" value="—" />
          <QuickStat label="待辦事項" value="—" />
          <QuickStat label="本月完成" value="—" />
          <QuickStat label="異常警示" value="—" highlight />
        </div>
      </div>
    </div>
  );
}

function QuickStat({ 
  label, 
  value, 
  highlight = false 
}: { 
  label: string; 
  value: string | number; 
  highlight?: boolean;
}) {
  return (
    <div className="px-4">
      <p className={cn(
        "text-2xl font-bold",
        highlight ? "text-destructive" : "text-foreground"
      )}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
