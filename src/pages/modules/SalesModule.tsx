import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Briefcase, 
  Receipt, 
  Users, 
  ArrowRight,
  Plus,
  Clock,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export default function SalesModule() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Briefcase className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-display font-bold">接案與報價</h1>
            <Badge variant="outline" className="text-xs">Sales</Badge>
          </div>
          <p className="text-muted-foreground">
            管理案源、製作報價單、追蹤成交進度
          </p>
        </div>
        <Button onClick={() => navigate('/quotes/new')}>
          <Plus className="w-4 h-4 mr-2" />
          新增報價
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard 
          title="待報價案件" 
          value="—" 
          icon={Clock}
          trend="pending"
        />
        <KPICard 
          title="報價中" 
          value="—" 
          icon={Receipt}
          trend="neutral"
        />
        <KPICard 
          title="本月成交" 
          value="—" 
          icon={TrendingUp}
          trend="up"
        />
        <KPICard 
          title="成交率" 
          value="—%" 
          icon={Briefcase}
          trend="neutral"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="報價管理"
          description="檢視與編輯所有報價單"
          icon={Receipt}
          onClick={() => navigate('/quotes')}
        />
        <QuickActionCard
          title="業務單位"
          description="管理客戶與業務來源"
          icon={Users}
          onClick={() => navigate('/investors')}
        />
        <QuickActionCard
          title="案場列表"
          description="檢視所有案場進度"
          icon={Briefcase}
          onClick={() => navigate('/projects')}
        />
      </div>

      {/* Action Required Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="w-5 h-5 text-warning" />
            待處理事項
          </CardTitle>
          <CardDescription>需要您關注的案件與報價</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>目前沒有待處理事項</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ 
  title, 
  value, 
  icon: Icon,
  trend 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend: 'up' | 'down' | 'neutral' | 'pending';
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  onClick
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <Card 
      className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </CardContent>
    </Card>
  );
}
