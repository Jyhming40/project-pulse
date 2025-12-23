import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  Zap, 
  CheckCircle2, 
  Clock, 
  PauseCircle,
  Filter
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
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const COLORS = [
  'hsl(173, 58%, 39%)', 
  'hsl(210, 70%, 50%)', 
  'hsl(38, 92%, 50%)', 
  'hsl(142, 72%, 40%)', 
  'hsl(280, 60%, 50%)', 
  'hsl(0, 72%, 51%)',
  'hsl(190, 70%, 45%)',
  'hsl(320, 60%, 50%)',
  'hsl(60, 70%, 45%)',
  'hsl(100, 50%, 45%)'
];

type MetricType = 'count' | 'capacity';

export default function Dashboard() {
  // Filter states
  const [selectedInvestor, setSelectedInvestor] = useState<string>('all');
  const [selectedIntakeYear, setSelectedIntakeYear] = useState<string>('all');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('all');
  const [selectedConstructionStatus, setSelectedConstructionStatus] = useState<string>('all');
  const [trendMetric, setTrendMetric] = useState<MetricType>('count');
  const [investorMetric, setInvestorMetric] = useState<MetricType>('count');

  // Fetch projects with investors
  const { data: projects = [] } = useQuery({
    queryKey: ['dashboard-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, investors(id, company_name, investor_code)');
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
        .order('investor_code');
      if (error) throw error;
      return data;
    },
  });

  // Compute available filter options
  const filterOptions = useMemo(() => {
    const intakeYears = new Set<number>();
    const fiscalYears = new Set<number>();
    const constructionStatuses = new Set<string>();

    projects.forEach(p => {
      if (p.intake_year) intakeYears.add(p.intake_year);
      if (p.fiscal_year) fiscalYears.add(p.fiscal_year);
      if (p.construction_status) constructionStatuses.add(p.construction_status);
    });

    return {
      intakeYears: Array.from(intakeYears).sort((a, b) => b - a),
      fiscalYears: Array.from(fiscalYears).sort((a, b) => b - a),
      constructionStatuses: Array.from(constructionStatuses),
    };
  }, [projects]);

  // Apply filters
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (selectedInvestor !== 'all' && p.investor_id !== selectedInvestor) return false;
      if (selectedIntakeYear !== 'all' && p.intake_year !== parseInt(selectedIntakeYear)) return false;
      if (selectedFiscalYear !== 'all' && p.fiscal_year !== parseInt(selectedFiscalYear)) return false;
      if (selectedConstructionStatus !== 'all' && p.construction_status !== selectedConstructionStatus) return false;
      return true;
    });
  }, [projects, selectedInvestor, selectedIntakeYear, selectedFiscalYear, selectedConstructionStatus]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const total = filteredProjects.length;
    const totalCapacity = filteredProjects.reduce((sum, p) => sum + (p.capacity_kwp || 0), 0);
    const completed = filteredProjects.filter(p => p.approval_date !== null).length;
    const inProgress = filteredProjects.filter(p => p.approval_date === null && !['暫緩', '取消'].includes(p.status)).length;
    const suspendedOrCancelled = filteredProjects.filter(p => ['暫緩', '取消'].includes(p.status)).length;

    return {
      total,
      totalCapacity,
      completed,
      inProgress,
      suspendedOrCancelled,
    };
  }, [filteredProjects]);

  // Chart 1: Annual performance trend
  const annualTrendData = useMemo(() => {
    const yearData: Record<number, { count: number; capacity: number }> = {};
    
    filteredProjects.forEach(p => {
      if (p.fiscal_year) {
        if (!yearData[p.fiscal_year]) {
          yearData[p.fiscal_year] = { count: 0, capacity: 0 };
        }
        yearData[p.fiscal_year].count += 1;
        yearData[p.fiscal_year].capacity += p.capacity_kwp || 0;
      }
    });

    return Object.entries(yearData)
      .map(([year, data]) => ({
        year: `${year}年`,
        yearNum: parseInt(year),
        count: data.count,
        capacity: Math.round(data.capacity * 10) / 10,
      }))
      .sort((a, b) => a.yearNum - b.yearNum);
  }, [filteredProjects]);

  // Chart 2: Investor distribution
  const investorDistributionData = useMemo(() => {
    const investorData: Record<string, { name: string; count: number; capacity: number }> = {};
    
    filteredProjects.forEach(p => {
      const investor = p.investors as { id: string; company_name: string; investor_code: string } | null;
      const key = investor?.id || 'unknown';
      const name = investor?.company_name || '未指定';
      
      if (!investorData[key]) {
        investorData[key] = { name, count: 0, capacity: 0 };
      }
      investorData[key].count += 1;
      investorData[key].capacity += p.capacity_kwp || 0;
    });

    return Object.values(investorData)
      .map(data => ({
        name: data.name.length > 8 ? data.name.substring(0, 8) + '...' : data.name,
        fullName: data.name,
        count: data.count,
        capacity: Math.round(data.capacity * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredProjects]);

  // Chart 3: Construction status distribution
  const constructionStatusData = useMemo(() => {
    const statusData: Record<string, number> = {};
    
    filteredProjects.forEach(p => {
      const status = p.construction_status || '未設定';
      statusData[status] = (statusData[status] || 0) + 1;
    });

    return Object.entries(statusData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredProjects]);

  // Reset filters
  const resetFilters = () => {
    setSelectedInvestor('all');
    setSelectedIntakeYear('all');
    setSelectedFiscalYear('all');
    setSelectedConstructionStatus('all');
  };

  const hasActiveFilters = selectedInvestor !== 'all' || 
    selectedIntakeYear !== 'all' || 
    selectedFiscalYear !== 'all' || 
    selectedConstructionStatus !== 'all';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">儀表板</h1>
        <p className="text-muted-foreground mt-1">案場統計與業績分析</p>
      </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <Label className="text-xs text-muted-foreground">建檔年份</Label>
              <Select value={selectedIntakeYear} onValueChange={setSelectedIntakeYear}>
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部年份</SelectItem>
                  {filterOptions.intakeYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year} 年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">業績年度</Label>
              <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部年度</SelectItem>
                  {filterOptions.fiscalYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year} 年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">施工進度狀況</Label>
              <Select value={selectedConstructionStatus} onValueChange={setSelectedConstructionStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部狀態</SelectItem>
                  {filterOptions.constructionStatuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="kpi-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">案場總數</p>
                <p className="text-2xl font-bold text-foreground mt-1">{kpis.total}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="kpi-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">總裝置容量</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {kpis.totalCapacity.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">kWp</span>
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="kpi-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">成案件數</p>
                <p className="text-2xl font-bold text-foreground mt-1">{kpis.completed}</p>
                <p className="text-xs text-muted-foreground">有同意備案</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="kpi-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">在途案件數</p>
                <p className="text-2xl font-bold text-foreground mt-1">{kpis.inProgress}</p>
                <p className="text-xs text-muted-foreground">未備案</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="kpi-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">暫緩/取消</p>
                <p className="text-2xl font-bold text-foreground mt-1">{kpis.suspendedOrCancelled}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <PauseCircle className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Annual Performance Trend */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">年度業績趨勢</CardTitle>
              <Select value={trendMetric} onValueChange={(v: MetricType) => setTrendMetric(v)}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">案件數</SelectItem>
                  <SelectItem value="capacity">總 kWp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {annualTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={annualTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [
                        trendMetric === 'capacity' ? `${value.toLocaleString()} kWp` : value,
                        trendMetric === 'capacity' ? '總容量' : '案件數'
                      ]}
                    />
                    <Bar 
                      dataKey={trendMetric} 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  暫無業績資料
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Investor Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">投資方分布</CardTitle>
              <Select value={investorMetric} onValueChange={(v: MetricType) => setInvestorMetric(v)}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">案件數</SelectItem>
                  <SelectItem value="capacity">總 kWp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {investorDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={investorDistributionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 11 }} 
                      width={80}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, _name, props) => [
                        investorMetric === 'capacity' ? `${value.toLocaleString()} kWp` : value,
                        investorMetric === 'capacity' ? '總容量' : '案件數'
                      ]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                    />
                    <Bar 
                      dataKey={investorMetric} 
                      fill="hsl(var(--info))" 
                      radius={[0, 4, 4, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  暫無資料
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Construction Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">施工進度分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {constructionStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={constructionStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value, percent }) => 
                        `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                    >
                      {constructionStatusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  暫無資料
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">篩選結果摘要</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {hasActiveFilters ? (
                <p className="text-sm text-muted-foreground">
                  目前顯示符合篩選條件的 {filteredProjects.length} 筆案場
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  顯示全部 {projects.length} 筆案場
                </p>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">平均容量</p>
                  <p className="text-lg font-semibold">
                    {filteredProjects.length > 0 
                      ? (kpis.totalCapacity / filteredProjects.length).toFixed(1) 
                      : 0} kWp
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">成案率</p>
                  <p className="text-lg font-semibold">
                    {filteredProjects.length > 0 
                      ? ((kpis.completed / filteredProjects.length) * 100).toFixed(1) 
                      : 0}%
                  </p>
                </div>
              </div>

              {annualTrendData.length > 0 && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">業績年度分布</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {annualTrendData.map(item => (
                      <span 
                        key={item.yearNum} 
                        className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs"
                      >
                        {item.year}: {item.count}件
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
