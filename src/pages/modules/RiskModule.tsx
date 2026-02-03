import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertTriangle, 
  Shield, 
  FileWarning, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Scale,
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
import { useRiskKPIs } from '@/hooks/useModuleKPIs';
import { Button } from '@/components/ui/button';

// Hook to get risk projects with detailed info
function useRiskProjectsDetail(limit = 5) {
  return useQuery({
    queryKey: ['risk-projects-detail', limit],
    queryFn: async () => {
      const activeStatuses = ['開發中', '台電送件', '台電審查', '同意備案', '設備登記', '工程施工', '報竣掛表'];
      
      const { data, error } = await supabase
        .from('project_analytics_view')
        .select('project_id, project_name, project_code, current_project_status, overall_progress_percent, has_risk, risk_reasons, updated_at, investor_code')
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

// Hook to get active disputes
function useActiveDisputes(limit = 3) {
  return useQuery({
    queryKey: ['active-disputes', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_issues')
        .select(`
          id,
          issue_type,
          description,
          severity,
          start_date,
          project_id,
          projects:project_id (
            project_name,
            project_code
          )
        `)
        .eq('issue_type', 'dispute')
        .eq('is_resolved', false)
        .order('start_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function RiskModule() {
  const navigate = useNavigate();
  const { data: kpis, isLoading } = useRiskKPIs();
  const { data: riskProjects = [], isLoading: isLoadingRisk } = useRiskProjectsDetail(5);
  const { data: disputes = [], isLoading: isLoadingDisputes } = useActiveDisputes(3);

  const totalRiskCount = kpis?.riskProjects ?? 0;
  const remainingRiskCount = Math.max(0, totalRiskCount - riskProjects.length);

  const getSeverityLabel = (severity: string | null) => {
    const labels: Record<string, string> = {
      high: '高',
      medium: '中',
      low: '低',
    };
    return severity ? labels[severity] || severity : '未設定';
  };

  const formatRiskReasons = (reasons: string[] | null) => {
    if (!reasons || reasons.length === 0) return '風險標記';
    return reasons.slice(0, 2).join('、');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <WorkspaceHeader
        title="風險與爭議"
        subtitle="證據管理、爭議日誌、法律狀態追蹤"
        icon={AlertTriangle}
        badge="Risk & Legal"
        color="rose"
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
              title="風險案件" 
              value={kpis?.riskProjects ?? 0} 
              icon={AlertTriangle}
              color={kpis?.riskProjects && kpis.riskProjects > 0 ? 'rose' : 'emerald'}
              onClick={() => navigate('/projects?risk=true')}
            />
            <KPICard 
              title="進行中爭議" 
              value={kpis?.ongoingDisputes ?? 0} 
              icon={Scale}
              color={kpis?.ongoingDisputes && kpis.ongoingDisputes > 0 ? 'amber' : 'emerald'}
            />
            <KPICard 
              title="待處理" 
              value={kpis?.pendingIssues ?? 0} 
              icon={Clock}
              color="blue"
            />
            <KPICard 
              title="已解決" 
              value={kpis?.resolvedIssues ?? 0} 
              icon={CheckCircle2}
              color="emerald"
              trend={kpis?.resolvedIssues && kpis.resolvedIssues > 0 ? 'up' : 'neutral'}
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="風險案件列表"
          description="檢視所有標記為風險的案件"
          icon={AlertCircle}
          color="rose"
          onClick={() => navigate('/projects?risk=true')}
        />
        <QuickActionCard
          title="爭議管理"
          description="管理案件爭議與處理進度"
          icon={Scale}
          color="amber"
          onClick={() => navigate('/projects')}
        />
        <QuickActionCard
          title="文件證據"
          description="相關證據文件管理"
          icon={FileWarning}
          color="teal"
          onClick={() => navigate('/documents')}
        />
      </div>

      {/* Risk Overview Section */}
      <ActionRequiredCard
        title="風險總覽"
        description="系統風險狀態摘要"
        icon={Shield}
        iconColor="text-primary"
        emptyMessage="目前沒有標記為風險的案件"
      >
        {isLoadingRisk || isLoadingDisputes ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (riskProjects.length > 0 || disputes.length > 0) ? (
          <div className="space-y-4">
            {/* Risk Projects */}
            {riskProjects.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">風險案件</p>
                {riskProjects.map((project) => (
                  <ActionItem
                    key={project.project_id}
                    title={project.project_name}
                    subtitle={`${project.investor_code || '-'} · ${project.current_project_status} · ${(project.overall_progress_percent ?? 0).toFixed(0)}% · ${formatRiskReasons(project.risk_reasons)}`}
                    icon={AlertTriangle}
                    status="danger"
                    onClick={() => navigate(`/projects/${project.project_id}`)}
                  />
                ))}
                {remainingRiskCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-1 text-xs"
                    onClick={() => navigate('/projects?risk=true')}
                  >
                    查看其他 {remainingRiskCount} 個風險案場
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            )}

            {/* Active Disputes */}
            {disputes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">進行中爭議</p>
                {disputes.map((dispute) => {
                  const projectName = (dispute.projects as any)?.project_name || '未指定案場';
                  
                  return (
                    <ActionItem
                      key={dispute.id}
                      title={`${projectName}`}
                      subtitle={`${dispute.description || '爭議案件'} · 嚴重程度: ${getSeverityLabel(dispute.severity)}`}
                      icon={Scale}
                      status="warning"
                      onClick={() => navigate(`/projects/${dispute.project_id}`)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </ActionRequiredCard>
    </div>
  );
}
