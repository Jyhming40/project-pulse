import { useMemo } from "react";
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Sigma, 
  BarChart2,
  Clock,
  Target,
  RotateCcw
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ComparisonResult, ComparisonStats, COMPARISON_PAIRS } from "@/hooks/useProjectComparison";
import { StageDefinition } from "@/types/compareConfig";
import { useEditableStages } from "@/hooks/useEditableStages";
import { EditableStageRow } from "./EditableStageRow";

interface ComparisonStatsCardsProps {
  results: ComparisonResult[];
  stats: ComparisonStats[];
  customStages?: StageDefinition[];
}

interface ExtendedStats {
  pairId: string;
  label: string;
  count: number;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  stdDev: number | null;
  baselineDays: number | null;
  baselineDelta: number | null; // baseline - average
  isCustom?: boolean;
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

export function ComparisonStatsCards({ results, stats, customStages = [] }: ComparisonStatsCardsProps) {
  const baseline = useMemo(() => results.find(r => r.isBaseline), [results]);
  
  // Editable stages hook
  const { 
    editableStages, 
    milestoneOptions, 
    updateStage, 
    resetStage, 
    resetAllStages, 
    hasEdits,
    getStageLabel 
  } = useEditableStages();
  
  // Calculate extended statistics including std deviation
  // Now respects editable stage configurations
  const extendedStats = useMemo((): ExtendedStats[] => {
    // Use editableStages instead of static COMPARISON_PAIRS for step intervals
    const systemStats = editableStages.map(stage => {
      // Calculate days dynamically based on current fromStep/toStep
      const allDays = results.map(r => {
        const fromDate = r.documentDates[stage.fromStep]?.date || null;
        const toDate = r.documentDates[stage.toStep]?.date || null;
        
        if (fromDate && toDate) {
          const from = new Date(fromDate);
          const to = new Date(toDate);
          const days = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
          return { isBaseline: r.isBaseline, days, status: 'complete' as const };
        }
        return { isBaseline: r.isBaseline, days: null, status: 'incomplete' as const };
      });

      // Get non-baseline valid days
      const validDays = allDays
        .filter(d => !d.isBaseline && d.days !== null)
        .map(d => d.days!);
      
      const count = validDays.length;
      const average = count > 0 ? Math.round(validDays.reduce((a, b) => a + b, 0) / count) : null;
      
      // Calculate median
      const sorted = [...validDays].sort((a, b) => a - b);
      const median = sorted.length > 0
        ? sorted.length % 2 === 0
          ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
          : sorted[Math.floor(sorted.length / 2)]
        : null;
      
      // Calculate standard deviation
      let stdDev: number | null = null;
      if (average !== null && validDays.length > 1) {
        const variance = validDays.reduce((sum, val) => {
          return sum + Math.pow(val - average, 2);
        }, 0) / validDays.length;
        stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
      }
      
      // Get baseline days
      const baselineData = allDays.find(d => d.isBaseline);
      const baselineDays = baselineData?.days ?? null;
      const baselineDelta = baselineDays !== null && average !== null 
        ? baselineDays - average 
        : null;
      
      // Generate dynamic label if edited
      const dynamicLabel = stage.isEdited 
        ? getStageLabel(stage.id)
        : stage.label;
      
      return {
        pairId: stage.id,
        label: dynamicLabel,
        count,
        average,
        median,
        min: sorted[0] ?? null,
        max: sorted[sorted.length - 1] ?? null,
        stdDev,
        baselineDays,
        baselineDelta,
        isCustom: false,
        // Additional fields for editable row
        fromStep: stage.fromStep,
        toStep: stage.toStep,
        isEdited: stage.isEdited,
        originalFromStep: stage.originalFromStep,
        originalToStep: stage.originalToStep,
      };
    });

    // Custom stages stats
    const customStats = customStages.map(stage => {
      // Calculate days for all projects
      const allDays = results.map(r => {
        const existing = r.intervals[stage.id];
        if (existing?.status === 'complete') {
          return { isBaseline: r.isBaseline, days: existing.days };
        }
        const calculated = calculateIntervalFromStage(r, stage);
        return { isBaseline: r.isBaseline, days: calculated.days };
      });

      // Get non-baseline valid days
      const validDays = allDays
        .filter(d => !d.isBaseline && d.days !== null)
        .map(d => d.days!);

      const count = validDays.length;
      const average = count > 0 ? Math.round(validDays.reduce((a, b) => a + b, 0) / count) : null;
      
      // Calculate median
      const sorted = [...validDays].sort((a, b) => a - b);
      const median = sorted.length > 0
        ? sorted.length % 2 === 0
          ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
          : sorted[Math.floor(sorted.length / 2)]
        : null;

      // Calculate std dev
      let stdDev: number | null = null;
      if (average !== null && validDays.length > 1) {
        const variance = validDays.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / validDays.length;
        stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
      }

      // Get baseline days
      const baselineData = allDays.find(d => d.isBaseline);
      const baselineDays = baselineData?.days ?? null;
      const baselineDelta = baselineDays !== null && average !== null ? baselineDays - average : null;

      return {
        pairId: stage.id,
        label: stage.label,
        count,
        average,
        median,
        min: sorted[0] ?? null,
        max: sorted[sorted.length - 1] ?? null,
        stdDev,
        baselineDays,
        baselineDelta,
        isCustom: true,
      };
    });

    return [...systemStats, ...customStats];
  }, [results, baseline, customStages, editableStages, getStageLabel]);

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    // Total interval stats
    const totalPair = COMPARISON_PAIRS.find(p => p.id === 'interval_total');
    const validTotals = results
      .filter(r => !r.isBaseline && r.intervals['interval_total']?.status === 'complete')
      .map(r => r.intervals['interval_total'].days!)
      .filter((d): d is number => d !== null);
    
    const average = validTotals.length > 0 
      ? Math.round(validTotals.reduce((a, b) => a + b, 0) / validTotals.length)
      : null;
    
    const sorted = [...validTotals].sort((a, b) => a - b);
    const median = sorted.length > 0
      ? sorted.length % 2 === 0
        ? Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
        : sorted[Math.floor(sorted.length / 2)]
      : null;
    
    let stdDev: number | null = null;
    if (average && validTotals.length > 1) {
      const variance = validTotals.reduce((sum, val) => {
        return sum + Math.pow(val - average, 2);
      }, 0) / validTotals.length;
      stdDev = Math.round(Math.sqrt(variance));
    }
    
    const baselineTotal = baseline?.intervals['interval_total'];
    const baselineDays = baselineTotal?.status === 'complete' ? baselineTotal.days : null;
    const baselineDelta = baselineDays !== null && average !== null 
      ? baselineDays - average 
      : null;
    
    return {
      projectCount: results.length - 1, // excluding baseline
      average,
      median,
      min: sorted[0] ?? null,
      max: sorted[sorted.length - 1] ?? null,
      stdDev,
      baselineDays,
      baselineDelta,
    };
  }, [results, baseline]);

  // Find stages where baseline is most delayed
  const worstStages = useMemo(() => {
    return extendedStats
      .filter(s => s.baselineDelta !== null && s.baselineDelta > 0)
      .sort((a, b) => (b.baselineDelta || 0) - (a.baselineDelta || 0))
      .slice(0, 3);
  }, [extendedStats]);

  if (results.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Overall stats row */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">同期平均</span>
              </div>
              <div className="text-2xl font-bold mt-1">
                {overallStats.average !== null ? `${overallStats.average}` : '-'}
                <span className="text-sm font-normal text-muted-foreground ml-1">天</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">中位數</span>
              </div>
              <div className="text-2xl font-bold mt-1">
                {overallStats.median !== null ? `${overallStats.median}` : '-'}
                <span className="text-sm font-normal text-muted-foreground ml-1">天</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Sigma className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">標準差</span>
              </div>
              <div className="text-2xl font-bold mt-1">
                {overallStats.stdDev !== null ? `±${overallStats.stdDev}` : '-'}
                <span className="text-sm font-normal text-muted-foreground ml-1">天</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">最快</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
                {overallStats.min !== null ? `${overallStats.min}` : '-'}
                <span className="text-sm font-normal text-muted-foreground ml-1">天</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-destructive" />
                <span className="text-sm text-muted-foreground">最慢</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-destructive">
                {overallStats.max !== null ? `${overallStats.max}` : '-'}
                <span className="text-sm font-normal text-muted-foreground ml-1">天</span>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            overallStats.baselineDelta !== null && overallStats.baselineDelta > 0 
              ? "border-destructive/50 bg-destructive/5" 
              : ""
          )}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">基準差異</span>
              </div>
              <div className={cn(
                "text-2xl font-bold mt-1",
                overallStats.baselineDelta !== null && overallStats.baselineDelta > 0 
                  ? "text-destructive" 
                  : overallStats.baselineDelta !== null && overallStats.baselineDelta < 0 
                    ? "text-green-600 dark:text-green-400"
                    : ""
              )}>
                {overallStats.baselineDelta !== null 
                  ? `${overallStats.baselineDelta > 0 ? '+' : ''}${overallStats.baselineDelta}` 
                  : '-'}
                <span className="text-sm font-normal text-muted-foreground ml-1">天</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Worst stages for baseline */}
        {worstStages.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-5 w-5 text-destructive" />
                基準案件延遲最嚴重的階段
              </CardTitle>
              <CardDescription>
                以下階段的耗時超過同期平均，是證明延遲的關鍵證據
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {worstStages.map((stage, index) => (
                  <Tooltip key={stage.pairId}>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-help",
                        index === 0 
                          ? "bg-destructive/10 border-destructive/30" 
                          : "bg-muted/50"
                      )}>
                        <Badge variant={index === 0 ? "destructive" : "secondary"}>
                          #{index + 1}
                        </Badge>
                        <div>
                          <div className="font-medium text-sm">{stage.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {stage.baselineDays}天 
                            <span className="text-destructive font-medium">
                              {" "}(+{stage.baselineDelta}天)
                            </span>
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>同期平均：{stage.average}天</p>
                      <p>基準案件：{stage.baselineDays}天</p>
                      <p>標準差：{stage.stdDev !== null ? `±${stage.stdDev}天` : 'N/A'}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stage-by-stage stats table */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">各階段統計數據</CardTitle>
                <CardDescription>
                  點擊階段名稱可調整起迄里程碑，數據將即時重新計算
                </CardDescription>
              </div>
              {hasEdits && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetAllStages}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  重設全部
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium min-w-[200px]">
                      階段
                      <span className="text-xs text-muted-foreground font-normal ml-2">
                        (點擊可編輯)
                      </span>
                    </th>
                    <th className="text-center py-2 px-2 font-medium">樣本數</th>
                    <th className="text-center py-2 px-2 font-medium">平均</th>
                    <th className="text-center py-2 px-2 font-medium">中位數</th>
                    <th className="text-center py-2 px-2 font-medium">標準差</th>
                    <th className="text-center py-2 px-2 font-medium">最小</th>
                    <th className="text-center py-2 px-2 font-medium">最大</th>
                    <th className="text-center py-2 px-2 font-medium bg-destructive/10">基準</th>
                    <th className="text-center py-2 px-2 font-medium bg-destructive/10">差異</th>
                  </tr>
                </thead>
                <tbody>
                  {extendedStats.map((stat) => {
                    // For system stages (non-custom), use EditableStageRow
                    if (!stat.isCustom && 'fromStep' in stat) {
                      const editableStat = stat as ExtendedStats & {
                        fromStep: number;
                        toStep: number;
                        isEdited: boolean;
                        originalFromStep?: number;
                        originalToStep?: number;
                      };
                      return (
                        <EditableStageRow
                          key={stat.pairId}
                          stageId={stat.pairId}
                          label={stat.label}
                          fromStep={editableStat.fromStep}
                          toStep={editableStat.toStep}
                          isEdited={editableStat.isEdited}
                          originalFromStep={editableStat.originalFromStep}
                          originalToStep={editableStat.originalToStep}
                          milestoneOptions={milestoneOptions}
                          onUpdate={updateStage}
                          onReset={resetStage}
                          count={stat.count}
                          average={stat.average}
                          median={stat.median}
                          stdDev={stat.stdDev}
                          min={stat.min}
                          max={stat.max}
                          baselineDays={stat.baselineDays}
                          baselineDelta={stat.baselineDelta}
                        />
                      );
                    }
                    
                    // For custom stages, render as before
                    return (
                      <tr key={stat.pairId} className={cn(
                        "border-b hover:bg-muted/30",
                        stat.isCustom && "bg-primary/5"
                      )}>
                        <td className="py-2 px-2 font-medium">
                          <div className="flex items-center gap-2">
                            {stat.label}
                            {stat.isCustom && (
                              <Badge variant="outline" className="text-xs">自定義</Badge>
                            )}
                          </div>
                        </td>
                        <td className="text-center py-2 px-2 text-muted-foreground">{stat.count}</td>
                        <td className="text-center py-2 px-2">
                          {stat.average !== null ? `${stat.average}天` : '-'}
                        </td>
                        <td className="text-center py-2 px-2">
                          {stat.median !== null ? `${stat.median}天` : '-'}
                        </td>
                        <td className="text-center py-2 px-2">
                          {stat.stdDev !== null ? `±${stat.stdDev}` : '-'}
                        </td>
                        <td className="text-center py-2 px-2 text-green-600 dark:text-green-400">
                          {stat.min !== null ? `${stat.min}天` : '-'}
                        </td>
                        <td className="text-center py-2 px-2 text-orange-600 dark:text-orange-400">
                          {stat.max !== null ? `${stat.max}天` : '-'}
                        </td>
                        <td className="text-center py-2 px-2 bg-destructive/5 font-medium">
                          {stat.baselineDays !== null ? `${stat.baselineDays}天` : '-'}
                        </td>
                        <td className={cn(
                          "text-center py-2 px-2 bg-destructive/5 font-bold",
                          stat.baselineDelta !== null && stat.baselineDelta > 0 
                            ? "text-destructive" 
                            : stat.baselineDelta !== null && stat.baselineDelta < 0 
                              ? "text-green-600 dark:text-green-400"
                              : ""
                        )}>
                          {stat.baselineDelta !== null 
                            ? `${stat.baselineDelta > 0 ? '+' : ''}${stat.baselineDelta}` 
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
