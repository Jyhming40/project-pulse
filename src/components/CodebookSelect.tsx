import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOptionsForCategory, OptionWithStatus } from '@/hooks/useSystemOptions';
import { CodebookCategory } from '@/config/codebookConfig';
import { cn } from '@/lib/utils';

interface CodebookSelectProps {
  category: CodebookCategory;
  value: string | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A Select component that reads options from the Codebook (system_options table).
 * - Shows only active options for selection
 * - If the current value is a disabled option, it will still be shown with strikethrough styling
 * - Historical data with disabled options will display correctly
 */
export function CodebookSelect({
  category,
  value,
  onValueChange,
  placeholder = '請選擇',
  disabled = false,
  className,
}: CodebookSelectProps) {
  const { dropdownOptions, isLoading } = useOptionsForCategory(category, value);

  return (
    <Select value={value || ''} onValueChange={onValueChange} disabled={disabled || isLoading}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={isLoading ? '載入中...' : placeholder}>
          {value && (
            <span className={cn(
              dropdownOptions.find(opt => opt.value === value && !opt.is_active) && 
              'line-through text-muted-foreground'
            )}>
              {dropdownOptions.find(opt => opt.value === value)?.label || value}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {dropdownOptions.map((opt) => (
          <SelectItem 
            key={opt.value} 
            value={opt.value}
            disabled={!opt.is_active}
            className={cn(
              !opt.is_active && 'line-through text-muted-foreground opacity-60'
            )}
          >
            {opt.label}
            {!opt.is_active && (
              <span className="ml-2 text-xs">(已停用)</span>
            )}
          </SelectItem>
        ))}
        {dropdownOptions.length === 0 && (
          <div className="py-2 px-2 text-sm text-muted-foreground text-center">
            尚無選項
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

/**
 * Display-only component for showing a Codebook value with proper styling
 * Used in read-only contexts like tables
 */
export function CodebookValue({
  category,
  value,
  className,
}: {
  category: CodebookCategory;
  value: string | undefined | null;
  className?: string;
}) {
  const { allOptions } = useOptionsForCategory(category, value || undefined);
  
  if (!value) return <span className={cn('text-muted-foreground', className)}>-</span>;
  
  const option = allOptions.find(opt => opt.value === value);
  const isInactive = option && !option.is_active;
  
  return (
    <span className={cn(
      className,
      isInactive && 'line-through text-muted-foreground'
    )}>
      {option?.label || value}
      {isInactive && <span className="ml-1 text-xs">(已停用)</span>}
    </span>
  );
}