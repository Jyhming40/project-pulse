import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Building2, 
  AlertTriangle, 
  Clock, 
  Activity,
  TrendingUp,
  FileText,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { format, subDays, isWithinInterval } from 'date-fns';
import { zhTW } from 'date-fns/locale';

const COLORS = ['hsl(173, 58%, 35%)', 'hsl(210, 70%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(142, 72%, 40%)', 'hsl(280, 60%, 50%)', 'hsl(0, 72%, 51%)'];

export default function Dashboard() {
  const { user } = useAuth();

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  // Fetch status history for this month
  const { data: statusHistory = [] } = useQuery({
    queryKey: ['status-history-month'],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('project_status_history')
        .select('*')
        .gte('changed_at', startOfMonth.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Fetch investors
  const { data: investors = [] } = useQuery({
    queryKey: ['investors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investors')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  // Calculate KPIs
  const activeProjects = projects.filter(p => 
    !['運維中', '暫停', '取消'].includes(p.status)
  ).length;

  const pendingDocs = documents.filter(d => d.doc_status === '退件補正').length;

  const upcomingDueDocs = documents.filter(d => {
    if (!d.due_at) return false;
    const dueDate = new Date(d.due_at);
    const today = new Date();
    const in14Days = subDays(new Date(), -14);
    return isWithinInterval(dueDate, { start: today, end: in14Days });
  }).length;

  const monthlyChanges = statusHistory.length;

  // Status distribution for pie chart
  const statusCounts: Record<string, number> = {};
  projects.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });
  const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // Document status distribution
  const docStatusCounts: Record<string, number> = {};
  documents.forEach(d => {
    docStatusCounts[d.doc_status] = (docStatusCounts[d.doc_status] || 0) + 1;
  });
  const docStatusDistribution = Object.entries(docStatusCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // Monthly trend (last 6 months)
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = format(date, 'yyyy-MM');
    const label = format(date, 'M月', { locale: zhTW });
    monthlyTrend.push({
      month: label,
      count: 0,
    });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">儀表板</h1>
        <p className="text-muted-foreground mt-1">系統總覽與關鍵指標</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="kpi-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">進行中案場</p>
                <p className="text-3xl font-bold text-foreground mt-1">{activeProjects}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="kpi-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">待補正文件</p>
                <p className="text-3xl font-bold text-foreground mt-1">{pendingDocs}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="kpi-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">即將到期 (14天內)</p>
                <p className="text-3xl font-bold text-foreground mt-1">{upcomingDueDocs}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="kpi-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">本月狀態變更</p>
                <p className="text-3xl font-bold text-foreground mt-1">{monthlyChanges}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{projects.length}</p>
              <p className="text-sm text-muted-foreground">總案場數</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{investors.length}</p>
              <p className="text-sm text-muted-foreground">投資方數</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{documents.length}</p>
              <p className="text-sm text-muted-foreground">文件總數</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">案場狀態分佈</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {statusDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
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

        {/* Document Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">文件狀態分佈</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {docStatusDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={docStatusDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
    </div>
  );
}
