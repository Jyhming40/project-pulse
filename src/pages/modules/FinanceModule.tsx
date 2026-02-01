import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Receipt, 
  Wallet, 
  ArrowRight,
  DollarSign,
  BarChart3,
  PiggyBank,
  AlertCircle
} from 'lucide-react';

export default function FinanceModule() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-display font-bold">財務與投資</h1>
            <Badge variant="outline" className="text-xs">Finance</Badge>
          </div>
          <p className="text-muted-foreground">
            ROI 分析、現金流追蹤、收益管理
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard 
          title="總投資額" 
          value="—" 
          icon={DollarSign}
          color="emerald"
        />
        <KPICard 
          title="預期年收益" 
          value="—" 
          icon={TrendingUp}
          color="blue"
        />
        <KPICard 
          title="平均 IRR" 
          value="—%" 
          icon={BarChart3}
          color="teal"
        />
        <KPICard 
          title="待收款項" 
          value="—" 
          icon={PiggyBank}
          color="amber"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="報價財務分析"
          description="檢視報價單的投資分析"
          icon={Receipt}
          onClick={() => navigate('/quotes')}
        />
        <QuickActionCard
          title="案場財務資訊"
          description="各案場投資與收益追蹤"
          icon={Wallet}
          onClick={() => navigate('/projects')}
        />
        <QuickActionCard
          title="業務單位"
          description="客戶應收帳款管理"
          icon={DollarSign}
          onClick={() => navigate('/investors')}
        />
      </div>

      {/* Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="w-5 h-5 text-info" />
            財務摘要
          </CardTitle>
          <CardDescription>投資組合整體表現</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>財務摘要功能開發中</p>
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
