import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';

interface YearlyTrendChartProps {
  projects: Array<{
    intake_year?: number | null;
    fiscal_year?: number | null;
    capacity_kwp?: number | null;
    status?: string | null;
  }>;
  isLoading?: boolean;
}

export function YearlyTrendChart({ 
  projects, 
  isLoading = false 
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
      const year = p.intake_year || p.fiscal_year;
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

    return Object.values(yearStats).sort((a, b) => a.year - b.year);
  }, [projects]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            年度案件趨勢
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
          <TrendingUp className="w-4 h-4" />
          年度案件趨勢
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="year" 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => {
                  if (name === '成案率') return [`${value}%`, name];
                  if (name === '申請容量') return [`${value.toLocaleString()} kWp`, name];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar 
                yAxisId="left"
                dataKey="申請案件數" 
                fill="hsl(var(--chart-1))" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                yAxisId="left"
                dataKey="成案案件數" 
                fill="hsl(var(--chart-2))" 
                radius={[4, 4, 0, 0]}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="成案率" 
                stroke="hsl(var(--chart-5))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-5))' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
