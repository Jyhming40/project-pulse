import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Percent, Clock, Hash, Flame, Info } from "lucide-react";
import { ComparisonResult, COMPARISON_PAIRS } from "@/hooks/useProjectComparison";
import { 
  ProjectDispute, 
  DisputeDisplayStrategy, 
  calculateDisputeKpi,
  DisputeKpiStats 
} from "@/hooks/useProjectDisputesLocal";

interface DisputeKpiCardsProps {
  results: ComparisonResult[];
  disputes: ProjectDispute[];
  strategy: DisputeDisplayStrategy;
}

export function DisputeKpiCards({ results, disputes, strategy }: DisputeKpiCardsProps) {
  const kpiStats = useMemo(() => {
    if (results.length === 0 || disputes.length === 0) return [];

    // Only use step-by-step intervals for KPI calculation
    const stepIntervalIds = COMPARISON_PAIRS
      .filter((p) => p.id.startsWith("interval_") && !p.id.includes("total") && p.id.split("_").length === 3)
      .map((p) => p.id);

    return results.map((result) => {
      const intervals = stepIntervalIds.map((pairId) => {
        const interval = result.intervals[pairId];
        return {
          fromDate: interval?.fromDate || null,
          toDate: interval?.toDate || null,
          days: interval?.status === "complete" ? interval.days : null,
        };
      });

      return calculateDisputeKpi(
        result.project.id,
        result.project.project_name,
        intervals,
        disputes,
        strategy
      );
    }).filter((stat) => stat.totalOverlapDays > 0 || disputes.some((d) => d.project_id === stat.projectId));
  }, [results, disputes, strategy]);

  if (kpiStats.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        爭議影響 KPI
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>根據「爭議顯示策略」設定計算各案場的爭議重疊統計。</p>
              <p className="mt-1 text-muted-foreground">目前策略：{
                strategy.filter === "all" ? "顯示全部" :
                strategy.filter === "high" ? "只顯示高嚴重度" :
                "只顯示與區間交集"
              }</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {kpiStats.map((stat) => (
          <KpiCard key={stat.projectId} stat={stat} isBaseline={results.find(r => r.project.id === stat.projectId)?.isBaseline} />
        ))}
      </div>
    </div>
  );
}

function KpiCard({ stat, isBaseline }: { stat: DisputeKpiStats; isBaseline?: boolean }) {
  const hasData = stat.totalIntervalDays > 0;

  return (
    <Card className={isBaseline ? "border-destructive/50 bg-destructive/5" : ""}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {isBaseline && <Badge variant="destructive" className="text-xs shrink-0">基準</Badge>}
            <span className="text-sm font-medium truncate">{stat.projectName}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Overlap Percentage */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Percent className="h-3 w-3" />
              重疊占比
            </div>
            <div className="text-lg font-bold">
              {hasData ? `${stat.overlapPercentage.toFixed(1)}%` : "—"}
            </div>
          </div>

          {/* Overlap Days */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              重疊天數
            </div>
            <div className="text-lg font-bold">
              {hasData ? `${stat.totalOverlapDays} 天` : "—"}
            </div>
          </div>

          {/* Affected Intervals */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="h-3 w-3" />
              受影響區間
            </div>
            <div className="text-lg font-bold">
              {hasData ? stat.affectedIntervalCount : "—"}
            </div>
          </div>

          {/* High Severity Days */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Flame className="h-3 w-3 text-red-500" />
              高嚴重度
            </div>
            <div className="text-lg font-bold text-red-600">
              {hasData ? `${stat.highSeverityOverlapDays} 天` : "—"}
            </div>
          </div>
        </div>

        {/* Interval summary */}
        <div className="mt-3 pt-2 border-t text-xs text-muted-foreground">
          總區間天數：{hasData ? `${stat.totalIntervalDays} 天` : "N/A"}
        </div>
      </CardContent>
    </Card>
  );
}
