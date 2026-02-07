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
  Legend
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Layers } from 'lucide-react';

interface CapacityDistributionChartProps {
  projects: Array<{
    intake_year?: number | null;
    fiscal_year?: number | null;
    capacity_kwp?: number | null;
  }>;
  isLoading?: boolean;
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
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210, 70%, 50%)',
];

export function CapacityDistributionChart({ 
  projects, 
  isLoading = false 
}: CapacityDistributionChartProps) {
  const chartData = useMemo(() => {
    const yearBrackets: Record<number, Record<string, number>> = {};

    // 統計各年度各級距的案件數
    projects.forEach(p => {
      const year = p.intake_year || p.fiscal_year;
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

    return Object.entries(yearBrackets)
      .map(([year, brackets]) => ({
        year: parseInt(year),
        ...brackets,
      }))
      .sort((a, b) => a.year - b.year);
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
            <Layers className="w-4 h-4" />
            容量級距分佈
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
          <Layers className="w-4 h-4" />
          容量級距分佈
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="year" 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`${value} 件`, '']}
              />
              <Legend />
              {CAPACITY_BRACKETS.map((bracket, index) => (
                <Bar
                  key={bracket.key}
                  dataKey={bracket.key}
                  stackId="a"
                  fill={BRACKET_COLORS[index]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
