import { ReactNode } from 'react';
import { X, Trash2, Edit, Download, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface BatchAction {
  key: string;
  label: string;
  icon?: ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  onClick: () => void;
  disabled?: boolean;
}

interface BatchActionBarProps {
  selectedCount: number;
  actions: BatchAction[];
  onClear: () => void;
  className?: string;
}

export function BatchActionBar({
  selectedCount,
  actions,
  onClear,
  className,
}: BatchActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-2 px-4 py-3 rounded-xl',
        'bg-primary text-primary-foreground shadow-lg',
        'animate-in slide-in-from-bottom-4 fade-in-0',
        className
      )}
    >
      <Badge variant="secondary" className="bg-background/20 text-primary-foreground">
        已選取 {selectedCount} 筆
      </Badge>

      <div className="h-6 w-px bg-primary-foreground/30 mx-1" />

      <div className="flex items-center gap-1">
        {actions.map((action) => (
          <Button
            key={action.key}
            variant={action.variant || 'secondary'}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              action.variant === 'destructive'
                ? 'bg-destructive/90 hover:bg-destructive text-destructive-foreground'
                : 'bg-background/20 hover:bg-background/30 text-primary-foreground'
            )}
          >
            {action.icon}
            <span className="ml-1">{action.label}</span>
          </Button>
        ))}
      </div>

      <div className="h-6 w-px bg-primary-foreground/30 mx-1" />

      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        className="h-8 w-8 hover:bg-background/20"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Pre-built action icons
export const BatchActionIcons = {
  edit: <Edit className="h-4 w-4" />,
  delete: <Trash2 className="h-4 w-4" />,
  export: <Download className="h-4 w-4" />,
  assign: <UserPlus className="h-4 w-4" />,
};
