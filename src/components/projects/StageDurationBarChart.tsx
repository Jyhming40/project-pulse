import { useMemo } from "react";
import { Plot } from "@/lib/plotly";
import { ComparisonResult, COMPARISON_PAIRS } from "@/hooks/useProjectComparison";
import { ProjectDispute, calculateOverlapDays, DisputeDisplayStrategy } from "@/hooks/useProjectDisputes";
import { StageDefinition } from "@/types/compareConfig";
import { useComparisonStages } from "@/hooks/useComparisonStages";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { Data, Layout, Annotations } from "plotly.js";

interface StageDurationBarChartProps {
  results: ComparisonResult[];
  disputes?: ProjectDispute[];
  displayStrategy?: DisputeDisplayStrategy;
  customStages?: StageDefinition[];
}

/**
 * Calculate interval data based on stage definition
 */
function calculateIntervalFromStage(
  result: ComparisonResult,
  stage: StageDefinition
): { days: number | null; fromDate: string | null; toDate: string | null; status: 'complete' | 'incomplete' | 'na' } {
  const fromDate = result.documentDates[stage.fromStep]?.date || null;
  const toDate = result.documentDates[stage.toStep]?.date || null;
  
  if (fromDate && toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const days = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    return { days, fromDate, toDate, status: 'complete' };
  }
  
  return { days: null, fromDate, toDate, status: 'incomplete' };
}

// Colors for projects
const PROJECT_COLORS = [
  "#dc2626", // baseline - red
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
];

