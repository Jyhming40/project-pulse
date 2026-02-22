import { useState } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterBadgeGroupProps {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  onClear?: () => void;
  className?: string;
  // 是否顯示標籤
  showLabel?: boolean;
  // 是否可多選
  multiSelect?: boolean;
}

export function FilterBadgeGroup({
  label,
  options,
  selectedValues,
  onAdd,
  onRemove,
  onClear,
  className,
  showLabel = true,
  multiSelect = true,
}: FilterBadgeGroupProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // 過濾出未選中的選項
  const availableOptions = options.filter(opt => !selectedValues.includes(opt.value));
  
  // 取得選中項目的標籤
  const getLabel = (value: string) => {
    return options.find(opt => opt.value === value)?.label || value;
  };

  const handleSelect = (value: string) => {
    onAdd(value);
    if (!multiSelect) {
      setIsOpen(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {showLabel && (
        <span className="text-sm text-muted-foreground whitespace-nowrap">{label}:</span>
      )}
      
      {/* 已選中的 Badge */}
      {selectedValues.map(value => (
        <Badge 
          key={value} 
          variant="secondary" 
          className="gap-1 pr-1 hover:bg-secondary/80 transition-colors"
        >
          <span>{getLabel(value)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(value);
            }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
            aria-label={`移除 ${getLabel(value)}`}
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      
      {/* 無選中時顯示「全部」 */}
      {selectedValues.length === 0 && (
        <Badge variant="outline" className="text-muted-foreground">
          全部
        </Badge>
      )}
      
      {/* 新增選項 Popover */}
      {availableOptions.length > 0 && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-3 h-3 mr-1" />
              新增
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            <div className="max-h-60 overflow-y-auto">
              {availableOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      
      {/* 清除按鈕 */}
      {selectedValues.length > 0 && onClear && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
          onClick={onClear}
        >
          清除
        </Button>
      )}
    </div>
  );
}
