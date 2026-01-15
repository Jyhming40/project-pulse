import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Building2, 
  AlertTriangle, 
  TrendingUp,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useUILabels } from '@/hooks/useUILabels';

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
  const { getLabel } = useUILabels();

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
      title: getLabel('total_projects'),
      value: totalProjects,
      icon: Building2,
      iconColor: 'text-primary',
      bgColor: 'bg-primary/10',
      onClick: () => navigate('/projects'),
    },
    {
      title: getLabel('risk_projects'),
      value: atRiskCount,
      icon: AlertTriangle,
      iconColor: 'text-destructive',
      bgColor: 'bg-destructive/10',
      highlight: atRiskCount > 0,
      onClick: () => navigate('/projects?risk=high'),
    },
    {
      title: getLabel('pending_documents'),
      value: pendingFixCount,
      icon: AlertTriangle,
      iconColor: 'text-warning',
      bgColor: 'bg-warning/10',
      highlight: pendingFixCount > 0,
      onClick: () => navigate('/projects?status=台電審查'),
    },
    {
      title: getLabel('average_progress'),
      value: `${averageProgress}%`,
      icon: TrendingUp,
      iconColor: 'text-success',
      bgColor: 'bg-success/10',
      progress: averageProgress,
    },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {cards.map((card) => (
            <div 
              key={card.title} 
              className={`p-3 rounded-lg ${card.highlight ? 'bg-destructive/5 border border-destructive/20' : 'bg-muted/30'} ${card.onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
              onClick={card.onClick}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  <p className={`text-xl font-bold ${card.highlight ? 'text-destructive' : ''}`}>
                    {card.value}
                  </p>
                  {card.progress !== undefined && (
                    <Progress value={card.progress} className="h-1.5 mt-2 w-16" />
                  )}
                </div>
                <div className={`w-8 h-8 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                  <card.icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
