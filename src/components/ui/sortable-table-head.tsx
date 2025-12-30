import * as React from 'react';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { SortDirection } from '@/hooks/useTableSort';

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string;
  currentSortKey: string;
  currentDirection: SortDirection;
  onSort: (key: string) => void;
  children: React.ReactNode;
}

export const SortableTableHead = React.forwardRef<
  HTMLTableCellElement,
  SortableTableHeadProps
>(
  (
    { className, sortKey, currentSortKey, currentDirection, onSort, children, ...props },
    ref
  ) => {
    const isActive = currentSortKey === sortKey;

    return (
      <th
        ref={ref}
        className={cn(
          'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
          'cursor-pointer select-none hover:text-foreground transition-colors',
          isActive && 'text-foreground',
          className
        )}
        onClick={() => onSort(sortKey)}
        {...props}
      >
        <div className="flex items-center gap-1">
          {children}
          <span className="ml-1">
            {isActive && currentDirection === 'asc' && (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
            {isActive && currentDirection === 'desc' && (
              <ArrowDown className="h-3.5 w-3.5" />
            )}
            {(!isActive || !currentDirection) && (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
            )}
          </span>
        </div>
      </th>
    );
  }
);

SortableTableHead.displayName = 'SortableTableHead';
