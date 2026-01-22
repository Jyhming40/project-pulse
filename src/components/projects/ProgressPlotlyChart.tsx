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

// Color palette for projects - more vibrant for better visibility
const PROJECT_COLORS = [
  "#ef4444", // red - baseline
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#f97316", // orange
  "#14b8a6", // teal
  "#a855f7", // purple
  "#84cc16", // lime
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

      const color = PROJECT_COLORS[index % PROJECT_COLORS.length];
      const isBaseline = result.isBaseline;

      traces.push({
        x,
        y,
        type: "scatter",
        mode: "lines+markers",
        name: isBaseline 
          ? `${result.project.project_name} (卡關)` 
          : result.project.project_name,
        line: {
          color,
          width: isBaseline ? 4 : 2,
          dash: isBaseline ? "solid" : "dot",
        },
        marker: {
          color,
          size: isBaseline ? 12 : 8,
          symbol: isBaseline ? "diamond" : "circle",
        },
        customdata: customData,
        hovertemplate: 
          "<b>%{customdata.projectName}</b><br>" +
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
        {results.map((result, index) => (
          <Badge 
            key={result.project.id}
            variant={result.isBaseline ? "destructive" : "outline"}
            className="flex items-center gap-2"
            style={!result.isBaseline ? { 
              borderColor: PROJECT_COLORS[index % PROJECT_COLORS.length],
              color: PROJECT_COLORS[index % PROJECT_COLORS.length],
            } : {}}
          >
            <span 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: PROJECT_COLORS[index % PROJECT_COLORS.length] }}
            />
            {result.project.project_name}
            {result.isBaseline && " (卡關)"}
          </Badge>
        ))}
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
