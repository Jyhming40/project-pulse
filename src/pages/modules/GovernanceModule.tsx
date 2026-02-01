import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  FolderOpen, 
  Upload, 
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Archive
} from 'lucide-react';

export default function GovernanceModule() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <FileText className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <h1 className="text-2xl font-display font-bold">文件治理</h1>
            <Badge variant="outline" className="text-xs">Governance</Badge>
          </div>
          <p className="text-muted-foreground">
            版本控管、歸檔管理、法規遵循
          </p>
        </div>
        <Button onClick={() => navigate('/import-batch')}>
          <Upload className="w-4 h-4 mr-2" />
          批次匯入
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard 
          title="待送審文件" 
          value="—" 
          icon={Clock}
          color="amber"
        />
        <KPICard 
          title="已核准" 
          value="—" 
          icon={CheckCircle2}
          color="emerald"
        />
        <KPICard 
          title="即將到期" 
          value="—" 
          icon={AlertTriangle}
          color="rose"
        />
        <KPICard 
          title="已歸檔" 
          value="—" 
          icon={Archive}
          color="blue"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="文件管理"
          description="檢視與管理所有文件"
          icon={FileText}
          onClick={() => navigate('/documents')}
        />
        <QuickActionCard
          title="批次匯入"
          description="批量上傳與建立文件"
          icon={Upload}
          onClick={() => navigate('/import-batch')}
        />
        <QuickActionCard
          title="案場文件"
          description="依案場檢視相關文件"
          icon={FolderOpen}
          onClick={() => navigate('/projects')}
        />
      </div>

      {/* Action Required Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="w-5 h-5 text-warning" />
            待處理文件
          </CardTitle>
          <CardDescription>需要送審或更新的文件</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>目前沒有待處理文件</p>
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
  color: 'blue' | 'emerald' | 'amber' | 'teal' | 'rose';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
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
