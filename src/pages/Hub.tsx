import { useNavigate } from 'react-router-dom';
import { useAppSettingsRead } from '@/hooks/useAppSettings';
import { 
  Briefcase, 
  HardHat, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  ArrowRight,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModuleCard {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  path: string;
  color: string;
  bgGradient: string;
}

const modules: ModuleCard[] = [
  {
    id: 'sales',
    title: '接案與報價',
    subtitle: 'Sales',
    description: '案源追蹤、報價管理、成交機率評估',
    icon: Briefcase,
    path: '/modules/sales',
    color: 'text-blue-600 dark:text-blue-400',
    bgGradient: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10',
  },
  {
    id: 'execution',
    title: '工程與行政',
    subtitle: 'Execution',
    description: '時程管理、里程碑追蹤、多單位協調',
    icon: HardHat,
    path: '/modules/execution',
    color: 'text-amber-600 dark:text-amber-400',
    bgGradient: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10',
  },
  {
    id: 'governance',
    title: '文件治理',
    subtitle: 'Governance',
    description: '版本控管、歸檔管理、法規遵循',
    icon: FileText,
    path: '/modules/governance',
    color: 'text-teal-600 dark:text-teal-400',
    bgGradient: 'from-teal-500/10 to-teal-600/5 hover:from-teal-500/20 hover:to-teal-600/10',
  },
  {
    id: 'finance',
    title: '財務與投資',
    subtitle: 'Finance',
    description: 'ROI 分析、現金流追蹤、收益管理',
    icon: TrendingUp,
    path: '/modules/finance',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgGradient: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10',
  },
  {
    id: 'risk',
    title: '風險與爭議',
    subtitle: 'Risk & Legal',
    description: '證據管理、爭議日誌、法律狀態追蹤',
    icon: AlertTriangle,
    path: '/modules/risk',
    color: 'text-rose-600 dark:text-rose-400',
    bgGradient: 'from-rose-500/10 to-rose-600/5 hover:from-rose-500/20 hover:to-rose-600/10',
  },
];

export default function Hub() {
  const navigate = useNavigate();
  const { settings } = useAppSettingsRead();

  const systemName = settings?.company_name_zh || '明群環能';

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
          <Zap className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
          {systemName} 營運指揮中心
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          選擇您要進行的工作模組，開始今日任務
        </p>
      </div>

      {/* Module Cards Grid */}
      <div className="flex-1 px-4 pb-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.id}
                onClick={() => navigate(module.path)}
                className={cn(
                  "group relative p-8 rounded-2xl border border-border bg-gradient-to-br transition-all duration-300",
                  "hover:shadow-lg hover:border-primary/30 hover:-translate-y-1",
                  "text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  module.bgGradient
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "inline-flex items-center justify-center w-14 h-14 rounded-xl mb-6",
                  "bg-background/80 shadow-sm",
                  module.color
                )}>
                  <Icon className="w-7 h-7" />
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {module.title}
                    </h2>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {module.subtitle}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {module.description}
                  </p>
                </div>

                {/* Arrow indicator */}
                <div className={cn(
                  "absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity",
                  module.color
                )}>
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="border-t border-border bg-muted/30 py-6 px-4">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-8 text-center">
          <QuickStat label="進行中案件" value="—" />
          <QuickStat label="待辦事項" value="—" />
          <QuickStat label="本月完成" value="—" />
          <QuickStat label="異常警示" value="—" highlight />
        </div>
      </div>
    </div>
  );
}

function QuickStat({ 
  label, 
  value, 
  highlight = false 
}: { 
  label: string; 
  value: string | number; 
  highlight?: boolean;
}) {
  return (
    <div className="px-4">
      <p className={cn(
        "text-2xl font-bold",
        highlight ? "text-destructive" : "text-foreground"
      )}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
