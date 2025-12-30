import { useState, useMemo } from 'react';

export interface PaginationConfig {
  pageSize: number;
  pageSizeOptions?: number[];
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function usePagination<T>(
  data: T[],
  config?: Partial<PaginationConfig>
) {
  const pageSizeOptions = config?.pageSizeOptions || DEFAULT_PAGE_SIZE_OPTIONS;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(config?.pageSize || DEFAULT_PAGE_SIZE);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Reset to page 1 if current page exceeds total pages
  const validCurrentPage = Math.min(currentPage, totalPages);
  if (validCurrentPage !== currentPage) {
    setCurrentPage(validCurrentPage);
  }

  const paginatedData = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, validCurrentPage, pageSize]);

  const goToPage = (page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
  };

  const nextPage = () => {
    if (validCurrentPage < totalPages) {
      setCurrentPage(validCurrentPage + 1);
    }
  };

  const previousPage = () => {
    if (validCurrentPage > 1) {
      setCurrentPage(validCurrentPage - 1);
    }
  };

  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Generate page numbers for pagination UI
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (validCurrentPage > 3) {
        pages.push('ellipsis');
      }

      // Show pages around current page
      const start = Math.max(2, validCurrentPage - 1);
      const end = Math.min(totalPages - 1, validCurrentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (validCurrentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return {
    paginatedData,
    currentPage: validCurrentPage,
    pageSize,
    totalItems,
    totalPages,
    pageSizeOptions,
    goToPage,
    nextPage,
    previousPage,
    changePageSize,
    getPageNumbers,
    hasNextPage: validCurrentPage < totalPages,
    hasPreviousPage: validCurrentPage > 1,
    startIndex: (validCurrentPage - 1) * pageSize + 1,
    endIndex: Math.min(validCurrentPage * pageSize, totalItems),
  };
}
