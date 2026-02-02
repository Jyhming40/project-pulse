import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon, ArrowRight } from 'lucide-react';

export type ActionColor = 'blue' | 'emerald' | 'amber' | 'teal' | 'rose' | 'violet' | 'primary';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  color?: ActionColor;
  badge?: string;
  onClick: () => void;
  className?: string;
}

const colorClasses: Record<ActionColor, string> = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20',
  teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:bg-teal-500/20',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500/20',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-500/20',
  primary: 'bg-primary/10 text-primary group-hover:bg-primary/20',
};

export function QuickActionCard({
  title,
  description,
  icon: Icon,
  color = 'primary',
  badge,
  onClick,
  className,
}: QuickActionCardProps) {
  return (
    <Card 
      className={cn(
        "group cursor-pointer overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className={cn(
              "p-2.5 rounded-xl transition-all duration-300 flex-shrink-0",
              colorClasses[color]
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{title}</h3>
                {badge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

// Compact variant for smaller spaces
export function QuickActionCompact({
  title,
  icon: Icon,
  color = 'primary',
  onClick,
  className,
}: Omit<QuickActionCardProps, 'description'>) {
  return (
    <button 
      className={cn(
        "group flex items-center gap-3 p-3 rounded-xl border border-border bg-card w-full",
        "transition-all duration-200 hover:shadow-md hover:border-primary/30",
        className
      )}
      onClick={onClick}
    >
      <div className={cn(
        "p-2 rounded-lg transition-colors",
        colorClasses[color]
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="font-medium text-sm">{title}</span>
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 ml-auto transition-opacity" />
    </button>
  );
}
