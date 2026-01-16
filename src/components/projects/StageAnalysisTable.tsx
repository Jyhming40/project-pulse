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
import { AlertTriangle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { COMPARISON_PAIRS, ComparisonResult, ComparisonStats } from "@/hooks/useProjectComparison";
import { cn } from "@/lib/utils";

interface StageAnalysisTableProps {
  results: ComparisonResult[];
  stats: ComparisonStats[];
}

export function StageAnalysisTable({ results, stats }: StageAnalysisTableProps) {
  // Get baseline result
  const baselineResult = useMemo(() => {
    return results.find(r => r.isBaseline);
  }, [results]);

  // Calculate comparison data for each stage
  const stageData = useMemo(() => {
    return COMPARISON_PAIRS.map((pair, index) => {
      const stat = stats.find(s => s.pairId === pair.id);
      
      // Get baseline days
      const baselineInterval = baselineResult?.intervals[pair.id];
      const baselineDays = baselineInterval?.status === 'complete' 
        ? baselineInterval.days 
        : null;

      // Get all project data for this stage
      const projectData = results.map(r => {
        const interval = r.intervals[pair.id];
        if (!interval || interval.status === 'na') {
          return { 
            projectName: r.project.project_name, 
            days: null, 
            delta: null, 
            status: 'na' as const,
            isBaseline: r.isBaseline
          };
        }
        if (interval.status === 'incomplete') {
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

      return {
        pair,
        step: index + 1,
        baselineDays,
        average: stat?.average ?? null,
        median: stat?.median ?? null,
        projectData,
      };
    });
  }, [results, stats, baselineResult]);

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
                階段耗時差異分析說明
              </p>
              <p className="text-muted-foreground mt-1">
                此表計算各關鍵節點的「耗費天數」。
                <span className="text-red-500 font-medium">紅色數字</span>
                代表落後基準案件，
                <span className="text-green-500 font-medium">綠色數字</span>
                代表領先基準案件，是法庭上證明「非正常延宕」的有力證據。
              </p>
            </div>
          </div>
        </div>

        {/* Main analysis table */}
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[60px] text-center">步驟</TableHead>
                <TableHead className="min-w-[180px]">比較階段</TableHead>
                {results.map(r => (
                  <TableHead key={r.project.id} className="min-w-[100px] text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="truncate max-w-[120px]" title={r.project.project_name}>
                        {r.project.project_name.length > 10 
                          ? r.project.project_name.substring(0, 10) + '...'
                          : r.project.project_name}
                      </span>
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
                <TableRow key={stage.pair.id} className="hover:bg-muted/30">
                  <TableCell className="text-center font-medium text-muted-foreground">
                    {stage.step}
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
              
              {/* Total row */}
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell className="text-center">∑</TableCell>
                <TableCell>總流程耗時</TableCell>
                {results.map(r => {
                  const totalDays = COMPARISON_PAIRS.reduce((sum, pair) => {
                    const interval = r.intervals[pair.id];
                    if (interval?.status === 'complete' && interval.days !== null) {
                      return sum + interval.days;
                    }
                    return sum;
                  }, 0);
                  
                  const baselineTotal = baselineResult 
                    ? COMPARISON_PAIRS.reduce((sum, pair) => {
                        const interval = baselineResult.intervals[pair.id];
                        if (interval?.status === 'complete' && interval.days !== null) {
                          return sum + interval.days;
                        }
                        return sum;
                      }, 0)
                    : 0;
                  
                  const delta = r.isBaseline ? null : totalDays - baselineTotal;
                  
                  return (
                    <TableCell key={r.project.id} className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg font-bold">{totalDays} 天</span>
                        {delta !== null && delta !== 0 && (
                          <DeltaBadge delta={delta} size="sm" />
                        )}
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell className="text-center bg-muted/30">
                  {stats.length > 0 && (
                    <span className="text-muted-foreground">
                      {stats.reduce((sum, s) => sum + (s.average ?? 0), 0)} 天
                    </span>
                  )}
                </TableCell>
              </TableRow>
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
}

function StageCell({ days, delta, status, isBaseline, average }: StageCellProps) {
  if (status === 'na') {
    return <span className="text-muted-foreground text-sm">N/A</span>;
  }
  
  if (status === 'incomplete' || days === null) {
    return <span className="text-muted-foreground text-sm">未完成</span>;
  }

  // For baseline, compare with average
  const effectiveDelta = isBaseline 
    ? (average !== null ? days - average : null) 
    : delta;
  
  const isDelayed = effectiveDelta !== null && effectiveDelta > 0;
  const isAhead = effectiveDelta !== null && effectiveDelta < 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={cn(
        "font-medium text-lg",
        isDelayed && "text-red-500",
        isAhead && "text-green-500"
      )}>
        {days} 天
      </span>
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
