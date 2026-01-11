import { X, Filter, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterBadgeGroup, FilterOption } from './FilterBadgeGroup';
import { UseProjectFiltersReturn } from '@/hooks/useProjectFilters';
import { SearchInputWithHistory } from '@/components/SearchInputWithHistory';
import { cn } from '@/lib/utils';

interface FilterGroupConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

interface ProjectFilterBarProps {
  filters: UseProjectFiltersReturn;
  filterGroups: FilterGroupConfig[];
  className?: string;
  // 搜尋設定
  searchPlaceholder?: string;
  searchStorageKey?: string;
  // 風險篩選特殊處理
  riskProjectCount?: number;
}

export function ProjectFilterBar({
  filters,
  filterGroups,
  className,
  searchPlaceholder = "搜尋案場名稱、編號、地址、投資方...",
  searchStorageKey = "projects-search-history",
  riskProjectCount,
}: ProjectFilterBarProps) {
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

  // 風險篩選特殊處理
  const isRiskFilterActive = hasAnyFilter('risk');

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
