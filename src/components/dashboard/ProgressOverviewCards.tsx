import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Building2, 
  AlertTriangle, 
  TrendingUp,
  ClipboardCheck,
  HardHat,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ProgressOverviewCardsProps {
  totalProjects: number;
  atRiskCount: number;
  averageProgress: number;
  averageAdminProgress: number;
  averageEngineeringProgress: number;
  isLoading?: boolean;
}

export function ProgressOverviewCards({
  totalProjects,
  atRiskCount,
  averageProgress,
  averageAdminProgress,
  averageEngineeringProgress,
  isLoading = false,
}: ProgressOverviewCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-2 w-full" />
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
    },
    {
      title: '風險案場',
      value: atRiskCount,
      icon: AlertTriangle,
      iconColor: 'text-destructive',
      bgColor: 'bg-destructive/10',
      highlight: atRiskCount > 0,
    },
    {
      title: '平均整體進度',
      value: `${averageProgress}%`,
      icon: TrendingUp,
      iconColor: 'text-success',
      bgColor: 'bg-success/10',
      progress: averageProgress,
    },
    {
      title: '平均行政進度',
      value: `${averageAdminProgress}%`,
      icon: ClipboardCheck,
      iconColor: 'text-info',
      bgColor: 'bg-info/10',
      progress: averageAdminProgress,
    },
    {
      title: '平均工程進度',
      value: `${averageEngineeringProgress}%`,
      icon: HardHat,
      iconColor: 'text-warning',
      bgColor: 'bg-warning/10',
      progress: averageEngineeringProgress,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className={card.highlight ? 'border-destructive/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`w-8 h-8 rounded-lg ${card.bgColor} flex items-center justify-center`}>
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.highlight ? 'text-destructive' : ''}`}>
              {card.value}
            </div>
            {card.progress !== undefined && (
              <Progress value={card.progress} className="h-1.5 mt-2" />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
