import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export function useTableSort<T>(data: T[], defaultSort?: SortConfig) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(
    defaultSort || { key: '', direction: null }
  );

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      if (current.direction === 'desc') {
        return { key: '', direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data;
    }

    return [...data].sort((a, b) => {
      const aValue = getNestedValue(a, sortConfig.key);
      const bValue = getNestedValue(b, sortConfig.key);

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Handle different types
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle dates
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortConfig.direction === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }

      // Try parsing as dates if strings look like dates
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const dateA = tryParseDate(aValue);
        const dateB = tryParseDate(bValue);
        if (dateA && dateB) {
          return sortConfig.direction === 'asc'
            ? dateA.getTime() - dateB.getTime()
            : dateB.getTime() - dateA.getTime();
        }
      }

      // Default string comparison
      const strA = String(aValue).toLowerCase();
      const strB = String(bValue).toLowerCase();
      
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  return {
    sortedData,
    sortConfig,
    handleSort,
    resetSort: () => setSortConfig({ key: '', direction: null }),
  };
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
