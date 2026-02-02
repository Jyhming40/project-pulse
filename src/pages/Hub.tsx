import { useNavigate } from 'react-router-dom';
import { useAppSettingsRead } from '@/hooks/useAppSettings';
import { usePermissions } from '@/hooks/usePermissions';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { 
  getAllWorkspaces, 
  WorkspaceDefinition 
} from '@/config/moduleRegistry';
import { ArrowRight, Zap, Sparkles, Building2, FileCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Hub() {
  const navigate = useNavigate();
  const { settings } = useAppSettingsRead();
  const { canView } = usePermissions();
  const { setCurrentWorkspace } = useWorkspace();

  const systemName = settings?.company_name_zh || '明群環能';
  
  // Fetch quick stats
  const { data: stats } = useQuery({
    queryKey: ['hub-quick-stats'],
    queryFn: async () => {
      const [projectsRes, documentsRes] = await Promise.all([
        supabase.from('project_analytics_view').select('project_id, current_project_status', { count: 'exact' }),
        supabase.from('documents').select('id, doc_status', { count: 'exact' }).eq('is_deleted', false),
      ]);
      
      const activeProjects = projectsRes.data?.filter((p: any) => 
        p.current_project_status !== '完工' && p.current_project_status !== '已取消'
      ).length || 0;
      
      const pendingDocs = documentsRes.data?.filter((d: any) => 
        d.doc_status === '待送審' || d.doc_status === '審查中'
      ).length || 0;
      
      return {
        activeProjects,
        pendingDocs,
        totalProjects: projectsRes.count || 0,
        completedThisMonth: 0, // Placeholder
      };
    },
  });
  
  // Get all workspaces filtered by permission
  const accessibleWorkspaces = getAllWorkspaces().filter(ws => 
    canView(ws.requiredPermission)
  );

  const handleWorkspaceClick = (workspace: WorkspaceDefinition) => {
    setCurrentWorkspace(workspace.id);
  };

  // Color mapping for gradients and borders
  const getWorkspaceStyles = (workspaceId: string) => {
    const styles: Record<string, { gradient: string; border: string; glow: string }> = {
      sales: {
        gradient: 'from-blue-500/8 via-blue-500/5 to-transparent',
        border: 'hover:border-blue-500/40',
        glow: 'hover:shadow-blue-500/10',
      },
      execution: {
        gradient: 'from-amber-500/8 via-amber-500/5 to-transparent',
        border: 'hover:border-amber-500/40',
        glow: 'hover:shadow-amber-500/10',
      },
      governance: {
        gradient: 'from-emerald-500/8 via-emerald-500/5 to-transparent',
        border: 'hover:border-emerald-500/40',
        glow: 'hover:shadow-emerald-500/10',
      },
      finance: {
        gradient: 'from-violet-500/8 via-violet-500/5 to-transparent',
        border: 'hover:border-violet-500/40',
        glow: 'hover:shadow-violet-500/10',
      },
      risk: {
        gradient: 'from-rose-500/8 via-rose-500/5 to-transparent',
        border: 'hover:border-rose-500/40',
        glow: 'hover:shadow-rose-500/10',
      },
    };
    return styles[workspaceId] || { gradient: 'from-muted/10 to-transparent', border: 'hover:border-primary/30', glow: '' };
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header with animated gradient background */}
      <div className="relative text-center py-12 md:py-16 px-4 overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          {/* Logo with hover animation */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 mb-6 overflow-hidden shadow-lg shadow-primary/10 transition-transform hover:scale-105 duration-300">
            {settings?.logo_light_url ? (
              <img 
                src={settings.logo_light_url} 
                alt="Company Logo" 
                className="w-14 h-14 object-contain"
              />
            ) : (
              <Zap className="w-10 h-10 text-primary" />
            )}
          </div>
          
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-4">
            {systemName}
            <span className="block text-2xl md:text-3xl lg:text-4xl mt-1 text-primary/80">營運指揮中心</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-primary/60" />
            選擇工作模式，開始今日任務
          </p>
        </div>
      </div>

      {/* Workspace Cards Grid */}
      <div className="flex-1 px-4 pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Grid with staggered animation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {accessibleWorkspaces.map((workspace, index) => {
              const Icon = workspace.icon;
              const styles = getWorkspaceStyles(workspace.id);
              return (
                <button
                  key={workspace.id}
                  onClick={() => handleWorkspaceClick(workspace)}
                  className={cn(
                    "group relative p-6 md:p-8 rounded-2xl border border-border bg-card",
                    "transition-all duration-300 ease-out",
                    "hover:shadow-xl hover:-translate-y-1.5",
                    "text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    styles.border,
                    styles.glow
                  )}
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    animation: 'fadeInUp 0.5s ease-out forwards',
                  }}
                >
                  {/* Gradient overlay */}
                  <div className={cn(
                    "absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    styles.gradient
                  )} />

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Icon with enhanced styling */}
                    <div className={cn(
                      "inline-flex items-center justify-center w-14 h-14 rounded-xl mb-5",
                      "bg-gradient-to-br from-background to-muted/50 shadow-sm border border-border/50",
                      "group-hover:scale-110 group-hover:shadow-md transition-all duration-300",
                      workspace.color
                    )}>
                      <Icon className="w-7 h-7" />
                    </div>

                    {/* Text content */}
                    <div className="space-y-1.5">
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                          {workspace.label}
                        </h2>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {workspace.description}
                      </p>
                    </div>

                    {/* Workspace ID badge */}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                        {workspace.id}
                      </span>
                      <ArrowRight className={cn(
                        "w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300",
                        workspace.color
                      )} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {accessibleWorkspaces.length === 0 && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">尚無可用的工作模式</h3>
              <p className="text-muted-foreground">
                請聯繫管理員開通權限
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="border-t border-border bg-gradient-to-t from-muted/50 to-transparent py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            <QuickStat 
              label="進行中案件" 
              value={stats?.activeProjects ?? '—'} 
              icon={Building2}
            />
            <QuickStat 
              label="待處理文件" 
              value={stats?.pendingDocs ?? '—'} 
              icon={FileCheck}
            />
            <QuickStat 
              label="本月完成" 
              value={stats?.completedThisMonth ?? '—'} 
              icon={Clock}
            />
            <QuickStat 
              label="總案件數" 
              value={stats?.totalProjects ?? '—'} 
            />
          </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function QuickStat({ 
  label, 
  value,
  icon: Icon,
}: { 
  label: string; 
  value: string | number;
  icon?: React.ElementType;
}) {
  return (
    <div className="text-center md:text-left flex flex-col md:flex-row items-center md:items-start gap-3 p-4 rounded-xl bg-card/50 border border-border/50">
      {Icon && (
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      )}
      <div>
        <p className="text-2xl md:text-3xl font-bold text-foreground">
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}
