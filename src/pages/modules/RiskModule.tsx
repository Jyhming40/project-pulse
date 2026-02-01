import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Shield, 
  FileWarning, 
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Scale
} from 'lucide-react';

export default function RiskModule() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-rose-500/10">
              <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <h1 className="text-2xl font-display font-bold">風險與爭議</h1>
            <Badge variant="outline" className="text-xs">Risk & Legal</Badge>
          </div>
          <p className="text-muted-foreground">
            證據管理、爭議日誌、法律狀態追蹤
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard 
          title="風險案件" 
          value="—" 
          icon={AlertTriangle}
          color="rose"
        />
        <KPICard 
          title="進行中爭議" 
          value="—" 
          icon={Scale}
          color="amber"
        />
        <KPICard 
          title="待處理" 
          value="—" 
          icon={Clock}
          color="blue"
        />
        <KPICard 
          title="已解決" 
          value="—" 
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="風險案件列表"
          description="檢視所有標記為風險的案件"
          icon={AlertCircle}
          onClick={() => navigate('/projects?risk=true')}
        />
        <QuickActionCard
          title="爭議管理"
          description="管理案件爭議與處理進度"
          icon={Scale}
          onClick={() => navigate('/projects')}
        />
        <QuickActionCard
          title="文件證據"
          description="相關證據文件管理"
          icon={FileWarning}
          onClick={() => navigate('/documents')}
        />
      </div>

      {/* Risk Overview Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            風險總覽
          </CardTitle>
          <CardDescription>系統風險狀態摘要</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>目前沒有標記為風險的案件</p>
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
  color: 'blue' | 'emerald' | 'amber' | 'rose';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
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
