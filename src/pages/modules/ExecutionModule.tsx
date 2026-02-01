import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  HardHat, 
  Building2, 
  Scale, 
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users
} from 'lucide-react';

export default function ExecutionModule() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <HardHat className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-2xl font-display font-bold">工程與行政</h1>
            <Badge variant="outline" className="text-xs">Execution</Badge>
          </div>
          <p className="text-muted-foreground">
            時程管理、里程碑追蹤、多單位協調
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard 
          title="進行中案件" 
          value="—" 
          icon={Clock}
          color="blue"
        />
        <KPICard 
          title="本月完成" 
          value="—" 
          icon={CheckCircle2}
          color="emerald"
        />
        <KPICard 
          title="逾期警示" 
          value="—" 
          icon={AlertTriangle}
          color="amber"
        />
        <KPICard 
          title="平均週期" 
          value="— 天" 
          icon={Scale}
          color="teal"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="案場列表"
          description="檢視所有案場工程進度"
          icon={Building2}
          onClick={() => navigate('/projects')}
        />
        <QuickActionCard
          title="進度比較"
          description="跨案場時程分析與比對"
          icon={Scale}
          onClick={() => navigate('/projects/compare')}
        />
        <QuickActionCard
          title="施工夥伴"
          description="管理合作廠商與派工"
          icon={Users}
          onClick={() => navigate('/partners')}
        />
      </div>

      {/* Action Required Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="w-5 h-5 text-warning" />
            需關注案件
          </CardTitle>
          <CardDescription>逾期或即將到期的里程碑</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>目前沒有需關注的案件</p>
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
  color
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  color: 'blue' | 'emerald' | 'amber' | 'teal';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-5 h-5" />
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
