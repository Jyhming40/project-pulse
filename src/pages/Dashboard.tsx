import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Filter,
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
  QuickAccessSection,
  AdministrativeSection,
  EngineeringSection,
  RiskSection,
  ProgressOverviewCards,
  StatusDistributionChart,
  RiskProjectsList,
} from '@/components/dashboard';
import { useAnalyticsSummary, useRiskProjects } from '@/hooks/useProjectAnalytics';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  
  // Filter states
  const [selectedInvestor, setSelectedInvestor] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedConstructionStatus, setSelectedConstructionStatus] = useState<string>('all');

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

  // Reset filters
  const resetFilters = () => {
    setSelectedInvestor('all');
    setSelectedStatus('all');
    setSelectedConstructionStatus('all');
  };

  const hasActiveFilters = selectedInvestor !== 'all' || selectedStatus !== 'all' || selectedConstructionStatus !== 'all';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">儀表板</h1>
        <p className="text-muted-foreground mt-1">每日作戰圖 — 行政推進、工程進度、風險追蹤</p>
      </div>

      {/* Progress Overview Cards */}
      <ProgressOverviewCards
        totalProjects={summary?.total_projects ?? 0}
        atRiskCount={summary?.at_risk_count ?? 0}
        averageProgress={summary?.average_progress ?? 0}
        averageAdminProgress={summary?.average_admin_progress ?? 0}
        averageEngineeringProgress={summary?.average_engineering_progress ?? 0}
        isLoading={summaryLoading}
      />

      {/* Charts and Risk List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
        <RiskProjectsList
          projects={riskProjects}
          isLoading={riskLoading}
          limit={5}
        />
      </div>

      {/* Quick Access */}
      <QuickAccessSection />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Filter className="w-4 h-4" />
              篩選條件
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                清除篩選
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">投資方</Label>
              <Select value={selectedInvestor} onValueChange={setSelectedInvestor}>
                <SelectTrigger>
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

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">案場狀態</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
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

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">施工狀態</Label>
              <Select value={selectedConstructionStatus} onValueChange={setSelectedConstructionStatus}>
                <SelectTrigger>
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
        </CardContent>
      </Card>

      {/* Main Tabs: 行政 / 工程 / 風險 */}
      <Tabs defaultValue="admin" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="admin">行政區</TabsTrigger>
          <TabsTrigger value="engineering">工程區</TabsTrigger>
          <TabsTrigger value="risk">風險區</TabsTrigger>
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
      </Tabs>
    </div>
  );
}