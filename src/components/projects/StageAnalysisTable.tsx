import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, TrendingDown, TrendingUp, Minus, AlertOctagon, Flame } from "lucide-react";
import { COMPARISON_PAIRS, ComparisonResult, ComparisonStats } from "@/hooks/useProjectComparison";
import { StageDefinition } from "@/types/compareConfig";
import { useEditableStages } from "@/hooks/useEditableStages";
import { cn } from "@/lib/utils";

interface StageAnalysisTableProps {
  results: ComparisonResult[];
  stats: ComparisonStats[];
  customStages?: StageDefinition[];
}

// Calculate if a stage is a bottleneck (> 1.5x average)
function isBottleneck(days: number, average: number | null): 'critical' | 'warning' | null {
  if (!average || average === 0) return null;
  if (days > average * 2) return 'critical';
  if (days > average * 1.5) return 'warning';
  return null;
}

/**
 * Calculate interval data based on stage definition
 */
function calculateIntervalFromStage(
  result: ComparisonResult,
  stage: StageDefinition
): { days: number | null; status: 'complete' | 'incomplete' } {
  const fromDate = result.documentDates[stage.fromStep]?.date || null;
  const toDate = result.documentDates[stage.toStep]?.date || null;
  
  if (fromDate && toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const days = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return { days, status: 'complete' };
  }
  
  return { days: null, status: 'incomplete' };
}

