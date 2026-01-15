import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Filter,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  QuickAccessCompact,
  AdministrativeSection,
  EngineeringSection,
  RiskSection,
  StatusDistributionChart,
  ActionRequiredSection,
  HealthKPICards,
  PhaseOverviewSection,
  Phase2TracksSection,
} from '@/components/dashboard';
import { DashboardSettingsPanel } from '@/components/dashboard/DashboardSettingsPanel';
import { useAnalyticsSummary, useRiskProjects } from '@/hooks/useProjectAnalytics';
import { useDashboardSettings, DashboardSection } from '@/hooks/useDashboardSettings';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const { settings, isLoading: settingsLoading } = useDashboardSettings();
  
  // Filter states - 初始化為預設篩選條件
  const [selectedInvestor, setSelectedInvestor] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedConstructionStatus, setSelectedConstructionStatus] = useState<string>('all');
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // 當設定載入完成時，套用預設篩選條件
  useEffect(() => {
    if (!settingsLoading && !filtersInitialized && settings.defaultFilters) {
      setSelectedInvestor(settings.defaultFilters.investor || 'all');
      setSelectedStatus(settings.defaultFilters.status || 'all');
      setSelectedConstructionStatus(settings.defaultFilters.constructionStatus || 'all');
      setFiltersInitialized(true);
    }
  }, [settings.defaultFilters, settingsLoading, filtersInitialized]);

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

  // Fetch investors for filter dropdown
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

  // Compute filter options
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

  // Apply filters
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (selectedInvestor !== 'all' && p.investor_id !== selectedInvestor) return false;
      if (selectedStatus !== 'all' && p.status !== selectedStatus) return false;
      if (selectedConstructionStatus !== 'all' && p.construction_status !== selectedConstructionStatus) return false;
      return true;
    });
  }, [projects, selectedInvestor, selectedStatus, selectedConstructionStatus]);

  // Pending fix count
  const pendingFixCount = useMemo(() => {
    return projects.filter(p => p.status === '台電審查').length;
  }, [projects]);

  // Reset filters
  const resetFilters = () => {
    setSelectedInvestor('all');
    setSelectedStatus('all');
    setSelectedConstructionStatus('all');
  };

  const hasActiveFilters = selectedInvestor !== 'all' || selectedStatus !== 'all' || selectedConstructionStatus !== 'all';

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
          <Card key={section.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  進階分析
                </CardTitle>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    清除篩選
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">投資方</Label>
                  <Select value={selectedInvestor} onValueChange={setSelectedInvestor}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="全部" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部投資方</SelectItem>
                      {investors.map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>
                          [{inv.investor_code}] {inv.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">案場狀態</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="全部" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部狀態</SelectItem>
                      {filterOptions.statuses.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">施工狀態</Label>
                  <Select value={selectedConstructionStatus} onValueChange={setSelectedConstructionStatus}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="全部" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部狀態</SelectItem>
                      {filterOptions.constructionStatuses.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="admin" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="admin">行政</TabsTrigger>
                  <TabsTrigger value="engineering">工程</TabsTrigger>
                  <TabsTrigger value="risk">風險</TabsTrigger>
                  <TabsTrigger value="charts" className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    分佈圖
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="admin">
                  <AdministrativeSection projects={filteredProjects as any} />
                </TabsContent>

                <TabsContent value="engineering">
                  <EngineeringSection projects={filteredProjects as any} />
                </TabsContent>

                <TabsContent value="risk">
                  <RiskSection projects={filteredProjects as any} />
                </TabsContent>

                {/* Charts moved to a separate tab */}
                <TabsContent value="charts">
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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
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
