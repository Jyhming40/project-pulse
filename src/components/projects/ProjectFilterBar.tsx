import { useState } from 'react';
import { X, Filter, AlertTriangle, EyeOff, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterBadgeGroup, FilterOption } from './FilterBadgeGroup';
import { UseProjectFiltersReturn } from '@/hooks/useProjectFilters';
import { SearchInputWithHistory } from '@/components/SearchInputWithHistory';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface FilterGroupConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

interface HiddenStatusConfig {
  options: FilterOption[];
  hiddenValues: Set<string>;
  onToggleHidden: (value: string) => void;
  valueCounts?: Record<string, number>;
}

interface ProjectFilterBarProps {
  filters: UseProjectFiltersReturn;
  filterGroups: FilterGroupConfig[];
  className?: string;
  searchPlaceholder?: string;
  searchStorageKey?: string;
  riskProjectCount?: number;
  // 隱藏狀態功能
  hiddenStatusConfig?: HiddenStatusConfig;
}

export function ProjectFilterBar({
  filters,
  filterGroups,
  className,
  searchPlaceholder = "搜尋案場名稱、編號、地址、業務單位...",
  searchStorageKey = "projects-search-history",
  riskProjectCount,
  hiddenStatusConfig,
}: ProjectFilterBarProps) {
  const [isHideOpen, setIsHideOpen] = useState(false);
  
  const { 
    search, 
    setSearch, 
    getFilterValues, 
    addFilter, 
    removeFilter, 
    clearFilter, 
    clearAllFilters,
    activeFilterCount,
    hasAnyFilter,
  } = filters;

  const isRiskFilterActive = hasAnyFilter('risk');
  const hiddenCount = hiddenStatusConfig?.hiddenValues.size || 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* 搜尋列 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInputWithHistory
          value={search}
          onChange={setSearch}
          placeholder={searchPlaceholder}
          storageKey={searchStorageKey}
          className="flex-1"
        />
        
        {/* 風險篩選按鈕 */}
        {riskProjectCount !== undefined && (
          <Button
            variant={isRiskFilterActive ? "destructive" : "outline"}
            size="sm"
            onClick={() => {
              if (isRiskFilterActive) {
                clearFilter('risk');
              } else {
                addFilter('risk', 'high');
              }
            }}
            className="whitespace-nowrap"
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            風險案場
            {riskProjectCount > 0 && (
              <Badge 
                variant={isRiskFilterActive ? "outline" : "destructive"} 
                className="ml-2 h-5 px-1.5 text-xs"
              >
                {riskProjectCount}
              </Badge>
            )}
          </Button>
        )}
        
        {/* 清除全部按鈕 */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground hover:text-destructive whitespace-nowrap"
          >
            <X className="w-4 h-4 mr-1" />
            清除篩選 ({activeFilterCount})
          </Button>
        )}
      </div>
      
      {/* 篩選列表 */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 items-center bg-muted/30 rounded-lg p-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        
        {filterGroups.map(group => (
          <FilterBadgeGroup
            key={group.key}
            label={group.label}
            options={group.options}
            selectedValues={getFilterValues(group.key)}
            onAdd={(value) => addFilter(group.key, value)}
            onRemove={(value) => removeFilter(group.key, value)}
            onClear={() => clearFilter(group.key)}
          />
        ))}

        {/* 隱藏狀態下拉 — 分隔線 + 按鈕 */}
        {hiddenStatusConfig && (
          <>
            <div className="h-5 w-px bg-border mx-1" />
            <Popover open={isHideOpen} onOpenChange={setIsHideOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={hiddenCount > 0 ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1.5"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  隱藏中
                  {hiddenCount > 0 && (
                    <Badge variant="outline" className="h-4 px-1 text-[10px] ml-0.5">
                      {hiddenCount}
                    </Badge>
                  )}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <p className="text-xs text-muted-foreground mb-2 px-1">
                  勾選要隱藏的狀態，隱藏後案場不會顯示在列表中
                </p>
                <div className="max-h-64 overflow-y-auto space-y-0.5">
                  {hiddenStatusConfig.options.map(opt => {
                    const isHidden = hiddenStatusConfig.hiddenValues.has(opt.value);
                    const count = hiddenStatusConfig.valueCounts?.[opt.value] ?? 0;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => hiddenStatusConfig.onToggleHidden(opt.value)}
                        className={cn(
                          "w-full text-left px-2.5 py-2 text-sm rounded-md hover:bg-muted transition-colors flex items-center justify-between gap-2",
                          isHidden && "bg-muted/50"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className={cn(
                            "flex items-center justify-center w-4 h-4 rounded border transition-colors",
                            isHidden 
                              ? "bg-primary border-primary text-primary-foreground" 
                              : "border-input"
                          )}>
                            {isHidden && <Check className="w-3 h-3" />}
                          </span>
                          <span className={cn(isHidden && "text-muted-foreground")}>{opt.label}</span>
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>
      
      {/* 活躍篩選摘要 */}
      {activeFilterCount > 0 && (
        <div className="text-sm text-muted-foreground">
          已套用 {activeFilterCount} 個篩選條件
        </div>
      )}
    </div>
  );
}
