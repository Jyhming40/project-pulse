import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface StatusDistributionChartProps {
  title: string;
  distribution: Record<string, number>;
  isLoading?: boolean;
}

// 狀態對應顏色 - 使用 HSL 色彩
const STATUS_COLORS: Record<string, string> = {
  // 案場狀態
  '開發中': 'hsl(var(--chart-1))',
  '土地確認': 'hsl(var(--chart-2))',
  '結構簽證': 'hsl(var(--chart-3))',
  '台電送件': 'hsl(var(--chart-4))',
  '台電審查': 'hsl(var(--chart-5))',
  '能源局送件': 'hsl(210, 70%, 50%)',
  '同意備案': 'hsl(150, 60%, 45%)',
  '工程施工': 'hsl(35, 90%, 50%)',
  '報竣掛表': 'hsl(280, 60%, 55%)',
  '設備登記': 'hsl(180, 50%, 45%)',
  '運維中': 'hsl(145, 65%, 42%)',
  '暫停': 'hsl(45, 90%, 50%)',
  '取消': 'hsl(0, 70%, 50%)',
  // 施工狀態
  '已開工': 'hsl(145, 65%, 42%)',
  '尚未開工': 'hsl(220, 15%, 55%)',
  '已掛錶': 'hsl(150, 60%, 45%)',
  '待掛錶': 'hsl(35, 90%, 50%)',
  '暫緩': 'hsl(45, 90%, 50%)',
  '未設定': 'hsl(220, 10%, 70%)',
};

const DEFAULT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210, 70%, 50%)',
  'hsl(150, 60%, 45%)',
  'hsl(35, 90%, 50%)',
];

export function StatusDistributionChart({ 
  title, 
  distribution, 
  isLoading = false 
}: StatusDistributionChartProps) {
  const chartData = useMemo(() => {
    return Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [distribution]);

  const total = useMemo(() => 
    chartData.reduce((sum, item) => sum + item.value, 0), 
    [chartData]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
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

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{title}</CardTitle>
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
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => 
                  percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                }
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={STATUS_COLORS[entry.name] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value} 件 (${((value / total) * 100).toFixed(1)}%)`, '']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
              />
              <Legend 
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
