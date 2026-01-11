import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Building2, 
  AlertTriangle, 
  TrendingUp,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface HealthKPICardsProps {
  totalProjects: number;
  atRiskCount: number;
  averageProgress: number;
  pendingFixCount: number;
  isLoading?: boolean;
}

export function HealthKPICards({
  totalProjects,
  atRiskCount,
  averageProgress,
  pendingFixCount,
  isLoading = false,
}: HealthKPICardsProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: '總案場數',
      value: totalProjects,
      icon: Building2,
      iconColor: 'text-primary',
      bgColor: 'bg-primary/10',
      onClick: () => navigate('/projects'),
    },
    {
      title: '風險案場',
      value: atRiskCount,
      icon: AlertTriangle,
      iconColor: 'text-destructive',
      bgColor: 'bg-destructive/10',
      highlight: atRiskCount > 0,
      onClick: () => navigate('/projects?risk=high'),
    },
    {
      title: '待補件',
      value: pendingFixCount,
      icon: AlertTriangle,
      iconColor: 'text-warning',
      bgColor: 'bg-warning/10',
      highlight: pendingFixCount > 0,
      onClick: () => navigate('/projects?status=台電審查'),
    },
    {
      title: '平均進度',
      value: `${averageProgress}%`,
      icon: TrendingUp,
      iconColor: 'text-success',
      bgColor: 'bg-success/10',
      progress: averageProgress,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card 
          key={card.title} 
          className={`${card.highlight ? 'border-destructive/50' : ''} ${card.onClick ? 'cursor-pointer hover:bg-accent/50 transition-colors' : ''}`}
          onClick={card.onClick}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{card.title}</p>
                <p className={`text-2xl font-bold ${card.highlight ? 'text-destructive' : ''}`}>
                  {card.value}
                </p>
                {card.progress !== undefined && (
                  <Progress value={card.progress} className="h-1.5 mt-2 w-16" />
                )}
              </div>
              <div className={`w-9 h-9 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                <card.icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
