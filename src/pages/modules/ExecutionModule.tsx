import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  HardHat, 
  Building2, 
  Scale, 
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { 
  KPICard, 
  KPICardSkeleton,
  QuickActionCard, 
  WorkspaceHeader, 
  ActionRequiredCard,
  ActionItem
} from '@/components/workspace';
import { useExecutionKPIs } from '@/hooks/useModuleKPIs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Hook to get risk projects for the action required section
function useRiskProjects(limit = 5) {
  return useQuery({
    queryKey: ['execution-risk-projects', limit],
    queryFn: async () => {
      const activeStatuses = ['開發中', '台電送件', '台電審查', '同意備案', '設備登記'];
      
      const { data, error } = await supabase
        .from('project_analytics_view')
        .select('project_id, project_name, project_code, current_project_status, overall_progress_percent, has_risk, updated_at, investor_code')
        .eq('has_risk', true)
        .in('current_project_status', activeStatuses)
        .order('updated_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function ExecutionModule() {
  const navigate = useNavigate();
  const { data: kpis, isLoading } = useExecutionKPIs();
  const { data: riskProjects = [], isLoading: isLoadingRisk } = useRiskProjects(5);

  const totalRiskCount = kpis?.overdueWarnings ?? 0;
  const remainingCount = Math.max(0, totalRiskCount - riskProjects.length);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <WorkspaceHeader
        title="工程與行政"
        subtitle="時程管理、里程碑追蹤、多單位協調"
        icon={HardHat}
        badge="Execution"
        color="amber"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard 
              title="進行中案件" 
              value={kpis?.inProgress ?? 0} 
              icon={Clock}
              color="blue"
              onClick={() => navigate('/projects?status=active')}
            />
            <KPICard 
              title="本月完成" 
              value={kpis?.completedThisMonth ?? 0} 
              icon={CheckCircle2}
              color="emerald"
              trend={kpis?.completedThisMonth && kpis.completedThisMonth > 0 ? 'up' : 'neutral'}
            />
            <KPICard 
              title="逾期警示" 
              value={kpis?.overdueWarnings ?? 0} 
              icon={AlertTriangle}
              color={kpis?.overdueWarnings && kpis.overdueWarnings > 0 ? 'amber' : 'emerald'}
              onClick={() => navigate('/projects?risk=true')}
            />
            <KPICard 
              title="平均週期" 
              value={kpis?.avgCycleDays ? `${kpis.avgCycleDays} 天` : '— 天'} 
              icon={Scale}
              color="teal"
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="案場列表"
          description="檢視所有案場工程進度"
          icon={Building2}
          color="blue"
          onClick={() => navigate('/projects')}
        />
        <QuickActionCard
          title="進度比較"
          description="跨案場時程分析與比對"
          icon={Scale}
          color="amber"
          onClick={() => navigate('/projects/compare')}
        />
        <QuickActionCard
          title="施工夥伴"
          description="管理合作廠商與派工"
          icon={Users}
          color="emerald"
          onClick={() => navigate('/partners')}
        />
      </div>

      {/* Action Required Section */}
      <ActionRequiredCard
        title="需關注案件"
        description="逾期或即將到期的里程碑"
        icon={AlertTriangle}
        iconColor="text-amber-500"
        emptyMessage="目前沒有需關注的案件"
      >
        {isLoadingRisk ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : riskProjects.length > 0 ? (
          <div className="space-y-2">
            {riskProjects.map((project) => (
              <ActionItem
                key={project.project_id}
                title={project.project_name}
                subtitle={`${project.investor_code || '-'} · ${project.current_project_status} · ${(project.overall_progress_percent ?? 0).toFixed(0)}%`}
                icon={AlertTriangle}
                status="warning"
                onClick={() => navigate(`/projects/${project.project_id}`)}
              />
            ))}
            {remainingCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => navigate('/projects?risk=true')}
              >
                查看其他 {remainingCount} 個風險案場
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        ) : null}
      </ActionRequiredCard>
    </div>
  );
}
