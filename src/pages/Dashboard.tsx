import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import {
  QuickAccessCompact,
  StatusDistributionChart,
  ActionRequiredSection,
  HealthKPICards,
  PhaseOverviewSection,
  Phase2TracksSection,
  IssuesSummarySection,
  TaskDrivenAlerts,
} from '@/components/dashboard';
import { DashboardSettingsPanel } from '@/components/dashboard/DashboardSettingsPanel';
import { useAnalyticsSummary, useRiskProjects } from '@/hooks/useProjectAnalytics';
import { useDashboardSettings, DashboardSection } from '@/hooks/useDashboardSettings';

export default function Dashboard() {
  const { settings, isLoading: settingsLoading } = useDashboardSettings();
  
  // Analytics data
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary();
  const { data: riskProjects = [], isLoading: riskLoading } = useRiskProjects(10);

  // Fetch projects with investors
  const { data: projects = [] } = useQuery({
    queryKey: ['dashboard-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, investors(id, company_name, investor_code)')
        .eq('is_deleted', false);
      if (error) throw error;
      return data;
    },
  });

  // Fetch investors for filter dropdown (used in settings panel)
  const { data: investors = [] } = useQuery({
    queryKey: ['investors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investors')
        .select('*')
        .eq('is_deleted', false)
        .order('investor_code');
      if (error) throw error;
      return data;
    },
  });

  // Compute filter options for settings panel
  const filterOptions = useMemo(() => {
    const statuses = new Set<string>();
    const constructionStatuses = new Set<string>();

    projects.forEach(p => {
      if (p.status) statuses.add(p.status);
      if (p.construction_status) constructionStatuses.add(p.construction_status);
    });

    return {
      statuses: Array.from(statuses),
      constructionStatuses: Array.from(constructionStatuses),
    };
  }, [projects]);

  // Pending fix count
  const pendingFixCount = useMemo(() => {
    return projects.filter(p => p.status === '台電審查').length;
  }, [projects]);

  // 依據設定的順序和可見性渲染區塊
  const visibleSections = settings.sections
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order);

  // 區塊渲染映射
  const renderSection = (section: DashboardSection) => {
    switch (section.id) {
      case 'phase-overview':
        return <PhaseOverviewSection key={section.id} projects={projects as any} />;
      case 'phase2-tracks':
        return (
          <Phase2TracksSection 
            key={section.id}
            projects={projects as any} 
            isLoading={summaryLoading} 
          />
        );
      case 'health-kpis':
        return (
          <HealthKPICards
            key={section.id}
            totalProjects={summary?.total_projects ?? 0}
            atRiskCount={summary?.at_risk_count ?? 0}
            averageProgress={summary?.average_progress ?? 0}
            pendingFixCount={pendingFixCount}
            isLoading={summaryLoading}
          />
        );
      case 'issues-summary':
        return <IssuesSummarySection key={section.id} />;
      case 'action-required':
        return (
          <ActionRequiredSection
            key={section.id}
            riskProjects={riskProjects}
            allProjects={projects as any}
            isLoading={riskLoading}
            maxDisplayCount={5}
          />
        );
      case 'advanced-analysis':
        return (
          <div key={section.id} className="space-y-4">
            {/* Task-driven alerts - 任務導向警示 */}
            <TaskDrivenAlerts projects={projects as any} />
            
            {/* Distribution charts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  狀態分佈
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <StatusDistributionChart
                    title="案場狀態分佈"
                    distribution={summary?.status_distribution ?? {}}
                    isLoading={summaryLoading}
                  />
                  <StatusDistributionChart
                    title="施工狀態分佈"
                    distribution={summary?.construction_status_distribution ?? {}}
                    isLoading={summaryLoading}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Quick Access */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">儀表板</h1>
          <p className="text-muted-foreground text-sm mt-0.5">一眼掌握今日待處理事項</p>
        </div>
        <div className="flex items-center gap-2">
          <DashboardSettingsPanel
            investors={investors}
            statuses={filterOptions.statuses}
            constructionStatuses={filterOptions.constructionStatuses}
          />
          <QuickAccessCompact />
        </div>
      </div>

      {/* 依據使用者設定渲染區塊 */}
      {visibleSections.map(section => renderSection(section))}
    </div>
  );
}
