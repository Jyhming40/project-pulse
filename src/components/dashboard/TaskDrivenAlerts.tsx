import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileWarning,
  Clock,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  project_name: string;
  project_code?: string;
  status: string;
  construction_status: string | null;
  admin_progress: number | null;
  engineering_progress: number | null;
  overall_progress: number | null;
  updated_at: string;
  created_at: string;
  investors?: { investor_code: string; company_name: string } | null;
}

interface TaskDrivenAlertsProps {
  projects: Project[];
  maxItemsPerCategory?: number;
}

interface AlertCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: 'destructive' | 'warning' | 'info' | 'muted';
  projects: Array<Project & { reason?: string; daysStuck?: number }>;
  navigateUrl?: string;
}

// Excluded statuses - projects that don't need tracking
const EXCLUDED_STATUSES = ['暫停', '取消', '運維中', '已結案'];

export function TaskDrivenAlerts({ 
  projects, 
  maxItemsPerCategory = 3 
}: TaskDrivenAlertsProps) {
  const navigate = useNavigate();

  // Calculate alert categories
  const alertCategories = useMemo((): AlertCategory[] => {
    const now = new Date();
    const activeProjects = projects.filter(p => !EXCLUDED_STATUSES.includes(p.status));

    // Category 1: 待補件 (Pending Fix) - 審查中需要補件的案場
    const pendingFix = activeProjects
      .filter(p => p.status === '台電審查')
      .map(p => ({ ...p, reason: '等待補件回覆' }));

    // Category 2: 行政卡關 (Admin Stuck) - 超過14天未更新
    const adminStuck = activeProjects
      .filter(p => {
        const daysSinceUpdate = Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceUpdate >= 14;
      })
      .map(p => {
        const daysStuck = Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24));
        return { ...p, daysStuck, reason: `${daysStuck} 天未更新` };
      })
      .sort((a, b) => (b.daysStuck || 0) - (a.daysStuck || 0));

    // Category 3: 施工延遲 (Construction Delay) - 已開工但進度低
    const constructionDelay = activeProjects
      .filter(p => {
        if (p.construction_status !== '已開工') return false;
        const engineeringProgress = Number(p.engineering_progress) || 0;
        return engineeringProgress < 50;
      })
      .map(p => {
        const progress = Number(p.engineering_progress) || 0;
        return { ...p, reason: `工程進度 ${progress.toFixed(0)}%` };
      })
      .sort((a, b) => (Number(a.engineering_progress) || 0) - (Number(b.engineering_progress) || 0));

    // Category 4: 長期停滯 (Long-term Stagnant) - 建檔超過6個月但進度低
    const longTermStagnant = activeProjects
      .filter(p => {
        const daysSinceCreated = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const overallProgress = Number(p.overall_progress) || 0;
        return daysSinceCreated > 180 && overallProgress < 30;
      })
      .map(p => {
        const daysSinceCreated = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const months = Math.floor(daysSinceCreated / 30);
        const overallProgress = Number(p.overall_progress) || 0;
        return { ...p, reason: `${months} 個月，進度 ${overallProgress.toFixed(0)}%` };
      });

    return [
      {
        id: 'pending-fix',
        title: '待補件',
        description: '審查中需要補件回覆',
        icon: <FileWarning className="w-5 h-5" />,
        color: 'warning',
        projects: pendingFix,
        navigateUrl: '/projects?alert=pending_fix',
      },
      {
        id: 'admin-stuck',
        title: '行政卡關',
        description: '超過 14 天未有進度更新',
        icon: <Clock className="w-5 h-5" />,
        color: 'destructive',
        projects: adminStuck,
        navigateUrl: '/projects?alert=admin_stuck',
      },
      {
        id: 'construction-delay',
        title: '施工延遲',
        description: '已開工但工程進度落後',
        icon: <PlayCircle className="w-5 h-5" />,
        color: 'info',
        projects: constructionDelay,
        navigateUrl: '/projects?alert=construction_delay',
      },
      {
        id: 'long-term-stagnant',
        title: '長期停滯',
        description: '建檔超過 6 個月進度仍低',
        icon: <TrendingDown className="w-5 h-5" />,
        color: 'muted',
        projects: longTermStagnant,
        navigateUrl: '/projects?alert=long_term_stagnant',
      },
    ];
  }, [projects]);

  // Only show categories that have projects
  const activeCategories = alertCategories.filter(cat => cat.projects.length > 0);
  const totalAlerts = activeCategories.reduce((sum, cat) => sum + cat.projects.length, 0);

  const getColorClasses = (color: AlertCategory['color']) => {
    switch (color) {
      case 'destructive':
        return {
          bg: 'bg-destructive/10',
          border: 'border-destructive/30',
          text: 'text-destructive',
          hover: 'hover:bg-destructive/15',
          iconBg: 'bg-destructive/20',
        };
      case 'warning':
        return {
          bg: 'bg-warning/10',
          border: 'border-warning/30',
          text: 'text-warning',
          hover: 'hover:bg-warning/15',
          iconBg: 'bg-warning/20',
        };
      case 'info':
        return {
          bg: 'bg-info/10',
          border: 'border-info/30',
          text: 'text-info',
          hover: 'hover:bg-info/15',
          iconBg: 'bg-info/20',
        };
      default:
        return {
          bg: 'bg-muted/50',
          border: 'border-border',
          text: 'text-muted-foreground',
          hover: 'hover:bg-muted',
          iconBg: 'bg-muted',
        };
    }
  };

  if (totalAlerts === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <h3 className="font-medium text-lg">所有案場進度正常</h3>
            <p className="text-sm text-muted-foreground mt-1">
              目前沒有需要立即處理的事項
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h3 className="font-semibold">待處理警示</h3>
          <Badge variant="secondary" className="text-xs">
            {totalAlerts} 項待處理
          </Badge>
        </div>
      </div>

      {/* Alert cards grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {activeCategories.map((category) => {
          const colors = getColorClasses(category.color);
          const displayProjects = category.projects.slice(0, maxItemsPerCategory);
          const remainingCount = category.projects.length - displayProjects.length;

          return (
            <Card 
              key={category.id}
              className={cn('border', colors.border)}
            >
              <CardContent className="p-4">
                {/* Category header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colors.iconBg)}>
                      <span className={colors.text}>{category.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{category.title}</h4>
                        <Badge variant="outline" className={cn('text-xs', colors.text)}>
                          {category.projects.length}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                </div>

                {/* Project list */}
                <div className="space-y-2">
                  {displayProjects.map((project) => (
                    <div
                      key={project.id}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors',
                        colors.bg,
                        colors.hover
                      )}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate max-w-[160px]">
                            {project.project_name}
                          </span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {project.investors?.investor_code || '-'}
                        </span>
                      </div>
                      <span className={cn('text-xs font-medium', colors.text)}>
                        {project.reason}
                      </span>
                    </div>
                  ))}
                </div>

                {/* View all button */}
                {remainingCount > 0 && category.navigateUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-xs"
                    onClick={() => navigate(category.navigateUrl!)}
                  >
                    查看其他 {remainingCount} 個案場
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
