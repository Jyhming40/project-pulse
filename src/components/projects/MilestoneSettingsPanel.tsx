import { useState, useEffect } from "react";
import { 
  GripVertical, 
  Check, 
  RotateCcw, 
  Save,
  ChevronDown,
  ChevronUp,
  Settings2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { COMPARISON_PAIRS, TIMELINE_DOC_MAPPING } from "@/hooks/useProjectComparison";
import { useUserMilestoneSettings } from "@/hooks/useUserMilestoneSettings";
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

// Separate step intervals from summary intervals
const STEP_INTERVALS = COMPARISON_PAIRS.filter(p => 
  p.id.match(/^interval_\d{2}_\d{2}$/) && !p.id.includes('total')
);
const SUMMARY_INTERVALS = COMPARISON_PAIRS.filter(p => 
  !p.id.match(/^interval_\d{2}_\d{2}$/) || p.id.includes('total')
);

interface SortableMilestoneItemProps {
  id: string;
  label: string;
  shortLabel: string;
  step: number;
  color: string;
}

function SortableMilestoneItem({ id, label, shortLabel, step, color }: SortableMilestoneItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-muted/50 transition-colors ${
        isDragging ? 'ring-2 ring-primary' : ''
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{shortLabel}</div>
        <div className="text-xs text-muted-foreground truncate">{label}</div>
      </div>
      <Badge variant="outline" className="text-xs flex-shrink-0">
        {step}
      </Badge>
    </div>
  );
}

export function MilestoneSettingsPanel() {
  const {
    settings,
    isLoading,
    isUpdating,
    milestoneOrder,
    selectedIntervals,
    updateSettings,
    resetToDefaults,
  } = useUserMilestoneSettings();

  // Local state for editing
  const [localMilestoneOrder, setLocalMilestoneOrder] = useState<string[]>(milestoneOrder);
  const [localSelectedIntervals, setLocalSelectedIntervals] = useState<string[]>(selectedIntervals);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Section collapse state
  const [intervalsExpanded, setIntervalsExpanded] = useState(true);
  const [milestonesExpanded, setMilestonesExpanded] = useState(true);

  // Sync local state with server state
  useEffect(() => {
    setLocalMilestoneOrder(milestoneOrder);
    setLocalSelectedIntervals(selectedIntervals);
    setHasChanges(false);
  }, [milestoneOrder, selectedIntervals]);

  // Track changes
  useEffect(() => {
    const orderChanged = JSON.stringify(localMilestoneOrder) !== JSON.stringify(milestoneOrder);
    const intervalsChanged = JSON.stringify(localSelectedIntervals.sort()) !== JSON.stringify(selectedIntervals.sort());
    setHasChanges(orderChanged || intervalsChanged);
  }, [localMilestoneOrder, localSelectedIntervals, milestoneOrder, selectedIntervals]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalMilestoneOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleInterval = (intervalId: string) => {
    setLocalSelectedIntervals(prev => 
      prev.includes(intervalId)
        ? prev.filter(id => id !== intervalId)
        : [...prev, intervalId]
    );
  };

  const selectAllIntervals = () => {
    setLocalSelectedIntervals(COMPARISON_PAIRS.map(p => p.id));
  };

  const selectStepIntervalsOnly = () => {
    setLocalSelectedIntervals(STEP_INTERVALS.map(p => p.id));
  };

  const handleSave = async () => {
    await updateSettings({
      milestone_order: localMilestoneOrder,
      selected_intervals: localSelectedIntervals,
    });
  };

  const handleReset = async () => {
    await resetToDefaults();
  };

  // Build milestone items for sortable list
  const milestoneItems = localMilestoneOrder.map(code => {
    const milestone = TIMELINE_DOC_MAPPING.find(
      m => `STEP_${m.step.toString().padStart(2, '0')}` === code
    );
    return milestone ? {
      id: code,
      label: milestone.label,
      shortLabel: milestone.short,
      step: milestone.step,
      color: milestone.color,
    } : null;
  }).filter(Boolean) as SortableMilestoneItemProps[];

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        載入設定中...
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header with save/reset buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">比較設定</span>
          </div>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleReset}
                  disabled={isUpdating}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>重設為預設</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={hasChanges ? "default" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleSave}
                  disabled={!hasChanges || isUpdating}
                >
                  {isUpdating ? (
                    <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>儲存設定</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {hasChanges && (
          <Badge variant="outline" className="text-xs w-full justify-center py-1">
            有未儲存的變更
          </Badge>
        )}

        {/* Interval Selection */}
        <Collapsible open={intervalsExpanded} onOpenChange={setIntervalsExpanded}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md p-2 -mx-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">選擇比較區間</span>
                <Badge variant="secondary" className="text-xs">
                  {localSelectedIntervals.length}/{COMPARISON_PAIRS.length}
                </Badge>
              </div>
              {intervalsExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-3">
              {/* Quick actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 flex-1"
                  onClick={selectAllIntervals}
                >
                  全選
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 flex-1"
                  onClick={selectStepIntervalsOnly}
                >
                  只選連續
                </Button>
              </div>

              <ScrollArea className="h-[200px] pr-2">
                <div className="space-y-3">
                  {/* Step intervals */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">連續節點區間</Label>
                    {STEP_INTERVALS.map(pair => (
                      <div key={pair.id} className="flex items-center gap-2 py-1">
                        <Checkbox
                          id={pair.id}
                          checked={localSelectedIntervals.includes(pair.id)}
                          onCheckedChange={() => toggleInterval(pair.id)}
                        />
                        <label
                          htmlFor={pair.id}
                          className="text-xs cursor-pointer flex-1 leading-none"
                        >
                          {pair.label}
                        </label>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Summary intervals */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">跨流程區間</Label>
                    {SUMMARY_INTERVALS.map(pair => (
                      <div key={pair.id} className="flex items-center gap-2 py-1">
                        <Checkbox
                          id={pair.id}
                          checked={localSelectedIntervals.includes(pair.id)}
                          onCheckedChange={() => toggleInterval(pair.id)}
                        />
                        <label
                          htmlFor={pair.id}
                          className="text-xs cursor-pointer flex-1 leading-none"
                        >
                          {pair.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Milestone Order */}
        <Collapsible open={milestonesExpanded} onOpenChange={setMilestonesExpanded}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md p-2 -mx-2">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">里程碑順序</span>
              </div>
              {milestonesExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">
              拖曳調整里程碑的顯示順序
            </p>
            <ScrollArea className="h-[300px] pr-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={milestoneItems.map(m => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {milestoneItems.map((item) => (
                      <SortableMilestoneItem
                        key={item.id}
                        {...item}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </TooltipProvider>
  );
}