export function StageDurationBarChart({ 
  results, 
  disputes = [],
  displayStrategy,
  customStages 
}: StageDurationBarChartProps) {
  // Get comparison stages configuration (unified data source)
  const { editableStages, getStageLabel } = useComparisonStages();
  // Calculate dispute overlap summary for the legend
  const disputeOverlapSummary = useMemo(() => {
    if (disputes.length === 0) return { hasOverlaps: false, totalOverlapDays: 0, affectedIntervals: 0 };
    
    let totalOverlapDays = 0;
    let affectedIntervals = new Set<string>();

    results.forEach((result) => {
      const projectDisputes = disputes.filter((d) => d.project_id === result.project.id);
      if (projectDisputes.length === 0) return;

      const stepIntervals = COMPARISON_PAIRS.filter((p) => 
        p.id.startsWith("interval_") && !p.id.includes("total") && p.id.split("_").length === 3
      );

      stepIntervals.forEach((stage) => {
        const interval = result.intervals[stage.id];
        if (interval?.status === 'complete' && interval.fromDate && interval.toDate) {
          projectDisputes.forEach((dispute) => {
            const overlap = calculateOverlapDays(
              interval.fromDate,
              interval.toDate,
              dispute.start_date,
              dispute.end_date
            );
            if (overlap > 0) {
              totalOverlapDays += overlap;
              affectedIntervals.add(`${result.project.id}-${stage.id}`);
            }
          });
        }
      });
    });

    return { 
      hasOverlaps: totalOverlapDays > 0, 
      totalOverlapDays, 
      affectedIntervals: affectedIntervals.size 
    };
  }, [results, disputes]);

  const { traces, layout, annotations } = useMemo(() => {
    if (results.length === 0) {
      return { traces: [], layout: {}, annotations: [] };
    }

    // Use editableStages for system stages (respects user edits)
    const systemStages: StageDefinition[] = editableStages.map((stage, idx) => ({
      id: stage.id,
      label: stage.isEdited ? getStageLabel(stage.id) : stage.label,
      fromStep: stage.fromStep,
      toStep: stage.toStep,
      isSystem: true,
      description: `${stage.fromStep} → ${stage.toStep}`,
      sortOrder: idx,
    }));
    
    // Combine system stages + custom user stages
    const stagesToUse: StageDefinition[] = customStages && customStages.length > 0
      ? [...systemStages, ...customStages]
      : systemStages;
    
    const intervalLabels = stagesToUse.map((s) => s.label);
    const traces: Data[] = [];
    const annotations: Partial<Annotations>[] = [];

    // Track overlaps for annotation markers
    const overlapMarkers: { x: string; y: number; text: string; color: string }[] = [];

    results.forEach((result, index) => {
      const isBaseline = result.isBaseline;
      const color = PROJECT_COLORS[index % PROJECT_COLORS.length];
      
      const y: (number | null)[] = [];
      const customData: any[] = [];
      const markerColors: string[] = [];
      const markerLineColors: string[] = [];
      const markerLineWidths: number[] = [];

      stagesToUse.forEach((stage, stageIndex) => {
        // Always recalculate based on current stage definition (supports user edits)
        // This ensures charts sync with the editable stages table
        const intervalData = calculateIntervalFromStage(result, stage);
        
        y.push(intervalData.days);

        // Calculate dispute overlaps for this interval
        let overlapInfo: { title: string; overlapDays: number; severity: string }[] = [];
        let totalOverlap = 0;
        let highestSeverity = "";
        
        if (disputes.length > 0 && intervalData.fromDate && intervalData.toDate) {
          const projectDisputes = disputes.filter((d) => d.project_id === result.project.id);
          
          projectDisputes.forEach((dispute) => {
            const overlapDays = calculateOverlapDays(
              intervalData.fromDate,
              intervalData.toDate,
              dispute.start_date,
              dispute.end_date
            );
            if (overlapDays > 0) {
              overlapInfo.push({
                title: dispute.title,
                overlapDays,
                severity: dispute.severity,
              });
              totalOverlap += overlapDays;
              if (!highestSeverity || 
                  (dispute.severity === "high") || 
                  (dispute.severity === "medium" && highestSeverity !== "high")) {
                highestSeverity = dispute.severity;
              }
            }
          });
        }

        // Apply visual style based on overlap
        const hasOverlap = totalOverlap > 0 && displayStrategy?.showOverlapDays !== false;
        if (hasOverlap) {
          // Lighten the bar color and add a warning border
          markerColors.push(color);
          const borderColor = highestSeverity === "high" ? "#ef4444" : 
                             highestSeverity === "medium" ? "#f59e0b" : "#22c55e";
          markerLineColors.push(borderColor);
          markerLineWidths.push(3);
          
          // Add annotation marker for overlapping bars
          if (intervalData.days !== null && intervalData.days > 0) {
            overlapMarkers.push({
              x: stage.label,
              y: intervalData.days,
              text: `⚠️`,
              color: borderColor,
            });
          }
        } else {
          markerColors.push(color);
          markerLineColors.push(isBaseline ? "#991b1b" : "transparent");
          markerLineWidths.push(isBaseline ? 2 : 0);
        }

        customData.push({
          projectName: result.project.project_name,
          projectCode: result.project.project_code,
          interval: stage.label,
          days: intervalData.days,
          fromDate: intervalData.fromDate || "N/A",
          toDate: intervalData.toDate || "N/A",
          overlaps: overlapInfo,
          totalOverlap,
          isBaseline,
        });
      });

      // Build hover template
      let hoverTemplate = isBaseline
        ? "<b>🚨 %{customdata.projectName} (基準)</b><br>"
        : "<b>%{customdata.projectName}</b><br>";
      
      hoverTemplate += "區間：%{customdata.interval}<br>";
      hoverTemplate += "天數：%{y} 天<br>";
      hoverTemplate += "起：%{customdata.fromDate}<br>";
      hoverTemplate += "迄：%{customdata.toDate}";

      // Add dispute info to hover if enabled
      if (displayStrategy?.showOverlapDays) {
        hoverTemplate += "<extra>%{customdata.overlapText}</extra>";
      } else {
        hoverTemplate += "<extra></extra>";
      }

      // Add overlap text to customdata
      customData.forEach((cd) => {
        if (cd.overlaps.length > 0) {
          cd.overlapText = cd.overlaps
            .map((o: any) => `⚠️ ${o.title}: ${o.overlapDays}天重疊`)
            .join("\n");
        } else {
          cd.overlapText = "";
        }
      });

      traces.push({
        x: intervalLabels,
        y,
        type: "bar",
        name: isBaseline
          ? `🚨 ${result.project.project_name} (基準)`
          : result.project.project_name,
        marker: {
          color: markerColors,
          line: {
            color: markerLineColors,
            width: markerLineWidths,
          },
        },
        customdata: customData,
        hovertemplate: hoverTemplate,
      } as Data);
    });

    const layout: Partial<Layout> = {
      autosize: true,
      height: 500,
      margin: { l: 60, r: 40, t: 40, b: 120 },
      barmode: "group",
      xaxis: {
        title: { text: "階段區間", font: { size: 14 } },
        tickangle: -45,
        tickfont: { size: 11 },
      },
      yaxis: {
        title: { text: "天數", font: { size: 14 } },
        gridcolor: "rgba(0,0,0,0.1)",
      },
      legend: {
        orientation: "h",
        yanchor: "bottom",
        y: 1.02,
        xanchor: "center",
        x: 0.5,
        font: { size: 11 },
      },
      hovermode: "closest",
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: {
        family: "inherit",
      },
    };

    return { traces, layout, annotations };
  }, [results, disputes, displayStrategy, customStages, editableStages, getStageLabel]);

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-muted-foreground">
        請選擇案件以顯示耗時長條圖
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">所選案件尚無里程碑日期資料</p>
          <p className="text-sm mt-2">請確認案件已有文件日期記錄</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Dispute overlap summary */}
      {disputeOverlapSummary.hasOverlaps && displayStrategy?.showOverlapDays !== false && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            共有 <strong>{disputeOverlapSummary.affectedIntervals}</strong> 個區間與爭議期間重疊，
            累計 <strong>{disputeOverlapSummary.totalOverlapDays}</strong> 天
          </span>
          <Badge variant="outline" className="ml-auto text-xs border-amber-300 text-amber-600">
            有重疊區間以粗邊框標示
          </Badge>
        </div>
      )}

      <div className="border rounded-lg bg-card p-2">
        <Plot
          data={traces}
          layout={layout}
          config={{
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ["lasso2d", "select2d"],
            responsive: true,
            locale: "zh-TW",
            toImageButtonOptions: {
              format: "png",
              filename: "階段耗時長條圖",
              height: 600,
              width: 1200,
              scale: 2,
            },
          }}
          style={{ width: "100%", height: "500px" }}
          useResizeHandler
        />
      </div>
      <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
        <span>📊 群組長條比較各案耗時</span>
        <span>🔍 滑鼠滾輪縮放</span>
        <span>📷 右上角可下載圖片</span>
        {disputes.length > 0 && <span>⚠️ 有爭議重疊的柱子會顯示彩色邊框</span>}
      </div>
    </div>
  );
}
