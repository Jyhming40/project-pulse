import { useMemo } from "react";
import { AlertOctagon, TrendingUp, Clock, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ComparisonResult, ComparisonStats, COMPARISON_PAIRS } from "@/hooks/useProjectComparison";

interface BottleneckAnalysisProps {
  results: ComparisonResult[];
  stats: ComparisonStats[];
  selectedIntervals?: string[];
}

interface BottleneckInfo {
  projectId: string;
  projectName: string;
  projectCode: string;
  isBaseline: boolean;
  worstStage: {
    pairId: string;
    label: string;
    days: number;
    delta: number | null;
    average: number | null;
    severity: 'critical' | 'warning' | 'normal';
  } | null;
  totalDays: number | null;
  avgDelta: number | null;
}

export function BottleneckAnalysis({ results, stats, selectedIntervals }: BottleneckAnalysisProps) {
  // Calculate bottleneck info for each project
  const bottleneckData = useMemo(() => {
    // Filter step pairs by selectedIntervals if provided
    let stepPairs = COMPARISON_PAIRS.slice(0, 10);
    if (selectedIntervals && selectedIntervals.length > 0) {
      stepPairs = stepPairs.filter(p => selectedIntervals.includes(p.id));
    }
    
    return results.map((result): BottleneckInfo => {
      let worstStage: BottleneckInfo['worstStage'] = null;
      let maxDelta = -Infinity;
      let totalDelta = 0;
      let deltaCount = 0;
      
      // Find the stage with worst delay compared to average
      for (const pair of stepPairs) {
        const interval = result.intervals[pair.id];
        if (interval?.status !== 'complete' || interval.days === null) continue;
        
        const stat = stats.find(s => s.pairId === pair.id);
        if (!stat?.average) continue;
        
        const delta = interval.days - stat.average;
        totalDelta += delta;
        deltaCount++;
        
        if (delta > maxDelta) {
          maxDelta = delta;
          
          // Determine severity: > 2x avg = critical, > 1.5x = warning
          let severity: 'critical' | 'warning' | 'normal' = 'normal';
          if (interval.days > stat.average * 2) {
            severity = 'critical';
          } else if (interval.days > stat.average * 1.5) {
            severity = 'warning';
          }
          
          worstStage = {
            pairId: pair.id,
            label: pair.label,
            days: interval.days,
            delta,
            average: stat.average,
            severity,
          };
        }
      }
      
      const totalInterval = result.intervals['interval_total'];
      
      return {
        projectId: result.project.id,
        projectName: result.project.project_name,
        projectCode: result.project.project_code,
        isBaseline: result.isBaseline,
        worstStage: maxDelta > 0 ? worstStage : null,
        totalDays: totalInterval?.status === 'complete' ? totalInterval.days : null,
        avgDelta: deltaCount > 0 ? Math.round(totalDelta / deltaCount) : null,
      };
    });
  }, [results, stats]);

  // Find overall worst bottleneck
  const overallWorst = useMemo(() => {
    return bottleneckData
      .filter(b => b.worstStage && b.worstStage.delta !== null && b.worstStage.delta > 0)
      .sort((a, b) => (b.worstStage?.delta || 0) - (a.worstStage?.delta || 0))[0];
  }, [bottleneckData]);

  if (results.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Overall worst bottleneck alert */}
        {overallWorst && overallWorst.worstStage && (
          <div className={cn(
            "p-4 rounded-lg border",
            overallWorst.worstStage.severity === 'critical' 
              ? "bg-destructive/10 border-destructive/30" 
              : "bg-warning/10 border-warning/30"
          )}>
            <div className="flex items-start gap-3">
              <AlertOctagon className={cn(
                "h-6 w-6 mt-0.5 flex-shrink-0",
                overallWorst.worstStage.severity === 'critical' 
                  ? "text-destructive" 
                  : "text-warning"
              )} />
              <div className="flex-1">
                <h4 className="font-semibold text-lg">
                  最嚴重瓶頸：{overallWorst.projectName}
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  在「<span className="font-medium">{overallWorst.worstStage.label}</span>」階段
                  花費 <span className="font-bold text-destructive">{overallWorst.worstStage.days} 天</span>，
                  比同期平均 {overallWorst.worstStage.average} 天多出
                  <span className="font-bold text-destructive"> +{overallWorst.worstStage.delta} 天</span>
                  {overallWorst.worstStage.severity === 'critical' && (
                    <Badge variant="destructive" className="ml-2">超過2倍平均</Badge>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Per-project bottleneck list */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bottleneckData.map((item) => (
            <div 
              key={item.projectId}
              className={cn(
                "p-4 rounded-lg border transition-colors",
                item.isBaseline 
                  ? "bg-destructive/5 border-destructive/20" 
                  : "bg-card hover:bg-muted/50"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h5 className="font-medium truncate max-w-[180px] cursor-help">
                      {item.projectName}
                    </h5>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.projectName}</p>
                    <p className="text-xs text-muted-foreground">{item.projectCode}</p>
                  </TooltipContent>
                </Tooltip>
                {item.isBaseline && (
                  <Badge variant="destructive" className="text-xs">卡關</Badge>
                )}
              </div>
              
              {item.worstStage ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">瓶頸階段：</span>
                    <span className={cn(
                      "font-medium",
                      item.worstStage.severity === 'critical' && "text-destructive",
                      item.worstStage.severity === 'warning' && "text-warning"
                    )}>
                      {item.worstStage.label}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">耗時：</span>
                    <span className="font-medium">{item.worstStage.days} 天</span>
                    {item.worstStage.delta !== null && item.worstStage.delta !== 0 && (
                      <Badge 
                        variant={item.worstStage.delta > 0 ? "destructive" : "default"}
                        className="text-xs"
                      >
                        {item.worstStage.delta > 0 ? '+' : ''}{item.worstStage.delta}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Progress bar showing deviation */}
                  {item.worstStage.average && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>平均 {item.worstStage.average}天</span>
                        <span>實際 {item.worstStage.days}天</span>
                      </div>
                      <Progress 
                        value={Math.min(100, (item.worstStage.days / (item.worstStage.average * 2)) * 100)} 
                        className={cn(
                          "h-2",
                          item.worstStage.severity === 'critical' && "[&>div]:bg-destructive",
                          item.worstStage.severity === 'warning' && "[&>div]:bg-warning"
                        )}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span>無明顯瓶頸（均在平均值內）</span>
                </div>
              )}
              
              {/* Total days */}
              {item.totalDays !== null && (
                <div className="mt-3 pt-3 border-t text-sm">
                  <span className="text-muted-foreground">總耗時：</span>
                  <span className="font-bold ml-1">{item.totalDays} 天</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
