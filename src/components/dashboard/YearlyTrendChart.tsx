import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';
import { Plot } from '@/lib/plotly';

interface YearlyTrendChartProps {
  projects: Array<{
    intake_year?: number | null;
    fiscal_year?: number | null;
    capacity_kwp?: number | null;
    status?: string | null;
  }>;
  isLoading?: boolean;
  chartHeight?: number;
}

export function YearlyTrendChart({ 
  projects, 
  isLoading = false,
  chartHeight = 280,
}: YearlyTrendChartProps) {
  const chartData = useMemo(() => {
    const yearStats: Record<number, { 
      year: number;
      申請案件數: number;
      成案案件數: number;
      申請容量: number;
      成案率: number;
    }> = {};

    // 統計各年度資料
    projects.forEach(p => {
      const year = p.fiscal_year || p.intake_year;
      if (!year) return;

      if (!yearStats[year]) {
        yearStats[year] = {
          year,
          申請案件數: 0,
          成案案件數: 0,
          申請容量: 0,
          成案率: 0,
        };
      }

      yearStats[year].申請案件數 += 1;
      yearStats[year].申請容量 += p.capacity_kwp || 0;

      // 排除取消/暫停的案件為成案案件
      if (p.status && !['取消', '暫停'].includes(p.status)) {
        yearStats[year].成案案件數 += 1;
      }
    });

    // 計算成案率
    Object.values(yearStats).forEach(stat => {
      stat.成案率 = stat.申請案件數 > 0 
        ? Math.round((stat.成案案件數 / stat.申請案件數) * 100) 
        : 0;
      stat.申請容量 = Math.round(stat.申請容量);
    });

    const sorted = Object.values(yearStats).sort((a, b) => a.year - b.year);
    
    return {
      years: sorted.map(s => s.year.toString()),
      申請案件數: sorted.map(s => s.申請案件數),
      成案案件數: sorted.map(s => s.成案案件數),
      成案率: sorted.map(s => s.成案率),
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
            <TrendingUp className="w-4 h-4" />
            年度案件趨勢
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
          <TrendingUp className="w-4 h-4" />
          年度案件趨勢
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: chartHeight }}>
          <Plot
            data={[
              {
                type: 'bar',
                name: '申請案件數',
                x: chartData.years,
                y: chartData.申請案件數,
                marker: { color: 'hsl(221, 83%, 53%)' },
                yaxis: 'y',
                hovertemplate: '%{x}年<br>申請案件數: %{y} 件<extra></extra>',
              },
              {
                type: 'bar',
                name: '成案案件數',
                x: chartData.years,
                y: chartData.成案案件數,
                marker: { color: 'hsl(142, 71%, 45%)' },
                yaxis: 'y',
                hovertemplate: '%{x}年<br>成案案件數: %{y} 件<extra></extra>',
              },
              {
                type: 'scatter',
                mode: 'lines+markers',
                name: '成案率',
                x: chartData.years,
                y: chartData.成案率,
                marker: { color: 'hsl(0, 84%, 60%)', size: 8 },
                line: { color: 'hsl(0, 84%, 60%)', width: 2 },
                yaxis: 'y2',
                hovertemplate: '%{x}年<br>成案率: %{y}%<extra></extra>',
              },
            ]}
            layout={{
              autosize: true,
              margin: { t: 10, b: 40, l: 50, r: 50 },
              barmode: 'group',
              showlegend: true,
              legend: {
                orientation: 'h',
                y: -0.15,
                x: 0.5,
                xanchor: 'center',
                font: { size: 11 },
              },
              xaxis: {
                tickfont: { size: 11 },
              },
              yaxis: {
                title: { text: '案件數', font: { size: 11 } },
                tickfont: { size: 11 },
                side: 'left',
              },
              yaxis2: {
                title: { text: '成案率 (%)', font: { size: 11 } },
                tickfont: { size: 11 },
                overlaying: 'y',
                side: 'right',
                range: [0, 100],
                ticksuffix: '%',
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
