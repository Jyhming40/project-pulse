import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface FilterConfig {
  key: string;
  urlParam: string;
  // 別名參數，向後相容
  urlParamAlias?: string;
  // 特殊值對應（例如 '尚未開工' 對應 null）
  nullEquivalent?: string;
}

export interface FilterState {
  values: string[];
  isActive: boolean;
}

export interface UseProjectFiltersOptions {
  filters: FilterConfig[];
}

export interface UseProjectFiltersReturn {
  // 篩選狀態
  filterStates: Record<string, FilterState>;
  // 操作方法
  addFilter: (key: string, value: string) => void;
  removeFilter: (key: string, value: string) => void;
  clearFilter: (key: string) => void;
  clearAllFilters: () => void;
  setFilter: (key: string, values: string[]) => void;
  // 檢查方法
  hasFilter: (key: string, value: string) => boolean;
  hasAnyFilter: (key: string) => boolean;
  // 取得特定篩選的值
  getFilterValues: (key: string) => string[];
  // 應用篩選到資料
  matchesFilters: <T>(item: T, getFieldValue: (item: T, key: string) => string | null | undefined) => boolean;
  // 搜尋
  search: string;
  setSearch: (value: string) => void;
  // 活躍篩選數量
  activeFilterCount: number;
}

const DEFAULT_FILTERS: FilterConfig[] = [
  { key: 'status', urlParam: 'status' },
  { key: 'construction_status', urlParam: 'construction_status', urlParamAlias: 'construction', nullEquivalent: '尚未開工' },
  { key: 'city', urlParam: 'city' },
  { key: 'drive_status', urlParam: 'drive_status' },
  { key: 'risk', urlParam: 'risk' },
  { key: 'issue_type', urlParam: 'issue_type' },
];

