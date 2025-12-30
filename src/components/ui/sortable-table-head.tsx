import * as React from 'react';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { SortDirection } from '@/hooks/useTableSort';

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string;
  currentSortKey?: string;
  currentDirection?: SortDirection;
  sortIndex?: number; // For multi-column sort indicator
  onSort: (key: string, isMultiSort: boolean) => void;
  children: React.ReactNode;
}

export const SortableTableHead = React.forwardRef<
  HTMLTableCellElement,
  SortableTableHeadProps
>(
  (
    { className, sortKey, currentSortKey, currentDirection, sortIndex = 0, onSort, children, ...props },
    ref
  ) => {
    const isActive = currentSortKey === sortKey || sortIndex > 0;
    const direction = sortIndex > 0 ? currentDirection : (currentSortKey === sortKey ? currentDirection : null);

    const handleClick = (e: React.MouseEvent) => {
      onSort(sortKey, e.shiftKey);
    };

    return (
      <th
        ref={ref}
        className={cn(
          'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
          'cursor-pointer select-none hover:text-foreground transition-colors',
          isActive && 'text-foreground',
          className
        )}
        onClick={handleClick}
        title="點擊排序，Shift+點擊多欄排序"
        {...props}
      >
        <div className="flex items-center gap-1">
          {children}
          <span className="ml-1 flex items-center gap-0.5">
            {isActive && direction === 'asc' && (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
            {isActive && direction === 'desc' && (
              <ArrowDown className="h-3.5 w-3.5" />
            )}
            {(!isActive || !direction) && (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
            )}
            {sortIndex > 1 && (
              <span className="text-xs text-muted-foreground bg-muted rounded-full w-4 h-4 flex items-center justify-center">
                {sortIndex}
              </span>
            )}
          </span>
        </div>
      </th>
    );
  }
);

SortableTableHead.displayName = 'SortableTableHead';
