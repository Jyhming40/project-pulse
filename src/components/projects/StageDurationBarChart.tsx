import { useMemo } from "react";
import { Plot } from "@/lib/plotly";
import { ComparisonResult, COMPARISON_PAIRS } from "@/hooks/useProjectComparison";
import { ProjectDispute, calculateOverlapDays, DisputeDisplayStrategy } from "@/hooks/useProjectDisputesLocal";
import type { Data, Layout } from "plotly.js";

interface StageDurationBarChartProps {
  results: ComparisonResult[];
  disputes?: ProjectDispute[];
  displayStrategy?: DisputeDisplayStrategy;
  selectedIntervals?: string[];
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
  selectedIntervals 
}: StageDurationBarChartProps) {
  const { traces, layout } = useMemo(() => {
    if (results.length === 0) {
      return { traces: [], layout: {} };
    }

    // Only use step-by-step intervals, filtered by selectedIntervals if provided
    let stepIntervals = COMPARISON_PAIRS.filter((p) => p.id.startsWith("interval_") && !p.id.includes("total") && p.id.split("_").length === 3);
    if (selectedIntervals && selectedIntervals.length > 0) {
      stepIntervals = stepIntervals.filter(p => selectedIntervals.includes(p.id));
    }
    const intervalLabels = stepIntervals.map((p) => p.label);

    const traces: Data[] = [];

    results.forEach((result, index) => {
      const isBaseline = result.isBaseline;
      const color = PROJECT_COLORS[index % PROJECT_COLORS.length];
      
      const y: (number | null)[] = [];
      const customData: any[] = [];

      stepIntervals.forEach((pair) => {
        const interval = result.intervals[pair.id];
        const days = interval?.status === "complete" ? interval.days : null;
        y.push(days);

        // Calculate dispute overlaps for this interval
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

        customData.push({
          projectName: result.project.project_name,
          projectCode: result.project.project_code,
          interval: pair.label,
          days: days,
          fromDate: interval?.fromDate || "N/A",
          toDate: interval?.toDate || "N/A",
          overlaps: overlapInfo,
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
          color,
          line: {
            color: isBaseline ? "#991b1b" : "transparent",
            width: isBaseline ? 2 : 0,
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

    return { traces, layout };
  }, [results, disputes, displayStrategy]);

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
      </div>
    </div>
  );
}
