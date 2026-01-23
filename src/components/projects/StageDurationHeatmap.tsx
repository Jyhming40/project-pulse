import { useMemo } from "react";
import { Plot } from "@/lib/plotly";
import { ComparisonResult, COMPARISON_PAIRS } from "@/hooks/useProjectComparison";
import { ProjectDispute, calculateOverlapDays, DisputeDisplayStrategy } from "@/hooks/useProjectDisputesLocal";
import { StageDefinition } from "@/types/compareConfig";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { Data, Layout, Annotations } from "plotly.js";

interface StageDurationHeatmapProps {
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

export function StageDurationHeatmap({ 
  results, 
  disputes = [],
  displayStrategy,
  customStages 
}: StageDurationHeatmapProps) {
  // Calculate dispute overlap summary
  const disputeOverlapSummary = useMemo(() => {
    if (disputes.length === 0) return { hasOverlaps: false, cells: 0 };
    
    let affectedCells = 0;

    results.forEach((result) => {
      const projectDisputes = disputes.filter((d) => d.project_id === result.project.id);
      if (projectDisputes.length === 0) return;

      const stepIntervals = COMPARISON_PAIRS.filter((p) => 
        p.id.startsWith("interval_") && !p.id.includes("total") && p.id.split("_").length === 3
      );

      stepIntervals.forEach((stage) => {
        const interval = result.intervals[stage.id];
        if (interval?.status === 'complete' && interval.fromDate && interval.toDate) {
          const hasOverlap = projectDisputes.some((dispute) => 
            calculateOverlapDays(interval.fromDate, interval.toDate, dispute.start_date, dispute.end_date) > 0
          );
          if (hasOverlap) affectedCells++;
        }
      });
    });

    return { hasOverlaps: affectedCells > 0, cells: affectedCells };
  }, [results, disputes]);

  const { traces, layout, annotations } = useMemo(() => {
    if (results.length === 0) {
      return { traces: [], layout: {}, annotations: [] };
    }

    // Build stages list: system stages + custom stages (if any)
    const stepIntervals = COMPARISON_PAIRS.filter((p) => 
      p.id.startsWith("interval_") && !p.id.includes("total") && p.id.split("_").length === 3
    );
    const systemStages: StageDefinition[] = stepIntervals.map((p, idx) => ({
      id: p.id,
      label: p.label,
      fromStep: p.fromStep,
      toStep: p.toStep,
      isSystem: true,
      description: p.description,
      sortOrder: idx,
    }));
    
    // Combine system stages + custom user stages
    const stagesToUse: StageDefinition[] = customStages && customStages.length > 0
      ? [...systemStages, ...customStages]
      : systemStages;

    const intervalLabels = stagesToUse.map((s) => s.label);

    // Project names for y-axis
    const projectLabels = results.map((r) => 
      r.isBaseline ? `🚨 ${r.project.project_name}` : r.project.project_name
    );

    // Build z matrix (projects × intervals)
    const z: (number | null)[][] = [];
    const customData: any[][] = [];
    const annotations: Partial<Annotations>[] = [];

    results.forEach((result, projectIndex) => {
      const row: (number | null)[] = [];
      const customRow: any[] = [];

      stagesToUse.forEach((stage, stageIndex) => {
        // Try to use existing interval data, or calculate from stage
        const existingInterval = result.intervals[stage.id];
        let intervalData: { days: number | null; fromDate: string | null; toDate: string | null; status: 'complete' | 'incomplete' | 'na' };
        
        if (existingInterval) {
          intervalData = {
            days: existingInterval.status === 'complete' ? existingInterval.days : null,
            fromDate: existingInterval.fromDate,
            toDate: existingInterval.toDate,
            status: existingInterval.status,
          };
        } else {
          intervalData = calculateIntervalFromStage(result, stage);
        }

        row.push(intervalData.days);

        // Calculate dispute overlaps
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

        // Add annotation marker for cells with dispute overlap
        if (totalOverlap > 0 && displayStrategy?.showOverlapDays !== false) {
          const icon = highestSeverity === "high" ? "🔴" : highestSeverity === "medium" ? "🟡" : "🟢";
          annotations.push({
            x: stageIndex,
            y: projectIndex,
            text: `${icon}${totalOverlap}`,
            showarrow: false,
            font: { 
              size: 10, 
              color: "#fff",
            },
            bgcolor: highestSeverity === "high" ? "rgba(239,68,68,0.9)" : 
                     highestSeverity === "medium" ? "rgba(245,158,11,0.9)" : "rgba(34,197,94,0.9)",
            borderpad: 2,
            borderwidth: 1,
            bordercolor: "rgba(255,255,255,0.5)",
          });
        }

        customRow.push({
          projectName: result.project.project_name,
          projectCode: result.project.project_code,
          interval: stage.label,
          days: intervalData.days,
          fromDate: intervalData.fromDate || "N/A",
          toDate: intervalData.toDate || "N/A",
          overlaps: overlapInfo,
          totalOverlap,
          isBaseline: result.isBaseline,
        });
      });

      z.push(row);
      customData.push(customRow);
    });

    // Build hover text matrix
    const hoverText: string[][] = customData.map((row) =>
      row.map((cd) => {
        let text = `<b>${cd.projectName}</b><br>`;
        text += `區間：${cd.interval}<br>`;
        text += cd.days !== null ? `天數：${cd.days} 天<br>` : "天數：N/A<br>";
        text += `起：${cd.fromDate}<br>`;
        text += `迄：${cd.toDate}`;

        if (displayStrategy?.showOverlapDays && cd.overlaps.length > 0) {
          text += "<br><br>⚠️ <b>爭議重疊：</b><br>";
          cd.overlaps.forEach((o: any) => {
            const severityIcon = o.severity === "high" ? "🔴" : o.severity === "medium" ? "🟡" : "🟢";
            text += `${severityIcon} ${o.title}: ${o.overlapDays}天<br>`;
          });
          text += `<br><b>總重疊：${cd.totalOverlap} 天</b>`;
        }

        return text;
      })
    );

    const traces: Data[] = [
      {
        x: intervalLabels,
        y: projectLabels,
        z,
        type: "heatmap",
        colorscale: [
          [0, "#f0fdf4"],      // light green for low
          [0.25, "#86efac"],   // medium green
          [0.5, "#fef08a"],    // yellow for medium
          [0.75, "#fb923c"],   // orange for high
          [1, "#ef4444"],      // red for very high
        ],
        colorbar: {
          title: { text: "天數", side: "right" },
          thickness: 15,
          len: 0.8,
        },
        hoverinfo: "text",
        hovertext: hoverText as unknown as string[],
        hoverongaps: false,
        showscale: true,
        zmin: 0,
      } as unknown as Data,
    ];

    const layout: Partial<Layout> = {
      autosize: true,
      height: Math.max(400, results.length * 50 + 150),
      margin: { l: 200, r: 80, t: 40, b: 120 },
      annotations,
      xaxis: {
        title: { text: "階段區間", font: { size: 14 } },
        tickangle: -45,
        tickfont: { size: 11 },
        side: "bottom",
      },
      yaxis: {
        title: { text: "案場", font: { size: 14 } },
        tickfont: { size: 11 },
        autorange: "reversed", // Baseline at top
      },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: {
        family: "inherit",
      },
    };

    return { traces, layout, annotations };
  }, [results, disputes, displayStrategy, customStages]);

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-muted-foreground">
        請選擇案件以顯示熱力圖
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
            共有 <strong>{disputeOverlapSummary.cells}</strong> 個格子與爭議期間重疊
          </span>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>高</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>中</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>低</span>
          </div>
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
              filename: "階段耗時熱力圖",
              height: 600,
              width: 1200,
              scale: 2,
            },
          }}
          style={{ width: "100%", height: `${Math.max(400, results.length * 50 + 150)}px` }}
          useResizeHandler
        />
      </div>
      <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
        <span>🌡️ 顏色越深耗時越長</span>
        <span>🔍 Hover 查看詳情</span>
        <span>📷 右上角可下載圖片</span>
        {disputes.length > 0 && <span>🔴🟡🟢 標記表示爭議重疊天數</span>}
      </div>
    </div>
  );
}
