import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import {
  Download,
  FileText,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  useProjectsForComparison,
  useComparisonData,
  COMPARISON_PAIRS,
  generateComparisonCSV,
  generateLegalSummary,
  generateLegalTable,
  ComparisonResult,
} from "@/hooks/useProjectComparison";

const RANGE_OPTIONS = [
  { value: "30", label: "± 30 天" },
  { value: "60", label: "± 60 天" },
  { value: "90", label: "± 90 天" },
  { value: "120", label: "± 120 天" },
];

const LIMIT_OPTIONS = [
  { value: "10", label: "10 件" },
  { value: "20", label: "20 件" },
  { value: "30", label: "30 件" },
  { value: "50", label: "50 件" },
];

export default function ProjectComparison() {
  const [baselineProjectId, setBaselineProjectId] = useState<string | null>(null);
  const [sameYearRange, setSameYearRange] = useState(90);
  const [limit, setLimit] = useState(30);
  const [copied, setCopied] = useState(false);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);

  const { data: projects, isLoading: projectsLoading } = useProjectsForComparison();
  const { data: comparisonData, isLoading: comparisonLoading } = useComparisonData(
    baselineProjectId,
    sameYearRange,
    limit
  );

  // Check for missing milestone codes (dev only)
  const missingCodes = useMemo(() => {
    if (!comparisonData) return [];
    const allCodes = new Set<string>();
    for (const result of comparisonData.results) {
      Object.keys(result.milestones).forEach(code => allCodes.add(code));
    }
    const requiredCodes = COMPARISON_PAIRS.flatMap(p => [p.from, p.to]);
    return requiredCodes.filter(code => !allCodes.has(code));
  }, [comparisonData]);

  // Sort results: baseline first, then by construction days descending
  const sortedResults = useMemo(() => {
    if (!comparisonData) return [];
    const baseline = comparisonData.results.find(r => r.isBaseline);
    const others = comparisonData.results
      .filter(r => !r.isBaseline)
      .sort((a, b) => {
        const aDays = a.intervals.construction?.days ?? -Infinity;
        const bDays = b.intervals.construction?.days ?? -Infinity;
        return bDays - aDays;
      });
    return baseline ? [baseline, ...others] : others;
  }, [comparisonData]);

  const handleExportCSV = () => {
    if (!comparisonData) return;
    const csv = generateComparisonCSV(sortedResults, comparisonData.baseline);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `案件進度比較_${comparisonData.baseline.project_code}_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV 已下載');
  };

  const handleCopyLegal = () => {
    if (!comparisonData) return;
    
    const summary = generateLegalSummary(
      comparisonData.baseline,
      sortedResults,
      comparisonData.stats,
      sameYearRange
    );

    const tables = COMPARISON_PAIRS
      .filter(p => !p.fitOnly || comparisonData.baseline.revenue_model === 'FIT')
      .map(p => generateLegalTable(sortedResults, p.id))
      .join('\n\n');

    const fullContent = `${summary}\n\n---\n\n## 詳細比較表格\n\n${tables}`;

    navigator.clipboard.writeText(fullContent).then(() => {
      setCopied(true);
      toast.success('法務版摘要已複製');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const renderIntervalCell = (result: ComparisonResult, pairId: string) => {
    const interval = result.intervals[pairId];
    
    if (interval.status === 'na') {
      return <span className="text-muted-foreground text-sm">N/A</span>;
    }

    if (interval.status === 'incomplete') {
      return <span className="text-muted-foreground text-sm">未完成</span>;
    }

    return (
      <div className="space-y-1">
        <div className="font-medium">{interval.days} 天</div>
        {result.isBaseline ? (
          <Badge variant="outline" className="text-xs">基準</Badge>
        ) : interval.delta !== null ? (
          <Badge
            variant={interval.delta > 0 ? "destructive" : interval.delta < 0 ? "secondary" : "outline"}
            className="text-xs"
          >
            {interval.delta >= 0 ? '+' : ''}{interval.delta}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">Δ N/A</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">案件進度比較</h1>
            <p className="text-muted-foreground">
              比較基準案件與同期案件的行政/工程進度速度差異
            </p>
          </div>
          {comparisonData && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="mr-2 h-4 w-4" />
                匯出 CSV
              </Button>
              <Dialog open={legalDialogOpen} onOpenChange={setLegalDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <FileText className="mr-2 h-4 w-4" />
                    法務版輸出
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle>法務版摘要</DialogTitle>
                    <DialogDescription>
                      可複製貼到說明書、存證信函或法律文件
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-[60vh] pr-4">
                    <div className="space-y-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                          {generateLegalSummary(
                            comparisonData.baseline,
                            sortedResults,
                            comparisonData.stats,
                            sameYearRange
                          )}
                        </pre>
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        {COMPARISON_PAIRS
                          .filter(p => !p.fitOnly || comparisonData.baseline.revenue_model === 'FIT')
                          .map(pair => (
                            <div key={pair.id}>
                              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                                {generateLegalTable(sortedResults, pair.id)}
                              </pre>
                            </div>
                          ))}
                      </div>
                    </div>
                  </ScrollArea>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setLegalDialogOpen(false)}>
                      關閉
                    </Button>
                    <Button onClick={handleCopyLegal}>
                      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copied ? '已複製' : '複製全部'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">比較設定</CardTitle>
            <CardDescription>選擇基準案件與比較條件</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {/* Baseline Project */}
              <div className="space-y-2 md:col-span-2">
                <Label>基準案件（必填）</Label>
                <Select
                  value={baselineProjectId || ""}
                  onValueChange={setBaselineProjectId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇案件..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsLoading ? (
                      <div className="p-2">載入中...</div>
                    ) : (
                      projects?.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.project_name} ({p.project_code})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Same Year Range */}
              <div className="space-y-2">
                <Label>同期範圍</Label>
                <Select
                  value={String(sameYearRange)}
                  onValueChange={v => setSameYearRange(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RANGE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Limit */}
              <div className="space-y-2">
                <Label>案件上限</Label>
                <Select
                  value={String(limit)}
                  onValueChange={v => setLimit(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LIMIT_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Comparison Pairs Info */}
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">比較區間（固定）</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {COMPARISON_PAIRS.map(pair => (
                  <div key={pair.id} className="text-sm">
                    <span className="font-medium">{pair.label}</span>
                    <span className="text-muted-foreground ml-2">
                      {pair.description}
                      {pair.fitOnly && (
                        <Badge variant="outline" className="ml-2 text-xs">FIT 專用</Badge>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Missing Codes Warning (dev only) */}
        {process.env.NODE_ENV === 'development' && missingCodes.length > 0 && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-warning-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">缺少對應 milestone code：</span>
                <code className="text-sm">{missingCodes.join(', ')}</code>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {comparisonLoading && baselineProjectId && (
          <Card>
            <CardContent className="py-8">
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </CardContent>
          </Card>
        )}

        {comparisonData && (
          <>
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{comparisonData.baselineYear}</div>
                  <p className="text-sm text-muted-foreground">基準年度</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{comparisonData.totalCompared}</div>
                  <p className="text-sm text-muted-foreground">比較案件數</p>
                </CardContent>
              </Card>
              {comparisonData.stats.find(s => s.pairId === 'construction') && (
                <>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {comparisonData.stats.find(s => s.pairId === 'construction')?.median ?? '-'}
                      </div>
                      <p className="text-sm text-muted-foreground">施工期中位數（天）</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {comparisonData.stats.find(s => s.pairId === 'construction')?.average ?? '-'}
                      </div>
                      <p className="text-sm text-muted-foreground">施工期平均（天）</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">比較結果</CardTitle>
                <CardDescription>
                  基準案件：{comparisonData.baseline.project_name}（{comparisonData.baseline.project_code}）
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">案場名稱</TableHead>
                        <TableHead className="min-w-[100px]">建立日期</TableHead>
                        <TableHead className="min-w-[80px]">收益模式</TableHead>
                        {COMPARISON_PAIRS.map(pair => (
                          <TableHead key={pair.id} className="min-w-[100px] text-center">
                            {pair.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedResults.map(result => (
                        <TableRow
                          key={result.project.id}
                          className={result.isBaseline ? "bg-primary/5 font-medium" : ""}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {result.isBaseline && (
                                <Badge variant="default" className="text-xs">基準</Badge>
                              )}
                              <Link
                                to={`/projects/${result.project.id}`}
                                className="hover:underline flex items-center gap-1"
                              >
                                {result.project.project_name}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {result.project.project_code}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(result.project.created_at), 'yyyy/MM/dd', { locale: zhTW })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {result.project.revenue_model || '-'}
                            </Badge>
                          </TableCell>
                          {COMPARISON_PAIRS.map(pair => (
                            <TableCell key={pair.id} className="text-center">
                              {renderIntervalCell(result, pair.id)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {sortedResults.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            無比較資料
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">統計摘要</CardTitle>
                <CardDescription>各區間統計數據（不含基準案件）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {comparisonData.stats.map(stat => {
                    const pair = COMPARISON_PAIRS.find(p => p.id === stat.pairId);
                    if (!pair) return null;
                    return (
                      <Card key={stat.pairId}>
                        <CardContent className="pt-4">
                          <h4 className="font-medium text-sm mb-2">{pair.label}</h4>
                          {stat.count > 0 ? (
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">樣本數</span>
                                <span>{stat.count}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">平均</span>
                                <span>{stat.average} 天</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">中位數</span>
                                <span>{stat.median} 天</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">範圍</span>
                                <span>{stat.min} ~ {stat.max}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">無可比較資料</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Empty State */}
        {!baselineProjectId && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">選擇基準案件開始比較</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                從上方選擇一個基準案件，系統將自動找出同年度、同期範圍內的案件進行進度比較。
              </p>
            </CardContent>
          </Card>
        )}
      </div>
  );
}
