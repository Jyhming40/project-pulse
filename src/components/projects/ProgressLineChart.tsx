import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { TIMELINE_DOC_MAPPING, ComparisonResult } from "@/hooks/useProjectComparison";
import { format } from "date-fns";

interface ProgressLineChartProps {
  results: ComparisonResult[];
}

// Color palette for lines
const LINE_COLORS = [
  "#ef4444", // red - baseline (stuck case)
  "#22c55e", // green - comparison
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#10b981", // emerald
  "#f97316", // orange
  "#6366f1", // indigo
];

export function ProgressLineChart({ results }: ProgressLineChartProps) {
  // Transform data for recharts using document dates
  const { chartData, series, minDate, maxDate } = useMemo(() => {
    if (results.length === 0) {
      return { chartData: [], series: [], minDate: null, maxDate: null };
    }

    // Collect all milestone events with their dates and step numbers
    interface MilestoneEvent {
      projectIdx: number;
      date: Date;
      step: number;
      projectName: string;
      milestoneName: string;
    }

    const allEvents: MilestoneEvent[] = [];
    let globalMinDate: Date | null = null;
    let globalMaxDate: Date | null = null;

    results.forEach((r, projectIdx) => {
      TIMELINE_DOC_MAPPING.forEach((mapping) => {
        const docDate = r.documentDates[mapping.step]?.date;
        if (docDate) {
          const date = new Date(docDate);
          allEvents.push({
            projectIdx,
            date,
            step: mapping.step,
            projectName: r.project.project_name,
            milestoneName: mapping.short,
          });

          if (!globalMinDate || date < globalMinDate) globalMinDate = date;
          if (!globalMaxDate || date > globalMaxDate) globalMaxDate = date;
        }
      });
    });

    if (!globalMinDate || !globalMaxDate || allEvents.length === 0) {
      return { chartData: [], series: [], minDate: null, maxDate: null };
    }

    // Create data points for each project's progression
    const projectTimelines: { projectIdx: number; events: { date: Date; step: number }[] }[] = 
      results.map((_, idx) => ({ projectIdx: idx, events: [] }));

    allEvents.forEach(event => {
      projectTimelines[event.projectIdx].events.push({
        date: event.date,
        step: event.step,
      });
    });

    // Sort each project's events by date
    projectTimelines.forEach(pt => {
      pt.events.sort((a, b) => a.date.getTime() - b.date.getTime());
    });

    // Create unified timeline with all dates
    const allDates = new Set<number>();
    allEvents.forEach(e => {
      allDates.add(e.date.getTime());
    });

    const sortedDates = Array.from(allDates).sort((a, b) => a - b);

    // Build chart data - each row is a date point
    const data: any[] = [];

    sortedDates.forEach(dateMs => {
      const dateStr = format(new Date(dateMs), 'yyyy-MM-dd');
      const point: any = {
        dateStr,
        dateMs,
      };

      // For each project, get the highest step achieved by this date
      projectTimelines.forEach((pt, idx) => {
        let maxStep = 0;
        pt.events.forEach(e => {
          if (e.date.getTime() <= dateMs && e.step > maxStep) {
            maxStep = e.step;
          }
        });
        if (maxStep > 0) {
          point[`project_${idx}`] = maxStep;
        }
      });

      data.push(point);
    });

    // Forward fill: for dates where a project has no new milestone,
    // carry forward the last known step
    for (let i = 1; i < data.length; i++) {
      results.forEach((_, idx) => {
        const key = `project_${idx}`;
        if (data[i][key] === undefined && data[i - 1][key] !== undefined) {
          data[i][key] = data[i - 1][key];
        }
      });
    }

    // Create series
    const seriesData = results.map((r, idx) => ({
      dataKey: `project_${idx}`,
      name: r.project.project_name,
      color: LINE_COLORS[idx % LINE_COLORS.length],
      isBaseline: r.isBaseline,
    }));

    return {
      chartData: data,
      series: seriesData,
      minDate: globalMinDate,
      maxDate: globalMaxDate,
    };
  }, [results]);

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        請選擇案件以顯示進度曲線
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        所選案件沒有文件日期資料
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center">
        {series.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-sm">
              {s.name.length > 20 ? s.name.substring(0, 20) + '...' : s.name}
              {s.isBaseline && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  卡關
                </Badge>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[450px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 100, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="dateStr"
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={70}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, TIMELINE_DOC_MAPPING.length + 1]}
              ticks={TIMELINE_DOC_MAPPING.map(m => m.step)}
              tick={{ fontSize: 10 }}
              width={95}
              tickFormatter={(value) => {
                const mapping = TIMELINE_DOC_MAPPING.find(m => m.step === value);
                return mapping ? `${value}.${mapping.short}` : String(value);
              }}
            />
            {/* Horizontal reference lines for each milestone */}
            {TIMELINE_DOC_MAPPING.map((m) => (
              <ReferenceLine
                key={m.step}
                y={m.step}
                stroke="#e5e7eb"
                strokeDasharray="2 2"
              />
            ))}
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-popover border rounded-lg shadow-lg p-3 max-w-xs">
                    <p className="font-medium mb-2 text-sm">{label}</p>
                    {payload.map((p: any, idx: number) => {
                      const mapping = TIMELINE_DOC_MAPPING.find(m => m.step === p.value);
                      const seriesInfo = series.find(s => s.dataKey === p.dataKey);
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs mb-1"
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: p.stroke }}
                          />
                          <span className="truncate max-w-[120px]">
                            {seriesInfo?.name}:
                          </span>
                          <span className="font-medium whitespace-nowrap">
                            第{p.value}步 {mapping?.short}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
            {series.map((s) => (
              <Line
                key={s.dataKey}
                type="stepAfter"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color}
                strokeWidth={s.isBaseline ? 3 : 2}
                strokeDasharray={s.isBaseline ? undefined : "5 5"}
                dot={{ r: 4, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Y-axis milestone legend */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
        {TIMELINE_DOC_MAPPING.map((m) => (
          <div key={m.step} className="flex items-center gap-1 text-muted-foreground">
            <span className="font-medium">{m.step}.</span>
            <span>{m.short}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
