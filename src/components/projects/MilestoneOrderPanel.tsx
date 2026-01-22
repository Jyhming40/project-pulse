import { useState, useEffect } from "react";
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
import { GripVertical, RotateCcw, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  useMilestoneOrder,
  useSaveMilestoneOrder,
  useResetMilestoneOrder,
  DEFAULT_MILESTONE_ORDER,
  getMilestoneItemsInOrder,
  MilestoneOrderItem,
} from "@/hooks/useMilestoneOrder";

interface SortableItemProps {
  item: MilestoneOrderItem;
  index: number;
}

function SortableItem({ item, index }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.code });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-md border bg-background ${
        isDragging ? "shadow-lg ring-2 ring-primary" : ""
      }`}
    >
      <button
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <Badge
        variant="outline"
        className="w-6 h-6 flex items-center justify-center p-0 text-xs"
        style={{ borderColor: item.color, color: item.color }}
      >
        {index + 1}
      </Badge>
      <span className="text-sm flex-1 truncate">{item.short}</span>
    </div>
  );
}

interface MilestoneOrderPanelProps {
  onOrderChange?: (order: string[] | null) => void;
}

export function MilestoneOrderPanel({ onOrderChange }: MilestoneOrderPanelProps) {
  const { data: savedOrder, isLoading } = useMilestoneOrder();
  const saveMutation = useSaveMilestoneOrder();
  const resetMutation = useResetMilestoneOrder();

  const [localOrder, setLocalOrder] = useState<string[]>(DEFAULT_MILESTONE_ORDER);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize from saved order
  useEffect(() => {
    if (savedOrder && savedOrder.length > 0) {
      setLocalOrder(savedOrder);
      onOrderChange?.(savedOrder);
    } else {
      setLocalOrder(DEFAULT_MILESTONE_ORDER);
      onOrderChange?.(null);
    }
  }, [savedOrder, onOrderChange]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const items = getMilestoneItemsInOrder(localOrder);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocalOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        setHasChanges(true);
        onOrderChange?.(newOrder);
        return newOrder;
      });
    }
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(localOrder);
      setHasChanges(false);
      toast.success("里程碑順序已儲存");
    } catch (error) {
      toast.error("儲存失敗");
    }
  };

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync();
      setLocalOrder(DEFAULT_MILESTONE_ORDER);
      setHasChanges(false);
      onOrderChange?.(null);
      toast.success("已重設為預設順序");
    } catch (error) {
      toast.error("重設失敗");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">里程碑順序</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="h-7 px-2"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            重設
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className="h-7 px-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Save className="h-3 w-3 mr-1" />
            )}
            儲存
          </Button>
        </div>
      </div>

      <Separator />

      <p className="text-xs text-muted-foreground">
        拖曳調整里程碑的顯示順序，所有圖表將同步更新
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
            {items.map((item, index) => (
              <SortableItem key={item.code} item={item} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {hasChanges && (
        <p className="text-xs text-amber-600">
          ※ 順序已變更，請點擊「儲存」以保留設定
        </p>
      )}
    </div>
  );
}
