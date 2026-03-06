import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { PortfolioChartItem } from '@/hooks/usePortfolioLayout';

interface SortableChartCardProps {
  chart: PortfolioChartItem;
  children: React.ReactNode;
}

export function SortableChartCard({ chart, children }: SortableChartCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chart.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${
        chart.span === 3 ? 'col-span-3' :
        chart.span === 2 ? 'col-span-3 lg:col-span-2' :
        'col-span-3 lg:col-span-1'
      } ${isDragging ? 'opacity-50 z-50' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1 rounded-md bg-muted/80 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="拖曳排序"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      {children}
    </div>
  );
}
