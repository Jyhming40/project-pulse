import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { GripVertical, LayoutGrid, RotateCcw, Columns2, Columns3, Square } from 'lucide-react';
import { PortfolioChartItem, ChartSpan } from '@/hooks/usePortfolioLayout';

interface PortfolioLayoutPanelProps {
  charts: PortfolioChartItem[];
  onToggle: (id: string) => void;
  onSetSpan: (id: string, span: ChartSpan) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onReset: () => void;
}

const SPAN_OPTIONS: { value: ChartSpan; icon: React.ReactNode; label: string }[] = [
  { value: 1, icon: <Columns3 className="w-3.5 h-3.5" />, label: '1/3' },
  { value: 2, icon: <Columns2 className="w-3.5 h-3.5" />, label: '2/3' },
  { value: 3, icon: <Square className="w-3.5 h-3.5" />, label: '整行' },
];

export function PortfolioLayoutPanel({
  charts,
  onToggle,
  onSetSpan,
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
      <PopoverContent className="w-80 p-3" align="end">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">圖表配置</span>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={onReset}>
            <RotateCcw className="w-3 h-3" />
            重置
          </Button>
        </div>
        <div className="space-y-1.5">
          {charts.map((chart, index) => (
            <div
              key={chart.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 p-2 rounded-md transition-colors border ${
                dragIndex === index ? 'bg-accent border-primary/30' : 'border-transparent hover:bg-muted/50'
              } cursor-grab active:cursor-grabbing`}
            >
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate select-none">{chart.label}</span>
                  <Switch
                    checked={chart.visible}
                    onCheckedChange={() => onToggle(chart.id)}
                    className="scale-75 flex-shrink-0"
                  />
                </div>
                {chart.visible && (
                  <ToggleGroup
                    type="single"
                    value={chart.span.toString()}
                    onValueChange={(val) => {
                      if (val) onSetSpan(chart.id, Number(val) as ChartSpan);
                    }}
                    className="mt-1.5 justify-start"
                    size="sm"
                  >
                    {SPAN_OPTIONS.map(opt => (
                      <ToggleGroupItem
                        key={opt.value}
                        value={opt.value.toString()}
                        className="h-6 px-2 text-xs gap-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        aria-label={opt.label}
                      >
                        {opt.icon}
                        {opt.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
