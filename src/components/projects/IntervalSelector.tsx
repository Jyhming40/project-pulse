import { useState, useMemo } from "react";
import { Check, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { COMPARISON_PAIRS } from "@/hooks/useProjectComparison";

interface IntervalSelectorProps {
  selectedIntervals: string[];
  onSelectionChange: (intervals: string[]) => void;
}

export function IntervalSelector({
  selectedIntervals,
  onSelectionChange,
}: IntervalSelectorProps) {
  const [open, setOpen] = useState(false);

  // Separate step-by-step and summary intervals
  const stepPairs = COMPARISON_PAIRS.slice(0, 10);
  const summaryPairs = COMPARISON_PAIRS.slice(10);

  const allSelected = selectedIntervals.length === COMPARISON_PAIRS.length;
  const noneSelected = selectedIntervals.length === 0;

  const toggleInterval = (intervalId: string) => {
    if (selectedIntervals.includes(intervalId)) {
      onSelectionChange(selectedIntervals.filter(id => id !== intervalId));
    } else {
      onSelectionChange([...selectedIntervals, intervalId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(COMPARISON_PAIRS.map(p => p.id));
  };

  const selectNone = () => {
    onSelectionChange([]);
  };

  const selectStepOnly = () => {
    onSelectionChange(stepPairs.map(p => p.id));
  };

  const selectSummaryOnly = () => {
    onSelectionChange(summaryPairs.map(p => p.id));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          選擇區間
          {!allSelected && (
            <Badge variant="secondary" className="text-xs ml-1">
              {selectedIntervals.length}/{COMPARISON_PAIRS.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm">選擇要輸出的比較區間</h4>
          <p className="text-xs text-muted-foreground mt-1">
            勾選的區間將包含在法務版輸出中
          </p>
        </div>
        
        {/* Quick actions */}
        <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={selectAll}
          >
            全選
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={selectNone}
          >
            清除
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={selectStepOnly}
          >
            僅步驟區間
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={selectSummaryOnly}
          >
            僅總結區間
          </Button>
        </div>
        
        <ScrollArea className="h-[300px]">
          <div className="p-2 space-y-3">
            {/* Step-by-step intervals */}
            <div>
              <div className="text-xs font-medium text-muted-foreground px-2 mb-2">
                步驟區間 (Step-by-step)
              </div>
              <div className="space-y-1">
                {stepPairs.map((pair, index) => (
                  <div
                    key={pair.id}
                    className={cn(
                      "flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50",
                      selectedIntervals.includes(pair.id) && "bg-muted"
                    )}
                    onClick={() => toggleInterval(pair.id)}
                  >
                    <Checkbox
                      id={pair.id}
                      checked={selectedIntervals.includes(pair.id)}
                      onCheckedChange={() => toggleInterval(pair.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={pair.id}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {index + 1}. {pair.label}
                      </Label>
                      <p className="text-xs text-muted-foreground truncate">
                        {pair.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Summary intervals */}
            <div>
              <div className="text-xs font-medium text-muted-foreground px-2 mb-2">
                總結區間 (Summary)
              </div>
              <div className="space-y-1">
                {summaryPairs.map((pair) => (
                  <div
                    key={pair.id}
                    className={cn(
                      "flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50",
                      selectedIntervals.includes(pair.id) && "bg-primary/10"
                    )}
                    onClick={() => toggleInterval(pair.id)}
                  >
                    <Checkbox
                      id={pair.id}
                      checked={selectedIntervals.includes(pair.id)}
                      onCheckedChange={() => toggleInterval(pair.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={pair.id}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {pair.label}
                      </Label>
                      <p className="text-xs text-muted-foreground truncate">
                        {pair.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <div className="p-2 border-t bg-muted/30">
          <Button
            size="sm"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            <Check className="mr-2 h-4 w-4" />
            確定 ({selectedIntervals.length} 個區間)
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
