import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
} from 'lucide-react';
import { useAuditMetrics, MetricDefinition } from '@/hooks/useDashboardAudit';

// 開發環境檢查
const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

export default function DashboardAudit() {
  const navigate = useNavigate();
  const { metrics, isLoading } = useAuditMetrics();
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // 如果不是開發環境，顯示警告
  if (!isDev) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertTriangle className="w-16 h-16 text-warning" />
        <h1 className="text-2xl font-bold">僅限開發環境</h1>
        <p className="text-muted-foreground">此頁面僅在開發環境中可用</p>
        <Button onClick={() => navigate('/')}>返回首頁</Button>
      </div>
    );
  }

  const toggleMetric = (metricId: string) => {
    setExpandedMetrics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(metricId)) {
        newSet.delete(metricId);
      } else {
        newSet.add(metricId);
      }
      return newSet;
    });
  };

  // 獲取所有類別
  const categories = [...new Set(metrics.map(m => m.category))];

  // 過濾指標
  const filteredMetrics = metrics.filter(m => {
    if (categoryFilter && m.category !== categoryFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        m.name.toLowerCase().includes(search) ||
        m.definition.toLowerCase().includes(search) ||
        m.category.toLowerCase().includes(search)
      );
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6" />
            Dashboard 指標稽核
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            驗證儀表板指標的計算邏輯與資料來源
          </p>
        </div>
        <Badge variant="outline" className="ml-auto">
          DEV ONLY
        </Badge>
      </div>

      {/* 統計摘要 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">總指標數</p>
            <p className="text-2xl font-bold">{metrics.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">類別數</p>
            <p className="text-2xl font-bold">{categories.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">projects 來源</p>
            <p className="text-2xl font-bold">
              {metrics.filter(m => m.dataSource === 'projects').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">view 來源</p>
            <p className="text-2xl font-bold">
              {metrics.filter(m => m.dataSource === 'project_analytics_view').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 篩選工具列 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋指標名稱或定義..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={categoryFilter === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter(null)}
          >
            全部
          </Button>
          {categories.map(cat => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* 指標清單 */}
      <div className="space-y-4">
        {filteredMetrics.map(metric => (
          <MetricCard
            key={metric.id}
            metric={metric}
            isExpanded={expandedMetrics.has(metric.id)}
            onToggle={() => toggleMetric(metric.id)}
            onNavigateToProject={(projectId) => navigate(`/projects/${projectId}`)}
          />
        ))}
      </div>

      {filteredMetrics.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mb-4" />
          <p>沒有符合條件的指標</p>
        </div>
      )}
    </div>
  );
}

// 單一指標卡片元件
function MetricCard({
  metric,
  isExpanded,
  onToggle,
  onNavigateToProject,
}: {
  metric: MetricDefinition;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigateToProject: (projectId: string) => void;
}) {
  const detailCount = metric.details.length;
  const showDetails = detailCount <= 50 ? metric.details : metric.details.slice(0, 50);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    {metric.name}
                    <Badge variant="secondary" className="text-xs">
                      {metric.category}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {metric.definition}
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{metric.value}</p>
                <p className="text-xs text-muted-foreground">
                  {detailCount} 筆明細
                </p>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="border-t pt-4 space-y-4">
            {/* 資料來源與條件 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">資料來源</p>
                <p className="font-mono text-sm">{metric.dataSource}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">篩選條件</p>
                <p className="font-mono text-sm break-all">{metric.condition}</p>
              </div>
            </div>

            {/* 明細列表 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">明細列表</p>
                {detailCount > 50 && (
                  <Badge variant="outline" className="text-xs">
                    顯示前 50 筆 / 共 {detailCount} 筆
                  </Badge>
                )}
              </div>
              
              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">案場代碼</TableHead>
                      <TableHead>案場名稱</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>施工狀態</TableHead>
                      <TableHead>關鍵值</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {showDetails.map((detail, idx) => (
                      <TableRow key={`${detail.id}-${idx}`}>
                        <TableCell className="font-mono text-xs">
                          {detail.project_code || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {detail.project_name || '-'}
                        </TableCell>
                        <TableCell>
                          {detail.status && (
                            <Badge variant="outline" className="text-xs">
                              {detail.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {detail.construction_status || '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {detail.key_value !== undefined ? String(detail.key_value) : 
                           detail.key_date ? new Date(detail.key_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onNavigateToProject(detail.id)}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            {/* 驗證狀態 */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm text-success">
                計算結果 {metric.value} = 明細數 {detailCount} 筆 
                {typeof metric.value === 'number' && metric.value === detailCount 
                  ? ' ✓ 一致' 
                  : ' (含計算值)'}
              </span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