export function useProjectFilters(options?: UseProjectFiltersOptions): UseProjectFiltersReturn {
  const filters = options?.filters || DEFAULT_FILTERS;
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  
  // 從 URL 初始化篩選狀態
  const [filterStates, setFilterStates] = useState<Record<string, FilterState>>(() => {
    const initial: Record<string, FilterState> = {};
    filters.forEach(filter => {
      // 支援別名參數
      const paramValue = searchParams.get(filter.urlParam) || 
                         (filter.urlParamAlias ? searchParams.get(filter.urlParamAlias) : null);
      const values = paramValue ? paramValue.split(',').map(v => decodeURIComponent(v.trim())).filter(Boolean) : [];
      initial[filter.key] = {
        values,
        isActive: values.length > 0,
      };
    });
    return initial;
  });

  // 監聽 URL 變化，同步到 state
  useEffect(() => {
    const newStates: Record<string, FilterState> = {};
    filters.forEach(filter => {
      const paramValue = searchParams.get(filter.urlParam) || 
                         (filter.urlParamAlias ? searchParams.get(filter.urlParamAlias) : null);
      const values = paramValue ? paramValue.split(',').map(v => decodeURIComponent(v.trim())).filter(Boolean) : [];
      newStates[filter.key] = {
        values,
        isActive: values.length > 0,
      };
    });
    setFilterStates(newStates);
  }, [searchParams, filters]);

  // 更新 URL 參數
  const updateUrlParams = useCallback((newStates: Record<string, FilterState>) => {
    const newParams = new URLSearchParams();
    
    filters.forEach(filter => {
      const state = newStates[filter.key];
      if (state && state.values.length > 0) {
        newParams.set(filter.urlParam, state.values.map(v => encodeURIComponent(v)).join(','));
      }
    });
    
    setSearchParams(newParams, { replace: true });
  }, [filters, setSearchParams]);

  // 新增篩選值
  const addFilter = useCallback((key: string, value: string) => {
    setFilterStates(prev => {
      const current = prev[key] || { values: [], isActive: false };
      if (current.values.includes(value)) return prev;
      
      const newStates = {
        ...prev,
        [key]: {
          values: [...current.values, value],
          isActive: true,
        },
      };
      updateUrlParams(newStates);
      return newStates;
    });
  }, [updateUrlParams]);

  // 移除篩選值
  const removeFilter = useCallback((key: string, value: string) => {
    setFilterStates(prev => {
      const current = prev[key];
      if (!current) return prev;
      
      const newValues = current.values.filter(v => v !== value);
      const newStates = {
        ...prev,
        [key]: {
          values: newValues,
          isActive: newValues.length > 0,
        },
      };
      updateUrlParams(newStates);
      return newStates;
    });
  }, [updateUrlParams]);

  // 清除單一篩選器
  const clearFilter = useCallback((key: string) => {
    setFilterStates(prev => {
      const newStates = {
        ...prev,
        [key]: { values: [], isActive: false },
      };
      updateUrlParams(newStates);
      return newStates;
    });
  }, [updateUrlParams]);

  // 清除所有篩選
  const clearAllFilters = useCallback(() => {
    const newStates: Record<string, FilterState> = {};
    filters.forEach(filter => {
      newStates[filter.key] = { values: [], isActive: false };
    });
    setFilterStates(newStates);
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [filters, setSearchParams]);

  // 設定篩選值（覆蓋）
  const setFilter = useCallback((key: string, values: string[]) => {
    setFilterStates(prev => {
      const newStates = {
        ...prev,
        [key]: {
          values,
          isActive: values.length > 0,
        },
      };
      updateUrlParams(newStates);
      return newStates;
    });
  }, [updateUrlParams]);

  // 檢查是否有特定篩選值
  const hasFilter = useCallback((key: string, value: string) => {
    return filterStates[key]?.values.includes(value) || false;
  }, [filterStates]);

  // 檢查是否有任何篩選值
  const hasAnyFilter = useCallback((key: string) => {
    return filterStates[key]?.isActive || false;
  }, [filterStates]);

  // 取得篩選值
  const getFilterValues = useCallback((key: string) => {
    return filterStates[key]?.values || [];
  }, [filterStates]);

  // 建立篩選匹配函數
  const matchesFilters = useCallback(<T,>(
    item: T, 
    getFieldValue: (item: T, key: string) => string | null | undefined
  ): boolean => {
    for (const filter of filters) {
      const state = filterStates[filter.key];
      if (!state || !state.isActive) continue;
      
      const fieldValue = getFieldValue(item, filter.key);
      const filterValues = state.values;
      
      // 處理特殊的 null 等價值
      if (filter.nullEquivalent && filterValues.includes(filter.nullEquivalent)) {
        // 如果篩選值包含 null 等價值，則 null/undefined/空字串 都算匹配
        const matchesNullEquivalent = !fieldValue || fieldValue === '';
        const matchesExactValue = filterValues.includes(fieldValue || '');
        if (!matchesNullEquivalent && !matchesExactValue) {
          return false;
        }
      } else {
        // 支援多值匹配：fieldValue 可能是以逗號分隔的多個值
        const fieldValues = (fieldValue || '').split(',').map(v => v.trim()).filter(Boolean);
        
        // 檢查是否有任何一個 filterValue 存在於 fieldValues 中
        const hasMatch = filterValues.some(fv => 
          fieldValues.includes(fv) || fieldValue === fv
        );
        
        if (!hasMatch) {
          return false;
        }
      }
    }
    return true;
  }, [filters, filterStates]);

  // 計算活躍篩選數量
  const activeFilterCount = useMemo(() => {
    return Object.values(filterStates).reduce((count, state) => {
      return count + state.values.length;
    }, 0);
  }, [filterStates]);

  return {
    filterStates,
    addFilter,
    removeFilter,
    clearFilter,
    clearAllFilters,
    setFilter,
    hasFilter,
    hasAnyFilter,
    getFilterValues,
    matchesFilters,
    search,
    setSearch,
    activeFilterCount,
  };
}