export function StageAnalysisTable({ results, stats, customStages = [] }: StageAnalysisTableProps) {
  // Get editable stages configuration
  const { editableStages, getStageLabel } = useEditableStages();
  
  // Get baseline result
  const baselineResult = useMemo(() => {
    return results.find(r => r.isBaseline);
  }, [results]);

  // Use editableStages instead of static COMPARISON_PAIRS for step pairs
  const stepPairs = useMemo(() => {
    return editableStages.map(stage => ({
      id: stage.id,
      label: stage.isEdited ? getStageLabel(stage.id) : stage.label,
      description: `Step ${stage.fromStep} → ${stage.toStep}`,
      fromStep: stage.fromStep,
      toStep: stage.toStep,
      isEdited: stage.isEdited,
    }));
  }, [editableStages, getStageLabel]);
  
  // Get summary pairs (total, 同備到掛表, etc.)
  const summaryPairs = COMPARISON_PAIRS.slice(10);

  // Convert custom stages to pair-like objects for uniform handling
  const customPairs = useMemo(() => {
    return customStages.map(stage => ({
      id: stage.id,
      label: stage.label,
      description: stage.description || `${stage.fromStep} → ${stage.toStep}`,
      fromStep: stage.fromStep,
      toStep: stage.toStep,
      isCustom: true,
    }));
  }, [customStages]);

  // Calculate comparison data for each stage using edited milestone pairs
  const stageData = useMemo(() => {
    return stepPairs.map((pair, index) => {
      // Calculate days based on edited fromStep/toStep (not original intervals)
      const calculateDays = (r: ComparisonResult) => {
        const fromDate = r.documentDates[pair.fromStep]?.date || null;
        const toDate = r.documentDates[pair.toStep]?.date || null;
        
        if (fromDate && toDate) {
          const from = new Date(fromDate);
          const to = new Date(toDate);
          const days = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
          return { days, status: 'complete' as const };
        }
        
        if (!fromDate && !toDate) {
          return { days: null, status: 'na' as const };
        }
        
        return { days: null, status: 'incomplete' as const };
      };

      // Calculate all project days first to get average
      const allProjectDays = results.map(r => ({
        ...calculateDays(r),
        isBaseline: r.isBaseline,
      }));
      
      // Calculate average from non-baseline completed projects
      const validDays = allProjectDays
        .filter(d => !d.isBaseline && d.status === 'complete' && d.days !== null)
        .map(d => d.days!);
      
      const average = validDays.length > 0 
        ? Math.round(validDays.reduce((a, b) => a + b, 0) / validDays.length)
        : null;

      // Get baseline days
      const baselineData = allProjectDays.find(d => d.isBaseline);
      const baselineDays = baselineData?.status === 'complete' ? baselineData.days : null;
      
      // Check if baseline is bottleneck for this stage
      const baselineBottleneck = baselineDays !== null 
        ? isBottleneck(baselineDays, average) 
        : null;

      // Get all project data for this stage with delta calculation
      const projectData = results.map((r, idx) => {
        const data = allProjectDays[idx];
        
        if (data.status === 'na') {
          return { 
            projectName: r.project.project_name, 
            days: null, 
            delta: null, 
            status: 'na' as const,
            isBaseline: r.isBaseline,
            bottleneck: null
          };
        }
        if (data.status === 'incomplete') {
          return { 
            projectName: r.project.project_name, 
            days: null, 
            delta: null, 
            status: 'incomplete' as const,
            isBaseline: r.isBaseline,
            bottleneck: null
          };
        }
        
        const delta = r.isBaseline || data.days === null || baselineDays === null 
          ? null 
          : data.days - baselineDays;
        
        return {
          projectName: r.project.project_name,
          days: data.days,
          delta,
          status: 'complete' as const,
          isBaseline: r.isBaseline,
          bottleneck: data.days !== null ? isBottleneck(data.days, average) : null
        };
      });

      return {
        pair,
        step: index + 1,
        baselineDays,
        average,
        median: null, // Could calculate if needed
        projectData,
        baselineBottleneck,
      };
    });
  }, [results, stepPairs]);

  // Calculate custom stage data
  const customStageData = useMemo(() => {
    return customPairs.map((pair, index) => {
      // Calculate average for non-baseline projects
      const allDays = results.map(r => {
        const existing = r.intervals[pair.id];
        if (existing?.status === 'complete') {
          return { isBaseline: r.isBaseline, days: existing.days };
        }
        const calculated = calculateIntervalFromStage(r, { ...pair, isSystem: false, sortOrder: 0 });
        return { isBaseline: r.isBaseline, days: calculated.days };
      });

      const validDays = allDays
        .filter(d => !d.isBaseline && d.days !== null)
        .map(d => d.days!);

      const average = validDays.length > 0 
        ? Math.round(validDays.reduce((a, b) => a + b, 0) / validDays.length)
        : null;

      // Get baseline days
      const baselineData = allDays.find(d => d.isBaseline);
      const baselineDays = baselineData?.days ?? null;
      
      // Check if baseline is bottleneck for this stage
      const baselineBottleneck = baselineDays !== null 
        ? isBottleneck(baselineDays, average) 
        : null;

      // Get all project data for this stage
      const projectData = results.map(r => {
        const existing = r.intervals[pair.id];
        let days: number | null = null;
        let status: 'complete' | 'incomplete' | 'na' = 'incomplete';
        
        if (existing?.status === 'complete') {
          days = existing.days;
          status = 'complete';
        } else if (existing?.status === 'na') {
          status = 'na';
        } else {
          const calculated = calculateIntervalFromStage(r, { ...pair, isSystem: false, sortOrder: 0 });
          days = calculated.days;
          status = calculated.status;
        }

        const delta = r.isBaseline || days === null || baselineDays === null 
          ? null 
          : days - baselineDays;
        
        return {
          projectName: r.project.project_name,
          days,
          delta,
          status,
          isBaseline: r.isBaseline,
          bottleneck: days !== null ? isBottleneck(days, average) : null
        };
      });

      return {
        pair,
        step: `C${index + 1}`,
        baselineDays,
        average,
        median: null,
        projectData,
        baselineBottleneck,
        isCustom: true,
      };
    });
  }, [results, customPairs]);

  // Calculate summary rows
  const summaryData = useMemo(() => {
    return summaryPairs.map(pair => {
      const projectData = results.map(r => {
        const interval = r.intervals[pair.id];
        if (!interval || interval.status !== 'complete') {
          return { 
            projectName: r.project.project_name, 
            days: null, 
            delta: null, 
            status: 'incomplete' as const,
            isBaseline: r.isBaseline
          };
        }
        return {
          projectName: r.project.project_name,
          days: interval.days,
          delta: r.isBaseline ? null : interval.delta,
          status: 'complete' as const,
          isBaseline: r.isBaseline
        };
      });
      
      // Calculate average for non-baseline projects
      const validDays = results
        .filter(r => !r.isBaseline && r.intervals[pair.id]?.status === 'complete')
        .map(r => r.intervals[pair.id].days!)
        .filter(d => d !== null);
      
      const average = validDays.length > 0 
        ? Math.round(validDays.reduce((a, b) => a + b, 0) / validDays.length)
        : null;
      
      return { pair, projectData, average };
    });
  }, [results, summaryPairs]);

  if (results.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        請選擇案件以顯示分析表
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header explanation */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                階段耗時差異分析說明（以文件日期為準）
              </p>
              <p className="text-muted-foreground mt-1">
                此表計算各階段的「耗費天數」，日期來源為文件的發文日或送件日。
              </p>
              <div className="flex flex-wrap gap-3 mt-2">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-500" />
                  <span>落後基準/紅色背景=瓶頸</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-500" />
                  <span>領先基準</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-500" />
                  <span>嚴重瓶頸(超過1.5倍平均)</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <AlertOctagon className="h-3 w-3 text-red-500" />
                  <span>極度嚴重(超過2倍平均)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Step-by-step analysis table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[60px] text-center">步驟</TableHead>
                <TableHead className="min-w-[180px]">比較階段</TableHead>
                {results.map(r => (
                  <TableHead key={r.project.id} className="min-w-[140px] text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="max-w-[180px] text-wrap leading-tight cursor-help" title={r.project.project_name}>
                            {r.project.project_name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{r.project.project_name}</p>
                          <p className="text-xs text-muted-foreground">{r.project.project_code}</p>
                        </TooltipContent>
                      </Tooltip>
                      {r.isBaseline && (
                        <Badge variant="default" className="text-xs">基準</Badge>
                      )}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="min-w-[80px] text-center bg-muted">同期平均</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stageData.map((stage) => (
                <TableRow 
                  key={stage.pair.id} 
                  className={cn(
                    "hover:bg-muted/30",
                    stage.baselineBottleneck === 'critical' && "bg-red-100/50 dark:bg-red-900/20",
                    stage.baselineBottleneck === 'warning' && "bg-orange-100/50 dark:bg-orange-900/20"
                  )}
                >
                  <TableCell className="text-center font-medium text-muted-foreground">
                    <div className="flex items-center justify-center gap-1">
                      {stage.step}
                      {stage.baselineBottleneck === 'critical' && (
                        <AlertOctagon className="h-4 w-4 text-red-500" />
                      )}
                      {stage.baselineBottleneck === 'warning' && (
                        <Flame className="h-4 w-4 text-orange-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <div className="font-medium">{stage.pair.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {stage.pair.description}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{stage.pair.description}</p>
                        {stage.average !== null && (
                          <p className="text-xs mt-1">同期平均：{stage.average}天</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  {stage.projectData.map((pd, idx) => (
                    <TableCell key={idx} className="text-center">
                      <StageCell 
                        days={pd.days} 
                        delta={pd.delta} 
                        status={pd.status}
                        isBaseline={pd.isBaseline}
                        average={stage.average}
                        bottleneck={pd.bottleneck}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-center bg-muted/30 font-medium">
                    {stage.average !== null ? (
                      <span>{stage.average} 天</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              
              {/* Custom stages section */}
              {customStageData.length > 0 && (
                <>
                  <TableRow className="bg-primary/20 border-t-2">
                    <TableCell colSpan={2 + results.length + 1} className="py-2">
                      <span className="font-semibold text-sm">自定義階段</span>
                    </TableCell>
                  </TableRow>
                  
                  {customStageData.map((stage) => (
                    <TableRow 
                      key={stage.pair.id} 
                      className={cn(
                        "hover:bg-muted/30 bg-primary/5",
                        stage.baselineBottleneck === 'critical' && "bg-red-100/50 dark:bg-red-900/20",
                        stage.baselineBottleneck === 'warning' && "bg-orange-100/50 dark:bg-orange-900/20"
                      )}
                    >
                      <TableCell className="text-center font-medium text-muted-foreground">
                        <div className="flex items-center justify-center gap-1">
                          {stage.step}
                          {stage.baselineBottleneck === 'critical' && (
                            <AlertOctagon className="h-4 w-4 text-red-500" />
                          )}
                          {stage.baselineBottleneck === 'warning' && (
                            <Flame className="h-4 w-4 text-orange-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div className="font-medium flex items-center gap-2">
                                {stage.pair.label}
                                <Badge variant="outline" className="text-xs">自定義</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {stage.pair.description}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{stage.pair.description}</p>
                            {stage.average !== null && (
                              <p className="text-xs mt-1">同期平均：{stage.average}天</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      {stage.projectData.map((pd, idx) => (
                        <TableCell key={idx} className="text-center">
                          <StageCell 
                            days={pd.days} 
                            delta={pd.delta} 
                            status={pd.status}
                            isBaseline={pd.isBaseline}
                            average={stage.average}
                            bottleneck={pd.bottleneck}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center bg-muted/30 font-medium">
                        {stage.average !== null ? (
                          <span>{stage.average} 天</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}
              
              {/* Summary rows */}
              <TableRow className="bg-muted/30 border-t-2">
                <TableCell colSpan={2 + results.length + 1} className="py-2">
                  <span className="font-semibold text-sm">總結區間</span>
                </TableCell>
              </TableRow>
              
              {summaryData.map((summary) => (
                <TableRow key={summary.pair.id} className="bg-primary/5 hover:bg-primary/10">
                  <TableCell className="text-center font-medium text-muted-foreground">
                    ∑
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{summary.pair.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {summary.pair.description}
                    </div>
                  </TableCell>
                  {summary.projectData.map((pd, idx) => (
                    <TableCell key={idx} className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn(
                          "font-bold text-lg",
                          pd.status === 'incomplete' && "text-muted-foreground"
                        )}>
                          {pd.status === 'complete' && pd.days !== null 
                            ? `${pd.days} 天` 
                            : '未完成'}
                        </span>
                        {!pd.isBaseline && pd.delta !== null && pd.delta !== 0 && (
                          <DeltaBadge delta={pd.delta} size="sm" />
                        )}
                        {pd.isBaseline && pd.status === 'complete' && (
                          <Badge variant="outline" className="text-xs">基準</Badge>
                        )}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className="text-center bg-muted/30 font-medium">
                    {summary.average !== null ? (
                      <span>{summary.average} 天</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}

interface StageCellProps {
  days: number | null;
  delta: number | null;
  status: 'complete' | 'incomplete' | 'na';
  isBaseline: boolean;
  average: number | null;
  bottleneck: 'critical' | 'warning' | null;
}

function StageCell({ days, delta, status, isBaseline, average, bottleneck }: StageCellProps) {
  if (status === 'na') {
    return <span className="text-muted-foreground text-sm">N/A</span>;
  }
  
  if (status === 'incomplete' || days === null) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  // For baseline, compare with average
  const effectiveDelta = isBaseline 
    ? (average !== null ? days - average : null) 
    : delta;
  
  const isDelayed = effectiveDelta !== null && effectiveDelta > 0;
  const isAhead = effectiveDelta !== null && effectiveDelta < 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        "flex items-center gap-1",
        isDelayed && "text-red-600 dark:text-red-400",
        isAhead && "text-green-600 dark:text-green-400"
      )}>
        {bottleneck === 'critical' && (
          <AlertOctagon className="h-4 w-4 text-red-500" />
        )}
        {bottleneck === 'warning' && (
          <Flame className="h-4 w-4 text-orange-500" />
        )}
        <span className={cn(
          "font-medium text-lg",
          bottleneck === 'critical' && "font-bold",
          bottleneck === 'warning' && "font-semibold"
        )}>
          {days} 天
        </span>
      </div>
      {!isBaseline && delta !== null && (
        <DeltaBadge delta={delta} />
      )}
      {isBaseline && (
        <Badge variant="outline" className="text-xs">基準</Badge>
      )}
    </div>
  );
}

interface DeltaBadgeProps {
  delta: number;
  size?: 'sm' | 'default';
}

function DeltaBadge({ delta, size = 'default' }: DeltaBadgeProps) {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  
  if (delta === 0) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground",
        size === 'sm' ? "text-xs" : "text-sm"
      )}>
        <Minus className={cn(size === 'sm' ? "h-3 w-3" : "h-4 w-4")} />
        0
      </div>
    );
  }

  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium",
      size === 'sm' ? "text-xs" : "text-sm",
      isPositive && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      isNegative && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    )}>
      {isPositive ? (
        <TrendingUp className={cn(size === 'sm' ? "h-3 w-3" : "h-4 w-4")} />
      ) : (
        <TrendingDown className={cn(size === 'sm' ? "h-3 w-3" : "h-4 w-4")} />
      )}
      {isPositive ? '+' : ''}{delta}
    </div>
  );
}
