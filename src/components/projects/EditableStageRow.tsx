import { useState } from "react";
import { RotateCcw, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MilestoneOption {
  step: number;
  label: string;
  shortLabel: string;
  color: string;
}

interface EditableStageRowProps {
  stageId: string;
  label: string;
  fromStep: number;
  toStep: number;
  isEdited: boolean;
  originalFromStep?: number;
  originalToStep?: number;
  milestoneOptions: MilestoneOption[];
  onUpdate: (stageId: string, fromStep: number, toStep: number) => void;
  onReset: (stageId: string) => void;
  // Stats data
  count: number;
  average: number | null;
  median: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  baselineDays: number | null;
  baselineDelta: number | null;
}

export function EditableStageRow({
  stageId,
  label,
  fromStep,
  toStep,
  isEdited,
  originalFromStep,
  originalToStep,
  milestoneOptions,
  onUpdate,
  onReset,
  count,
  average,
  median,
  stdDev,
  min,
  max,
  baselineDays,
  baselineDelta,
}: EditableStageRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempFrom, setTempFrom] = useState(fromStep);
  const [tempTo, setTempTo] = useState(toStep);

  const handleStartEdit = () => {
    setTempFrom(fromStep);
    setTempTo(toStep);
    setIsEditing(true);
  };

  const handleConfirm = () => {
    if (tempFrom !== tempTo) {
      onUpdate(stageId, tempFrom, tempTo);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempFrom(fromStep);
    setTempTo(toStep);
    setIsEditing(false);
  };

  const handleReset = () => {
    onReset(stageId);
    setIsEditing(false);
  };

  const fromMilestone = milestoneOptions.find(m => m.step === fromStep);
  const toMilestone = milestoneOptions.find(m => m.step === toStep);

  // Generate dynamic label based on current milestones
  const dynamicLabel = isEdited 
    ? `${fromMilestone?.shortLabel || '?'}→${toMilestone?.shortLabel || '?'}`
    : label;

  return (
    <tr className={cn(
      "border-b hover:bg-muted/30",
      isEdited && "bg-amber-50 dark:bg-amber-950/20"
    )}>
      {/* 階段名稱欄位 - 可編輯 */}
      <td className="py-2 px-2">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Select
                value={String(tempFrom)}
                onValueChange={(v) => setTempFrom(Number(v))}
              >
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {milestoneOptions.map(m => (
                    <SelectItem key={m.step} value={String(m.step)} disabled={m.step === tempTo}>
                      <span className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: m.color }}
                        />
                        {m.shortLabel}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">→</span>
              <Select
                value={String(tempTo)}
                onValueChange={(v) => setTempTo(Number(v))}
              >
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {milestoneOptions.map(m => (
                    <SelectItem key={m.step} value={String(m.step)} disabled={m.step === tempFrom}>
                      <span className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: m.color }}
                        />
                        {m.shortLabel}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleConfirm}
                disabled={tempFrom === tempTo}
              >
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCancel}
              >
                <X className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center gap-2 hover:bg-muted/50 rounded px-1 py-0.5 cursor-pointer text-left"
                  onClick={handleStartEdit}
                >
                  <span className="font-medium">{dynamicLabel}</span>
                  <Edit2 className="h-3 w-3 text-muted-foreground opacity-50 hover:opacity-100" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>點擊可調整起迄里程碑</p>
                <p className="text-xs text-muted-foreground">
                  {fromMilestone?.label} → {toMilestone?.label}
                </p>
              </TooltipContent>
            </Tooltip>
            {isEdited && (
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300">
                  已調整
                </Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={handleReset}
                    >
                      <RotateCcw className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>重設為預設值</p>
                    <p className="text-xs text-muted-foreground">
                      {milestoneOptions.find(m => m.step === originalFromStep)?.shortLabel} → 
                      {milestoneOptions.find(m => m.step === originalToStep)?.shortLabel}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        )}
      </td>

      {/* 統計數據欄位 */}
      <td className="text-center py-2 px-2 text-muted-foreground">{count}</td>
      <td className="text-center py-2 px-2">
        {average !== null ? `${average}天` : '-'}
      </td>
      <td className="text-center py-2 px-2">
        {median !== null ? `${median}天` : '-'}
      </td>
      <td className="text-center py-2 px-2">
        {stdDev !== null ? `±${stdDev}` : '-'}
      </td>
      <td className="text-center py-2 px-2 text-green-600 dark:text-green-400">
        {min !== null ? `${min}天` : '-'}
      </td>
      <td className="text-center py-2 px-2 text-orange-600 dark:text-orange-400">
        {max !== null ? `${max}天` : '-'}
      </td>
      <td className="text-center py-2 px-2 bg-destructive/5 font-medium">
        {baselineDays !== null ? `${baselineDays}天` : '-'}
      </td>
      <td className={cn(
        "text-center py-2 px-2 bg-destructive/5 font-bold",
        baselineDelta !== null && baselineDelta > 0 
          ? "text-destructive" 
          : baselineDelta !== null && baselineDelta < 0 
            ? "text-green-600 dark:text-green-400"
            : ""
      )}>
        {baselineDelta !== null 
          ? `${baselineDelta > 0 ? '+' : ''}${baselineDelta}天` 
          : '-'}
      </td>
    </tr>
  );
}
