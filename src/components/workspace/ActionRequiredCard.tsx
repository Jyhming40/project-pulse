import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon, AlertTriangle, Inbox } from 'lucide-react';

interface ActionRequiredCardProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  iconColor?: string;
  emptyMessage?: string;
  children?: ReactNode;
  className?: string;
}

export function ActionRequiredCard({
  title,
  description,
  icon: Icon = AlertTriangle,
  iconColor = 'text-warning',
  emptyMessage = '目前沒有待處理項目',
  children,
  className,
}: ActionRequiredCardProps) {
  const hasContent = children !== undefined && children !== null;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className={cn("w-5 h-5", iconColor)} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasContent ? (
          children
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="p-3 rounded-full bg-muted/50 mb-3">
              <Inbox className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">{emptyMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// List item for action required items
interface ActionItemProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  status?: 'warning' | 'danger' | 'info';
  onClick?: () => void;
}

export function ActionItem({
  title,
  subtitle,
  icon: Icon,
  status = 'warning',
  onClick,
}: ActionItemProps) {
  const statusColors = {
    warning: 'border-l-warning',
    danger: 'border-l-destructive',
    info: 'border-l-info',
  };

  return (
    <button 
      className={cn(
        "w-full flex items-center gap-3 p-3 text-left rounded-lg border-l-4 bg-muted/30",
        "transition-colors hover:bg-muted/50",
        statusColors[status]
      )}
      onClick={onClick}
    >
      {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
    </button>
  );
}
