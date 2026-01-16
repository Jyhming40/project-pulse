import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { TIMELINE_MILESTONES, ComparisonResult } from "@/hooks/useProjectComparison";
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
  // Transform data for recharts - Y axis is milestone step (1-10), X axis is date
  const chartData = useMemo(() => {
    // Get all unique dates across all projects
    const allDates = new Set<string>();
    const projectMilestoneData: Record<string, { step: number; date: Date }[]> = {};

    results.forEach((r) => {
      projectMilestoneData[r.project.id] = [];

      TIMELINE_MILESTONES.forEach((milestone, stepIndex) => {
        const completedAt = r.milestones[milestone.code];
        if (completedAt) {
          const dateStr = completedAt.split('T')[0];
          allDates.add(dateStr);
          projectMilestoneData[r.project.id].push({
            step: stepIndex + 1,
            date: new Date(completedAt),
          });
        }
      });

      // Sort by date
      projectMilestoneData[r.project.id].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );
    });

    // Create timeline data points
    const sortedDates = Array.from(allDates).sort();
    
    if (sortedDates.length === 0) return [];

    // Generate data points for each project's progress over time
    const data: any[] = [];

    // For each project, create a series of points showing progress
    results.forEach((r, rIdx) => {
      const projectData = projectMilestoneData[r.project.id];
      
      projectData.forEach((point, idx) => {
        const existingPoint = data.find(
          d => d.dateStr === format(point.date, 'yyyy-MM-dd')
        );
        
        const key = `project_${rIdx}`;
        
        if (existingPoint) {
          existingPoint[key] = point.step;
        } else {
          const newPoint: any = {
            dateStr: format(point.date, 'yyyy-MM-dd'),
            dateMs: point.date.getTime(),
            [key]: point.step,
          };
          data.push(newPoint);
        }
      });
    });

    // Sort by date
    data.sort((a, b) => a.dateMs - b.dateMs);

    // Forward fill values for continuous lines
    results.forEach((_, rIdx) => {
      const key = `project_${rIdx}`;
      let lastValue: number | undefined;
      
      data.forEach((d) => {
        if (d[key] !== undefined) {
          lastValue = d[key];
        } else if (lastValue !== undefined) {
          d[key] = lastValue;
        }
      });
    });

    return data;
  }, [results]);

  // Create series for each project
  const series = useMemo(() => {
    return results.map((r, idx) => ({
      dataKey: `project_${idx}`,
      name: r.project.project_name,
      color: LINE_COLORS[idx % LINE_COLORS.length],
      isBaseline: r.isBaseline,
    }));
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
        所選案件沒有里程碑資料
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
              {s.name}
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
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="dateStr"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 10]}
              ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
              tick={{ fontSize: 12 }}
              label={{
                value: "里程碑階段 (1→10)",
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickFormatter={(value) => {
                const milestone = TIMELINE_MILESTONES[value - 1];
                return milestone ? `${value}.${milestone.label}` : String(value);
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-popover border rounded-lg shadow-lg p-3">
                    <p className="font-medium mb-2">{label}</p>
                    {payload.map((p: any, idx: number) => {
                      const milestone = TIMELINE_MILESTONES[p.value - 1];
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm"
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: p.stroke }}
                          />
                          <span>{p.name}:</span>
                          <span className="font-medium">
                            第{p.value}步 {milestone?.label}
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
                dot={{ r: 4, fill: s.color }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Y-axis milestone legend */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        {TIMELINE_MILESTONES.map((m, idx) => (
          <div key={m.code} className="flex items-center gap-1 text-muted-foreground">
            <span className="font-medium">{idx + 1}.</span>
            <span>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
