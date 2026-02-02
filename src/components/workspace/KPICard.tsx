import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type KPIColor = 'blue' | 'emerald' | 'amber' | 'teal' | 'rose' | 'violet' | 'primary';
export type KPITrend = 'up' | 'down' | 'neutral';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: KPIColor;
  trend?: KPITrend;
  trendValue?: string;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

const colorClasses: Record<KPIColor, string> = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  primary: 'bg-primary/10 text-primary',
};

const trendIcons: Record<KPITrend, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

const trendColors: Record<KPITrend, string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-muted-foreground',
};

export function KPICard({ 
  title, 
  value, 
  icon: Icon,
  color = 'primary',
  trend,
  trendValue,
  subtitle,
  className,
  onClick,
}: KPICardProps) {
  const TrendIcon = trend ? trendIcons[trend] : null;

  return (
    <Card 
      className={cn(
        "group overflow-hidden transition-all duration-300",
        onClick && "cursor-pointer hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <p className="text-2xl lg:text-3xl font-bold tracking-tight">{value}</p>
              {trend && trendValue && (
                <span className={cn("flex items-center gap-0.5 text-sm font-medium", trendColors[trend])}>
                  {TrendIcon && <TrendIcon className="w-3.5 h-3.5" />}
                  {trendValue}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl transition-transform duration-300",
            onClick && "group-hover:scale-110",
            colorClasses[color]
          )}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton loading state
export function KPICardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            <div className="h-8 w-16 bg-muted animate-pulse rounded" />
          </div>
          <div className="w-11 h-11 bg-muted animate-pulse rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}
