import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SortableSectionCardProps {
  id: string;
  children: ReactNode;
  isDragEnabled?: boolean;
}

export function SortableSectionCard({ 
  id, 
  children, 
  isDragEnabled = true 
}: SortableSectionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isDragEnabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50")}>
      <Card className="relative group">
        {isDragEnabled && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-2 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity touch-none z-10"
            style={{ touchAction: 'none' }}
            aria-label="拖曳排序"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        {children}
      </Card>
    </div>
  );
}
