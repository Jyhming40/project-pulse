import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DocumentTagBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'default';
  onRemove?: () => void;
}

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-800' },
  green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  pink: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' },
  gray: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-700' },
};

export function DocumentTagBadge({ name, color, size = 'default', onRemove }: DocumentTagBadgeProps) {
  const colors = colorMap[color] || colorMap.gray;

  return (
    <Badge
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
        onRemove && 'pr-1 cursor-pointer hover:opacity-80'
      )}
      onClick={onRemove}
    >
      {name}
      {onRemove && <span className="ml-1 text-[10px]">×</span>}
    </Badge>
  );
}

export function TagColorDot({ color }: { color: string }) {
  const bgColors: Record<string, string> = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    pink: 'bg-pink-500',
    gray: 'bg-gray-500',
  };

  return <span className={cn('w-3 h-3 rounded-full inline-block', bgColors[color] || bgColors.gray)} />;
}
