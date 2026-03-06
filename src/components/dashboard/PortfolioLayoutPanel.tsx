import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GripVertical, LayoutGrid, RotateCcw } from 'lucide-react';
import { PortfolioChartItem } from '@/hooks/usePortfolioLayout';

interface PortfolioLayoutPanelProps {
  charts: PortfolioChartItem[];
  onToggle: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onReset: () => void;
}

export function PortfolioLayoutPanel({
  charts,
  onToggle,
  onReorder,
  onReset,
}: PortfolioLayoutPanelProps) {
  const [open, setOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    onReorder(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <LayoutGrid className="w-4 h-4" />
          版面配置
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">圖表配置</span>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={onReset}>
            <RotateCcw className="w-3 h-3" />
            重置
          </Button>
        </div>
        <div className="space-y-1">
          {charts.map((chart, index) => (
            <div
              key={chart.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                dragIndex === index ? 'bg-accent' : 'hover:bg-muted/50'
              } cursor-grab active:cursor-grabbing`}
            >
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm flex-1 select-none">{chart.label}</span>
              <Switch
                checked={chart.visible}
                onCheckedChange={() => onToggle(chart.id)}
                className="scale-75"
              />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
