import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2 } from 'lucide-react';
import { Plot } from '@/lib/plotly';

interface InstallationTypeChartProps {
  projects: Array<{
    installation_type?: string | null;
  }>;
  isLoading?: boolean;
}

// 案場類型對應顏色
const TYPE_COLORS: Record<string, string> = {
  '住宅': 'hsl(221, 83%, 53%)',
  '廠辦': 'hsl(142, 71%, 45%)',
  '農業設施': 'hsl(47, 96%, 53%)',
  '畜牧舍': 'hsl(262, 83%, 58%)',
  '農舍': 'hsl(0, 84%, 60%)',
  '農棚': 'hsl(180, 50%, 45%)',
  '其他設施': 'hsl(210, 70%, 50%)',
  '地面型': 'hsl(35, 90%, 50%)',
  '特登工廠': 'hsl(150, 60%, 45%)',
  '特目用建物': 'hsl(310, 60%, 50%)',
  '新建物（農業）': 'hsl(80, 60%, 45%)',
  '新建物（其他）': 'hsl(20, 70%, 55%)',
  '未設定': 'hsl(220, 10%, 70%)',
};

const DEFAULT_COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 45%)',
  'hsl(47, 96%, 53%)',
  'hsl(262, 83%, 58%)',
  'hsl(0, 84%, 60%)',
  'hsl(210, 70%, 50%)',
  'hsl(150, 60%, 45%)',
  'hsl(35, 90%, 50%)',
];

export function InstallationTypeChart({ 
  projects, 
  isLoading = false 
}: InstallationTypeChartProps) {
  const chartData = useMemo(() => {
    const distribution: Record<string, number> = {};
    
    projects.forEach(p => {
      const type = p.installation_type || '未設定';
      distribution[type] = (distribution[type] || 0) + 1;
    });

    const sorted = Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      labels: sorted.map(d => d.name),
      values: sorted.map(d => d.value),
      colors: sorted.map((d, i) => TYPE_COLORS[d.name] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]),
    };
  }, [projects]);

  const total = useMemo(() => 
    chartData.values.reduce((sum, v) => sum + v, 0), 
    [chartData]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center">
            <Skeleton className="h-40 w-40 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.labels.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            案場類型分佈
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
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
          <Building2 className="w-4 h-4" />
          案場類型分佈
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <Plot
            data={[
              {
                type: 'pie',
                labels: chartData.labels,
                values: chartData.values,
                marker: {
                  colors: chartData.colors,
                },
                hole: 0.4,
                textinfo: 'percent',
                textposition: 'inside',
                hovertemplate: '%{label}<br>%{value} 件 (%{percent})<extra></extra>',
                textfont: {
                  size: 12,
                },
              },
            ]}
            layout={{
              autosize: true,
              margin: { t: 10, b: 40, l: 10, r: 10 },
              showlegend: true,
              legend: {
                orientation: 'h',
                y: -0.1,
                x: 0.5,
                xanchor: 'center',
                font: { size: 11 },
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
