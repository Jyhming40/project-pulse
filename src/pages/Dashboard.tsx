import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useProgressSettings } from '@/hooks/useProgressManagement';
import { 
  Building2, 
  Zap, 
  CheckCircle2, 
  Clock, 
  PauseCircle,
  Filter,
  TrendingUp,
  Target,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
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

// Project status order for chart display
const PROJECT_STATUS_ORDER = [
  '開發中', '土地確認', '結構簽證', '台電送件', '台電審查', 
  '能源局送件', '同意備案', '工程施工', '報竣掛表', '設備登記', '運維中'
];

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Fetch progress settings for alert thresholds
  const { data: progressSettings = [] } = useProgressSettings();
  const alertSetting = progressSettings.find(s => s.setting_key === 'alert_thresholds');
  const alertThresholds = useMemo(() => ({
    months_threshold: (alertSetting?.setting_value?.months_threshold ?? 6) as number,
    min_progress_old_project: (alertSetting?.setting_value?.min_progress_old_project ?? 25) as number,
    min_progress_late_stage: (alertSetting?.setting_value?.min_progress_late_stage ?? 50) as number,
    late_stages: (alertSetting?.setting_value?.late_stages ?? ['台電審查', '能源局送件', '同意備案', '工程施工', '報竣掛表']) as string[],
    max_display_count: (alertSetting?.setting_value?.max_display_count ?? 5) as number,
  }), [alertSetting]);
  
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

  // Calculate Progress Statistics
  const progressStats = useMemo(() => {
    const validProjects = filteredProjects.filter(p => !['暫緩', '取消'].includes(p.status));
    const total = validProjects.length;
    
    if (total === 0) {
      return {
        avgOverall: 0,
        avgAdmin: 0,
        avgEngineering: 0,
        distribution: { notStarted: 0, early: 0, midway: 0, advanced: 0, completed: 0 },
        distributionPercent: { notStarted: 0, early: 0, midway: 0, advanced: 0, completed: 0 },
      };
    }

    const avgOverall = validProjects.reduce((sum, p) => sum + (Number(p.overall_progress) || 0), 0) / total;
    const avgAdmin = validProjects.reduce((sum, p) => sum + (Number(p.admin_progress) || 0), 0) / total;
    const avgEngineering = validProjects.reduce((sum, p) => sum + (Number(p.engineering_progress) || 0), 0) / total;

    // Progress distribution buckets
    const distribution = {
      notStarted: 0, // 0%
      early: 0,      // 1-25%
      midway: 0,     // 26-50%
      advanced: 0,   // 51-75%
      completed: 0,  // 76-100%
    };

    validProjects.forEach(p => {
      const progress = Number(p.overall_progress) || 0;
      if (progress === 0) distribution.notStarted++;
      else if (progress <= 25) distribution.early++;
      else if (progress <= 50) distribution.midway++;
      else if (progress <= 75) distribution.advanced++;
      else distribution.completed++;
    });

    const distributionPercent = {
      notStarted: (distribution.notStarted / total) * 100,
      early: (distribution.early / total) * 100,
      midway: (distribution.midway / total) * 100,
      advanced: (distribution.advanced / total) * 100,
      completed: (distribution.completed / total) * 100,
    };

    return {
      avgOverall,
      avgAdmin,
      avgEngineering,
      distribution,
      distributionPercent,
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

  // Chart 4: Project status distribution (new)
  const projectStatusData = useMemo(() => {
    const statusData: Record<string, { count: number; capacity: number }> = {};
    
    // Initialize all statuses
    PROJECT_STATUS_ORDER.forEach(status => {
      statusData[status] = { count: 0, capacity: 0 };
    });
    
    filteredProjects.forEach(p => {
      const status = p.status;
      // Only count non-suspended/cancelled projects
      if (!['暫停', '取消'].includes(status)) {
        if (statusData[status]) {
          statusData[status].count += 1;
          statusData[status].capacity += p.capacity_kwp || 0;
        }
      }
    });

    return PROJECT_STATUS_ORDER
      .map(status => ({
        name: status,
        count: statusData[status]?.count || 0,
        capacity: Math.round((statusData[status]?.capacity || 0) * 10) / 10,
      }))
      .filter(item => item.count > 0);
  }, [filteredProjects]);

  // Progress behind alert - projects with low progress compared to expected (using configurable thresholds)
  const behindProjects = useMemo(() => {
    const now = new Date();
    const thresholdDate = new Date(now);
    thresholdDate.setMonth(now.getMonth() - alertThresholds.months_threshold);
    
    return filteredProjects
      .filter(p => {
        // Exclude suspended/cancelled projects
        if (['暫停', '取消'].includes(p.status)) return false;
        
        // Projects created more than threshold months ago with less than min progress
        const createdDate = new Date(p.created_at);
        const progress = Number(p.overall_progress) || 0;
        
        if (createdDate < thresholdDate && progress < alertThresholds.min_progress_old_project) return true;
        
        // Projects in late stages but with low progress
        if (alertThresholds.late_stages.includes(p.status) && progress < alertThresholds.min_progress_late_stage) return true;
        
        return false;
      })
      .sort((a, b) => (Number(a.overall_progress) || 0) - (Number(b.overall_progress) || 0))
      .slice(0, alertThresholds.max_display_count);
  }, [filteredProjects, alertThresholds]);

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

      {/* Progress Statistics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Average Progress Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              平均進度
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">總體進度</span>
                <span className="font-medium">{progressStats.avgOverall.toFixed(1)}%</span>
              </div>
              <Progress value={progressStats.avgOverall} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">行政進度</span>
                <span className="font-medium">{progressStats.avgAdmin.toFixed(1)}%</span>
              </div>
              <Progress value={progressStats.avgAdmin} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">工程進度</span>
                <span className="font-medium">{progressStats.avgEngineering.toFixed(1)}%</span>
              </div>
              <Progress value={progressStats.avgEngineering} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Progress Distribution Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              進度分布統計
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-muted-foreground">{progressStats.distribution.notStarted}</div>
                <div className="text-xs text-muted-foreground mt-1">未開始</div>
                <div className="text-[10px] text-muted-foreground">(0%)</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-destructive/10">
                <div className="text-2xl font-bold text-destructive">{progressStats.distribution.early}</div>
                <div className="text-xs text-muted-foreground mt-1">初期</div>
                <div className="text-[10px] text-muted-foreground">(1-25%)</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-warning/10">
                <div className="text-2xl font-bold text-warning">{progressStats.distribution.midway}</div>
                <div className="text-xs text-muted-foreground mt-1">進行中</div>
                <div className="text-[10px] text-muted-foreground">(26-50%)</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-info/10">
                <div className="text-2xl font-bold text-info">{progressStats.distribution.advanced}</div>
                <div className="text-xs text-muted-foreground mt-1">後期</div>
                <div className="text-[10px] text-muted-foreground">(51-75%)</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-success/10">
                <div className="text-2xl font-bold text-success">{progressStats.distribution.completed}</div>
                <div className="text-xs text-muted-foreground mt-1">即將完成</div>
                <div className="text-[10px] text-muted-foreground">(76-100%)</div>
              </div>
            </div>
            
            {/* Stacked bar visualization */}
            <div className="mt-4">
              <div className="h-4 rounded-full overflow-hidden flex bg-muted/30">
                {progressStats.distributionPercent.notStarted > 0 && (
                  <div 
                    className="bg-muted-foreground/40 transition-all" 
                    style={{ width: `${progressStats.distributionPercent.notStarted}%` }}
                    title={`未開始: ${progressStats.distribution.notStarted}件`}
                  />
                )}
                {progressStats.distributionPercent.early > 0 && (
                  <div 
                    className="bg-destructive transition-all" 
                    style={{ width: `${progressStats.distributionPercent.early}%` }}
                    title={`初期: ${progressStats.distribution.early}件`}
                  />
                )}
                {progressStats.distributionPercent.midway > 0 && (
                  <div 
                    className="bg-warning transition-all" 
                    style={{ width: `${progressStats.distributionPercent.midway}%` }}
                    title={`進行中: ${progressStats.distribution.midway}件`}
                  />
                )}
                {progressStats.distributionPercent.advanced > 0 && (
                  <div 
                    className="bg-info transition-all" 
                    style={{ width: `${progressStats.distributionPercent.advanced}%` }}
                    title={`後期: ${progressStats.distribution.advanced}件`}
                  />
                )}
                {progressStats.distributionPercent.completed > 0 && (
                  <div 
                    className="bg-success transition-all" 
                    style={{ width: `${progressStats.distributionPercent.completed}%` }}
                    title={`即將完成: ${progressStats.distribution.completed}件`}
                  />
                )}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Behind Alert + Project Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Behind Alert */}
        <Card className="border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              進度落後警示
            </CardTitle>
          </CardHeader>
          <CardContent>
            {behindProjects.length > 0 ? (
              <div className="space-y-3">
                {behindProjects.map((project) => {
                  const investor = project.investors as { investor_code: string; company_name: string } | null;
                  const progress = Number(project.overall_progress) || 0;
                  
                  return (
                    <div 
                      key={project.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20 hover:bg-warning/10 transition-colors cursor-pointer"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{project.project_name}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{investor?.investor_code || '-'}</span>
                          <span>•</span>
                          <span>{project.status}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="w-20">
                          <Progress value={progress} className="h-2" />
                        </div>
                        <span className={`text-sm font-medium ${progress < 25 ? 'text-destructive' : 'text-warning'}`}>
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 text-success mb-2" />
                <p className="text-sm">所有案場進度正常</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">案場狀態分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {projectStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectStatusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 10 }} 
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name) => [
                        value,
                        '案件數'
                      ]}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]} 
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
