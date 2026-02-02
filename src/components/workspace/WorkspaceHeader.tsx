import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type HeaderColor = 'blue' | 'amber' | 'emerald' | 'violet' | 'rose' | 'teal';

interface WorkspaceHeaderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  badge?: string;
  color: HeaderColor;
  actions?: ReactNode;
  className?: string;
}

const colorClasses: Record<HeaderColor, { bg: string; icon: string }> = {
  blue: {
    bg: 'bg-blue-500/10',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  amber: {
    bg: 'bg-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  violet: {
    bg: 'bg-violet-500/10',
    icon: 'text-violet-600 dark:text-violet-400',
  },
  rose: {
    bg: 'bg-rose-500/10',
    icon: 'text-rose-600 dark:text-rose-400',
  },
  teal: {
    bg: 'bg-teal-500/10',
    icon: 'text-teal-600 dark:text-teal-400',
  },
};

export function WorkspaceHeader({
  title,
  subtitle,
  icon: Icon,
  badge,
  color,
  actions,
  className,
}: WorkspaceHeaderProps) {
  const colors = colorClasses[color];

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-4">
        <div className={cn(
          "p-3 rounded-xl transition-transform hover:scale-105",
          colors.bg
        )}>
          <Icon className={cn("w-7 h-7", colors.icon)} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-display font-bold">{title}</h1>
            {badge && (
              <Badge variant="outline" className="text-xs font-normal">
                {badge}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">{subtitle}</p>
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
