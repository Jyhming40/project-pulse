import { useMemo } from "react";
import Plot from "react-plotly.js";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ComparisonResult, TIMELINE_DOC_MAPPING } from "@/hooks/useProjectComparison";
import type { Data, Layout } from "plotly.js";

interface ProgressPlotlyChartProps {
  results: ComparisonResult[];
}

// Baseline (stuck project) - very prominent red
const BASELINE_COLOR = "#dc2626"; // bright red
const BASELINE_COLOR_LIGHT = "rgba(220, 38, 38, 0.15)"; // for fill

// Comparison projects - softer, muted colors that don't compete with baseline
const COMPARISON_COLORS = [
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

export function ProgressPlotlyChart({ results }: ProgressPlotlyChartProps) {
  const { traces, layout } = useMemo(() => {
    if (results.length === 0) {
      return { traces: [], layout: {} };
    }

    const traces: Data[] = [];
    const milestoneLabels = TIMELINE_DOC_MAPPING.map(m => m.short);

    results.forEach((result, index) => {
      const events: { date: Date; step: number }[] = [];

      // Collect milestone events
      TIMELINE_DOC_MAPPING.forEach(mapping => {
        const docDate = result.documentDates?.[mapping.step];
        if (docDate?.date) {
          events.push({
            date: new Date(docDate.date),
            step: mapping.step,
          });
        }
      });

      // Sort by date
      events.sort((a, b) => a.date.getTime() - b.date.getTime());

      if (events.length === 0) return;

      // Build trace data
      const x: string[] = [];
      const y: number[] = [];
      const customData: any[] = [];
      let currentHighestStep = 0;

      events.forEach(event => {
        currentHighestStep = Math.max(currentHighestStep, event.step);
        x.push(format(event.date, "yyyy-MM-dd"));
        y.push(currentHighestStep);
        
        const milestone = TIMELINE_DOC_MAPPING.find(m => m.step === event.step);
        customData.push({
          projectName: result.project.project_name,
          projectCode: result.project.project_code,
          milestone: milestone?.label || `Step ${event.step}`,
          date: format(event.date, "yyyy年M月d日", { locale: zhTW }),
          step: event.step,
        });
      });

      const isBaseline = result.isBaseline;
      // Baseline uses index 0 of its own color, comparisons use their own palette
      const comparisonIndex = isBaseline ? 0 : index - 1;
      const color = isBaseline 
        ? BASELINE_COLOR 
        : COMPARISON_COLORS[comparisonIndex % COMPARISON_COLORS.length];

      // For baseline, add a filled area trace first for emphasis
      if (isBaseline && x.length > 0) {
        traces.push({
          x,
          y,
          type: "scatter",
          mode: "none",
          name: `${result.project.project_name} (卡關) - 區域`,
          fill: "tozeroy",
          fillcolor: BASELINE_COLOR_LIGHT,
          showlegend: false,
          hoverinfo: "skip",
        } as Data);
      }

      traces.push({
        x,
        y,
        type: "scatter",
        mode: "lines+markers",
        name: isBaseline 
          ? `🚨 ${result.project.project_name} (卡關)` 
          : result.project.project_name,
        line: {
          color,
          width: isBaseline ? 5 : 2,
          dash: isBaseline ? "solid" : "dash",
          shape: "spline",
        },
        marker: {
          color: isBaseline ? "#ffffff" : color,
          size: isBaseline ? 14 : 8,
          symbol: isBaseline ? "diamond" : "circle",
          line: isBaseline ? {
            color: BASELINE_COLOR,
            width: 3,
          } : undefined,
        },
        customdata: customData,
        hovertemplate: isBaseline
          ? "<b>🚨 %{customdata.projectName} (卡關案件)</b><br>" +
            "里程碑：%{customdata.milestone}<br>" +
            "日期：%{customdata.date}<br>" +
            "進度：Step %{customdata.step}<extra></extra>"
          : "<b>%{customdata.projectName}</b><br>" +
            "里程碑：%{customdata.milestone}<br>" +
            "日期：%{customdata.date}<br>" +
            "進度：Step %{customdata.step}<extra></extra>",
      } as Data);
    });

    const layout: Partial<Layout> = {
      autosize: true,
      height: 500,
      margin: { l: 120, r: 40, t: 40, b: 80 },
      xaxis: {
        title: { text: "日期", font: { size: 14 } },
        type: "date",
        tickformat: "%Y/%m",
        gridcolor: "rgba(0,0,0,0.1)",
        showgrid: true,
      },
      yaxis: {
        title: { text: "里程碑進度", font: { size: 14 } },
        tickmode: "array",
        tickvals: TIMELINE_DOC_MAPPING.map(m => m.step),
        ticktext: milestoneLabels,
        range: [0.5, 11.5],
        gridcolor: "rgba(0,0,0,0.1)",
        showgrid: true,
        zeroline: false,
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
      dragmode: "zoom",
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: {
        family: "inherit",
      },
    };

    return { traces, layout, milestoneLabels };
  }, [results]);

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-muted-foreground">
        請選擇案件以顯示進度圖
      </div>
    );
  }

  const hasData = traces.length > 0;

  if (!hasData) {
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
    <div className="space-y-4">
      {/* Legend with project badges */}
      <div className="flex flex-wrap gap-2">
        {results.map((result, index) => {
          const isBaseline = result.isBaseline;
          const comparisonIndex = isBaseline ? 0 : index - 1;
          const color = isBaseline 
            ? BASELINE_COLOR 
            : COMPARISON_COLORS[comparisonIndex % COMPARISON_COLORS.length];
          
          return (
            <Badge 
              key={result.project.id}
              variant={isBaseline ? "destructive" : "outline"}
              className={`flex items-center gap-2 ${isBaseline ? 'text-base px-3 py-1 animate-pulse' : ''}`}
              style={!isBaseline ? { 
                borderColor: color,
                color: color,
              } : {}}
            >
              <span 
                className={`rounded-full ${isBaseline ? 'w-3 h-3' : 'w-2 h-2'}`}
                style={{ backgroundColor: color }}
              />
              {isBaseline && "🚨 "}
              {result.project.project_name}
              {isBaseline && " (卡關)"}
            </Badge>
          );
        })}
      </div>

      {/* Plotly Chart */}
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
              filename: "案件進度比較圖",
              height: 600,
              width: 1200,
              scale: 2,
            },
          }}
          style={{ width: "100%", height: "500px" }}
          useResizeHandler
        />
      </div>

      {/* Chart tips */}
      <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
        <span>🔍 滑鼠滾輪縮放</span>
        <span>✋ 拖曳平移</span>
        <span>🔄 雙擊重置</span>
        <span>📷 右上角可下載圖片</span>
      </div>
    </div>
  );
}
