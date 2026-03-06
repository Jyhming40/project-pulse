import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Layers } from 'lucide-react';
import { Plot } from '@/lib/plotly';

interface CapacityDistributionChartProps {
  projects: Array<{
    intake_year?: number | null;
    fiscal_year?: number | null;
    capacity_kwp?: number | null;
  }>;
  isLoading?: boolean;
  chartHeight?: number;
}

// 容量級距定義
const CAPACITY_BRACKETS = [
  { key: '<100kWp', min: 0, max: 100 },
  { key: '100-200', min: 100, max: 200 },
  { key: '200-300', min: 200, max: 300 },
  { key: '300-400', min: 300, max: 400 },
  { key: '400-500', min: 400, max: 500 },
  { key: '500kWp+', min: 500, max: Infinity },
];

const BRACKET_COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 45%)',
  'hsl(47, 96%, 53%)',
  'hsl(262, 83%, 58%)',
  'hsl(0, 84%, 60%)',
  'hsl(210, 70%, 50%)',
];

export function CapacityDistributionChart({ 
  projects, 
  isLoading = false,
  chartHeight = 280,
}: CapacityDistributionChartProps) {
  const chartData = useMemo(() => {
    const yearBrackets: Record<number, Record<string, number>> = {};

    // 統計各年度各級距的案件數
    projects.forEach(p => {
      const year = p.fiscal_year || p.intake_year;
      const capacity = p.capacity_kwp || 0;
      if (!year) return;

      if (!yearBrackets[year]) {
        yearBrackets[year] = {};
        CAPACITY_BRACKETS.forEach(b => {
          yearBrackets[year][b.key] = 0;
        });
      }

      // 找出對應的級距
      const bracket = CAPACITY_BRACKETS.find(
        b => capacity >= b.min && capacity < b.max
      );
      if (bracket) {
        yearBrackets[year][bracket.key] += 1;
      }
    });

    const years = Object.keys(yearBrackets).map(Number).sort((a, b) => a - b);
    
    return {
      years: years.map(y => y.toString()),
      traces: CAPACITY_BRACKETS.map((bracket, index) => ({
        key: bracket.key,
        values: years.map(year => yearBrackets[year]?.[bracket.key] || 0),
        color: BRACKET_COLORS[index],
      })),
    };
  }, [projects]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton style={{ height: chartHeight }} className="w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.years.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Layers className="w-4 h-4" />
            容量級距分佈
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ height: chartHeight }} className="flex items-center justify-center text-muted-foreground">
            暫無數據
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Layers className="w-4 h-4" />
          容量級距分佈
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: chartHeight }}>
          <Plot
            data={chartData.traces.map(trace => ({
              type: 'bar' as const,
              name: trace.key,
              x: chartData.years,
              y: trace.values,
              marker: { color: trace.color },
              hovertemplate: `%{x}年<br>${trace.key}: %{y} 件<extra></extra>`,
            }))}
            layout={{
              autosize: true,
              margin: { t: 10, b: 40, l: 40, r: 10 },
              barmode: 'stack',
              showlegend: true,
              legend: {
                orientation: 'h',
                y: -0.15,
                x: 0.5,
                xanchor: 'center',
                font: { size: 10 },
              },
              xaxis: {
                tickfont: { size: 11 },
              },
              yaxis: {
                title: { text: '案件數', font: { size: 11 } },
                tickfont: { size: 11 },
              },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
            }}
            config={{
              displayModeBar: false,
              responsive: true,
            }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
