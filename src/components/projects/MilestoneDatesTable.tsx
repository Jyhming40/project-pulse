import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TIMELINE_DOC_MAPPING, ComparisonResult } from "@/hooks/useProjectComparison";
import { useMilestoneOrder } from "@/hooks/useMilestoneOrder";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Check, X, GripVertical, RotateCcw, Loader2 } from "lucide-react";

interface MilestoneDatesTableProps {
  results: ComparisonResult[];
}

interface SortableRowProps {
  milestone: typeof TIMELINE_DOC_MAPPING[number];
  displayIndex: number;
  results: ComparisonResult[];
  formatDate: (dateStr: string | null | undefined) => string | null;
}

function SortableRow({ milestone, displayIndex, results, formatDate }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: milestone.step });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? "hsl(var(--muted))" : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className="hover:bg-muted/30">
      <TableCell className="text-center font-medium text-muted-foreground w-[40px]">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="text-center font-medium text-muted-foreground w-[50px]">
        {displayIndex}
      </TableCell>
      <TableCell>
        <div className="font-medium">{milestone.short}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[140px]" title={milestone.label}>
          {milestone.label}
        </div>
      </TableCell>
      {results.map(r => {
        const docDate = r.documentDates?.[milestone.step];
        const date = docDate?.date;
        const formattedDate = formatDate(date);
        
        return (
          <TableCell key={r.project.id} className="text-center">
            {formattedDate ? (
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-500" />
                  <span className="text-sm font-medium">{formattedDate}</span>
                </div>
                {docDate?.doc_type && (
                  <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={docDate.doc_type}>
                    {docDate.doc_type.length > 8 ? docDate.doc_type.substring(0, 8) + '...' : docDate.doc_type}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <X className="h-3 w-3" />
                <span className="text-sm">-</span>
              </div>
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

export function MilestoneDatesTable({ results }: MilestoneDatesTableProps) {
  const { order, orderedMilestones, isCustomOrder, resetOrder, isSaving, moveMilestone } = useMilestoneOrder();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = order.findIndex(step => step === active.id);
      const newIndex = order.findIndex(step => step === over.id);
      moveMilestone(oldIndex, newIndex);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd', { locale: zhTW });
    } catch {
      return dateStr.split('T')[0];
    }
  };

  if (results.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        請選擇案件以顯示里程碑日期
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Header with reset button */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <GripVertical className="h-4 w-4" />
            <span>拖拉調整順序，圖表將同步更新</span>
          </div>
          {isCustomOrder && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetOrder}
                  disabled={isSaving}
                  className="gap-1"
                >
                  {isSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  重設順序
                </Button>
              </TooltipTrigger>
              <TooltipContent>還原為預設順序</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[50px] text-center">項次</TableHead>
                  <TableHead className="min-w-[150px]">里程碑/文件</TableHead>
                  {results.map(r => (
                    <TableHead key={r.project.id} className="min-w-[110px] text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="truncate max-w-[100px]" title={r.project.project_name}>
                          {r.project.project_name.length > 8 
                            ? r.project.project_name.substring(0, 8) + '...'
                            : r.project.project_name}
                        </span>
                        {r.isBaseline && (
                          <Badge variant="destructive" className="text-xs">卡關</Badge>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext items={order} strategy={verticalListSortingStrategy}>
                  {orderedMilestones.map((milestone, index) => (
                    <SortableRow
                      key={milestone.step}
                      milestone={milestone}
                      displayIndex={index + 1}
                      results={results}
                      formatDate={formatDate}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </div>
      </div>
    </TooltipProvider>
  );
}
