import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin } from 'lucide-react';
import { Plot } from '@/lib/plotly';

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
  '北部': 'hsl(221, 83%, 53%)',
  '中部': 'hsl(142, 71%, 45%)',
  '南部': 'hsl(47, 96%, 53%)',
  '東部': 'hsl(262, 83%, 58%)',
  '離島': 'hsl(0, 84%, 60%)',
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
    const sorted = Object.entries(cityCount)
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
      .slice(0, 10)
      .reverse(); // Reverse for horizontal bar chart (top items at top)

    return {
      cities: sorted.map(d => d.city),
      counts: sorted.map(d => d.count),
      regions: sorted.map(d => d.region),
      colors: sorted.map(d => REGION_COLORS[d.region] || REGION_COLORS['未設定']),
    };
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

  if (chartData.cities.length === 0) {
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
          <Plot
            data={[
              {
                type: 'bar',
                orientation: 'h',
                y: chartData.cities,
                x: chartData.counts,
                marker: {
                  color: chartData.colors,
                },
                text: chartData.counts.map(c => `${c} 件`),
                textposition: 'outside',
                hovertemplate: chartData.cities.map((city, i) => 
                  `${city} (${chartData.regions[i]})<br>%{x} 件<extra></extra>`
                ),
              },
            ]}
            layout={{
              autosize: true,
              margin: { t: 10, b: 30, l: 70, r: 50 },
              showlegend: false,
              xaxis: {
                title: { text: '案件數', font: { size: 11 } },
                tickfont: { size: 11 },
              },
              yaxis: {
                tickfont: { size: 11 },
                automargin: true,
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
