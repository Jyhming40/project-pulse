import { useState } from 'react';
import { X, Plus, ChevronDown, EyeOff, Eye } from 'lucide-react';
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
  showLabel?: boolean;
  multiSelect?: boolean;
  // 隱藏功能
  hiddenValues?: Set<string>;
  onToggleHidden?: (value: string) => void;
  /** Per-value counts for hidden badge display */
  valueCounts?: Record<string, number>;
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
  hiddenValues,
  onToggleHidden,
  valueCounts,
}: FilterBadgeGroupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHideOpen, setIsHideOpen] = useState(false);
  
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

  const hiddenCount = hiddenValues?.size || 0;

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

      {/* 已隱藏的 Badge */}
      {hiddenValues && hiddenValues.size > 0 && Array.from(hiddenValues).map(value => (
        <Badge
          key={`hidden-${value}`}
          variant="outline"
          className="gap-1 pr-1 text-muted-foreground line-through opacity-60 cursor-pointer hover:opacity-100 transition-opacity"
          onClick={() => onToggleHidden?.(value)}
          title={`點擊顯示「${getLabel(value)}」`}
        >
          <EyeOff className="w-3 h-3" />
          <span>{getLabel(value)}{valueCounts && valueCounts[value] !== undefined ? ` (${valueCounts[value]})` : ''}</span>
        </Badge>
      ))}
      
      {/* 無選中且無隱藏時顯示「全部」 */}
      {selectedValues.length === 0 && hiddenCount === 0 && (
        <Badge variant="outline" className="text-muted-foreground">
          全部
        </Badge>
      )}

      {/* 無選中但有隱藏時顯示計數 */}
      {selectedValues.length === 0 && hiddenCount > 0 && (
        <Badge variant="outline" className="text-muted-foreground">
          全部 (隱藏 {hiddenCount})
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

      {/* 隱藏選項 Popover */}
      {onToggleHidden && options.length > 0 && (
        <Popover open={isHideOpen} onOpenChange={setIsHideOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <EyeOff className="w-3 h-3 mr-1" />
              隱藏
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-1" align="start">
            <div className="max-h-60 overflow-y-auto">
              {options.map(opt => {
                const isHidden = hiddenValues?.has(opt.value) || false;
                const count = valueCounts?.[opt.value];
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onToggleHidden(opt.value);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted transition-colors flex items-center justify-between",
                      isHidden && "text-muted-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {opt.label}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {count !== undefined && (
                        <span className="text-xs text-muted-foreground">{count}</span>
                      )}
                      {isHidden && (
                        <Badge variant="secondary" className="text-[10px] px-1 h-4">隱藏中</Badge>
                      )}
                    </span>
                  </button>
                );
              })}
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
