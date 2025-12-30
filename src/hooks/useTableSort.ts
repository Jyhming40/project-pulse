import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export interface MultiSortConfig {
  sorts: SortConfig[];
}

export function useTableSort<T>(data: T[], defaultSort?: SortConfig) {
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>(
    defaultSort && defaultSort.key ? [defaultSort] : []
  );

  // Handle single or multi-column sort (Shift+click for multi)
  const handleSort = (key: string, isMultiSort = false) => {
    setSortConfigs((current) => {
      const existingIndex = current.findIndex((s) => s.key === key);

      if (isMultiSort) {
        // Multi-sort mode (Shift+click)
        if (existingIndex >= 0) {
          const existing = current[existingIndex];
          if (existing.direction === 'asc') {
            // Toggle to desc
            const newConfigs = [...current];
            newConfigs[existingIndex] = { key, direction: 'desc' };
            return newConfigs;
          } else if (existing.direction === 'desc') {
            // Remove from sort
            return current.filter((_, i) => i !== existingIndex);
          }
        }
        // Add new sort column
        return [...current, { key, direction: 'asc' }];
      } else {
        // Single-sort mode (normal click)
        if (existingIndex >= 0 && current.length === 1) {
          const existing = current[0];
          if (existing.direction === 'asc') {
            return [{ key, direction: 'desc' }];
          } else if (existing.direction === 'desc') {
            return [];
          }
        }
        // Replace all sorts with new single sort
        return [{ key, direction: 'asc' }];
      }
    });
  };

  // Get sort info for a specific column
  const getSortInfo = (key: string): { direction: SortDirection; index: number } => {
    const index = sortConfigs.findIndex((s) => s.key === key);
    if (index >= 0) {
      return { direction: sortConfigs[index].direction, index: index + 1 };
    }
    return { direction: null, index: 0 };
  };

  const sortedData = useMemo(() => {
    if (sortConfigs.length === 0) {
      return data;
    }

    return [...data].sort((a, b) => {
      for (const config of sortConfigs) {
        if (!config.key || !config.direction) continue;

        const aValue = getNestedValue(a, config.key);
        const bValue = getNestedValue(b, config.key);

        const comparison = compareValues(aValue, bValue, config.direction);
        if (comparison !== 0) {
          return comparison;
        }
      }
      return 0;
    });
  }, [data, sortConfigs]);

  // For backward compatibility
  const sortConfig: SortConfig = sortConfigs[0] || { key: '', direction: null };

  return {
    sortedData,
    sortConfig,
    sortConfigs,
    handleSort,
    getSortInfo,
    resetSort: () => setSortConfigs([]),
  };
}

// Compare two values
function compareValues(aValue: any, bValue: any, direction: SortDirection): number {
  // Handle null/undefined values
  if (aValue == null && bValue == null) return 0;
  if (aValue == null) return direction === 'asc' ? 1 : -1;
  if (bValue == null) return direction === 'asc' ? -1 : 1;

  // Handle booleans
  if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
    const aNum = aValue ? 1 : 0;
    const bNum = bValue ? 1 : 0;
    return direction === 'asc' ? aNum - bNum : bNum - aNum;
  }

  // Handle numbers
  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return direction === 'asc' ? aValue - bValue : bValue - aValue;
  }

  // Handle dates
  if (aValue instanceof Date && bValue instanceof Date) {
    return direction === 'asc'
      ? aValue.getTime() - bValue.getTime()
      : bValue.getTime() - aValue.getTime();
  }

  // Try parsing as dates if strings look like dates
  if (typeof aValue === 'string' && typeof bValue === 'string') {
    const dateA = tryParseDate(aValue);
    const dateB = tryParseDate(bValue);
    if (dateA && dateB) {
      return direction === 'asc'
        ? dateA.getTime() - dateB.getTime()
        : dateB.getTime() - dateA.getTime();
    }
  }

  // Default string comparison
  const strA = String(aValue).toLowerCase();
  const strB = String(bValue).toLowerCase();

  if (strA < strB) return direction === 'asc' ? -1 : 1;
  if (strA > strB) return direction === 'asc' ? 1 : -1;
  return 0;
}

// Helper to get nested object values using dot notation (e.g., 'investors.company_name')
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper to try parsing a string as a date
function tryParseDate(str: string): Date | null {
  // Common date formats
  if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(str)) {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}
