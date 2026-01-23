import { useMemo } from "react";
import { Plot } from "@/lib/plotly";
import { ComparisonResult, COMPARISON_PAIRS } from "@/hooks/useProjectComparison";
import { ProjectDispute, calculateOverlapDays, DisputeDisplayStrategy } from "@/hooks/useProjectDisputesLocal";
import type { Data, Layout } from "plotly.js";

interface StageDurationHeatmapProps {
  results: ComparisonResult[];
  disputes?: ProjectDispute[];
  displayStrategy?: DisputeDisplayStrategy;
  selectedIntervals?: string[];
}

export function StageDurationHeatmap({ 
  results, 
  disputes = [],
  displayStrategy,
  selectedIntervals 
}: StageDurationHeatmapProps) {
  const { traces, layout } = useMemo(() => {
    if (results.length === 0) {
      return { traces: [], layout: {} };
    }

    // Only use step-by-step intervals, filtered by selectedIntervals if provided
    let stepIntervals = COMPARISON_PAIRS.filter((p) => 
      p.id.startsWith("interval_") && !p.id.includes("total") && p.id.split("_").length === 3
    );
    if (selectedIntervals && selectedIntervals.length > 0) {
      stepIntervals = stepIntervals.filter(p => selectedIntervals.includes(p.id));
    }
    const intervalLabels = stepIntervals.map((p) => p.label);

    // Project names for y-axis
    const projectLabels = results.map((r) => 
      r.isBaseline ? `🚨 ${r.project.project_name}` : r.project.project_name
    );

    // Build z matrix (projects × intervals)
    const z: (number | null)[][] = [];
    const customData: any[][] = [];

    results.forEach((result) => {
      const row: (number | null)[] = [];
      const customRow: any[] = [];

      stepIntervals.forEach((pair) => {
        const interval = result.intervals[pair.id];
        const days = interval?.status === "complete" ? interval.days : null;
        row.push(days);

        // Calculate dispute overlaps
        let overlapInfo: { title: string; overlapDays: number; severity: string }[] = [];
        if (disputes.length > 0 && interval?.fromDate && interval?.toDate) {
          const projectDisputes = disputes.filter((d) => d.project_id === result.project.id);
          
          projectDisputes.forEach((dispute) => {
            const overlapDays = calculateOverlapDays(
              interval.fromDate,
              interval.toDate,
              dispute.start_date,
              dispute.end_date
            );
            if (overlapDays > 0) {
              overlapInfo.push({
                title: dispute.title,
                overlapDays,
                severity: dispute.severity,
              });
            }
          });
        }

        customRow.push({
          projectName: result.project.project_name,
          projectCode: result.project.project_code,
          interval: pair.label,
          days: days,
          fromDate: interval?.fromDate || "N/A",
          toDate: interval?.toDate || "N/A",
          overlaps: overlapInfo,
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

    return { traces, layout };
  }, [results, disputes, displayStrategy]);

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-muted-foreground">
        請選擇案件以顯示熱力圖
      </div>
    );
  }

  return (
    <div className="space-y-2">
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
      </div>
    </div>
  );
}
