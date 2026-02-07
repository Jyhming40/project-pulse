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
  Cell
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin } from 'lucide-react';

interface RegionDistributionChartProps {
  projects: Array<{
    city?: string | null;
  }>;
  isLoading?: boolean;
}

// 區域分組定義
const REGION_GROUPS: Record<string, string[]> = {
  '北部': ['基隆市', '台北市', '新北市', '桃園市', '新竹市', '新竹縣', '宜蘭縣'],
  '中部': ['苗栗縣', '台中市', '彰化縣', '南投縣'],
  '南部': ['雲林縣', '嘉義市', '嘉義縣', '台南市', '高雄市', '屏東縣'],
  '東部': ['花蓮縣', '台東縣'],
  '離島': ['澎湖縣', '金門縣', '連江縣'],
};

// 簡化的城市名稱對應
const CITY_ALIAS: Record<string, string> = {
  '基隆': '基隆市',
  '台北': '台北市',
  '新北': '新北市',
  '桃園': '桃園市',
  '新竹': '新竹市',
  '苗栗': '苗栗縣',
  '台中': '台中市',
  '彰化': '彰化縣',
  '南投': '南投縣',
  '雲林': '雲林縣',
  '嘉義': '嘉義縣',
  '台南': '台南市',
  '高雄': '高雄市',
  '屏東': '屏東縣',
  '花蓮': '花蓮縣',
  '台東': '台東縣',
  '澎湖': '澎湖縣',
  '金門': '金門縣',
  '馬祖': '連江縣',
};

const REGION_COLORS: Record<string, string> = {
  '北部': 'hsl(var(--chart-1))',
  '中部': 'hsl(var(--chart-2))',
  '南部': 'hsl(var(--chart-3))',
  '東部': 'hsl(var(--chart-4))',
  '離島': 'hsl(var(--chart-5))',
  '未設定': 'hsl(220, 10%, 70%)',
};

export function RegionDistributionChart({ 
  projects, 
  isLoading = false 
}: RegionDistributionChartProps) {
  const chartData = useMemo(() => {
    const cityCount: Record<string, number> = {};

    // 統計各城市案件數
    projects.forEach(p => {
      let city = p.city || '未設定';
      // 標準化城市名稱
      if (CITY_ALIAS[city]) {
        city = CITY_ALIAS[city];
      }
      cityCount[city] = (cityCount[city] || 0) + 1;
    });

    // 轉換為圖表數據，按數量排序取前 10
    return Object.entries(cityCount)
      .map(([city, count]) => {
        // 找出該城市所屬區域
        let region = '未設定';
        for (const [r, cities] of Object.entries(REGION_GROUPS)) {
          if (cities.includes(city)) {
            region = r;
            break;
          }
        }
        return { city, count, region };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
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
            <MapPin className="w-4 h-4" />
            地區分佈 (Top 10)
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
          <MapPin className="w-4 h-4" />
          地區分佈 (Top 10)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              layout="vertical"
              margin={{ top: 10, right: 30, left: 60, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                type="number"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                type="category"
                dataKey="city"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                width={50}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string, props: any) => [
                  `${value} 件 (${props.payload.region})`,
                  ''
                ]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={REGION_COLORS[entry.region] || REGION_COLORS['未設定']}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
