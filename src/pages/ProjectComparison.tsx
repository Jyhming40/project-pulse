import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Download,
  FileText,
  Copy,
  Check,
  AlertTriangle,
  Info,
  LineChart,
  BarChart3,
  Calendar,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  useProjectsForComparison,
  useComparisonDataManual,
  COMPARISON_PAIRS,
  TIMELINE_MILESTONES,
  generateComparisonCSV,
  generateLegalSummary,
  generateLegalTable,
} from "@/hooks/useProjectComparison";
import { ProjectSearchCombobox } from "@/components/projects/ProjectSearchCombobox";
import { ProjectMultiSelect } from "@/components/projects/ProjectMultiSelect";
import { ProgressLineChart } from "@/components/projects/ProgressLineChart";
import { StageAnalysisTable } from "@/components/projects/StageAnalysisTable";
import { MilestoneDatesTable } from "@/components/projects/MilestoneDatesTable";
import { useBatchSyncMilestones } from "@/hooks/useBatchSyncMilestones";

export default function ProjectComparison() {
  const [baselineProjectId, setBaselineProjectId] = useState<string | null>(null);
  const [comparisonProjectIds, setComparisonProjectIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chart");

  const { data: projects, isLoading: projectsLoading, refetch: refetchProjects } = useProjectsForComparison();
  const { data: comparisonData, isLoading: comparisonLoading, refetch: refetchComparison } = useComparisonDataManual(
    baselineProjectId,
    comparisonProjectIds
  );
  const batchSyncMutation = useBatchSyncMilestones();

  const handleBatchSync = async () => {
    const result = await batchSyncMutation.mutateAsync();
    if (result.success) {
      // Refetch data after sync
      await Promise.all([refetchProjects(), refetchComparison()]);
    }
  };

  // Removed dev-only missing milestone code warning - 
  // It's expected that projects may not have all milestones completed
  const missingCodes: string[] = [];

  // Sort results: baseline first, then by total days descending
  const sortedResults = useMemo(() => {
    if (!comparisonData) return [];
    const baseline = comparisonData.results.find(r => r.isBaseline);
    const others = comparisonData.results
      .filter(r => !r.isBaseline)
      .sort((a, b) => {
        // Calculate total days for sorting
        const getTotalDays = (r: typeof a) => {
          return COMPARISON_PAIRS.reduce((sum, pair) => {
            const interval = r.intervals[pair.id];
            if (interval?.status === 'complete' && interval.days !== null) {
              return sum + interval.days;
            }
            return sum;
          }, 0);
        };
        return getTotalDays(b) - getTotalDays(a);
      });
    return baseline ? [baseline, ...others] : others;
  }, [comparisonData]);

  const handleExportCSV = () => {
    if (!comparisonData) return;
    const csv = generateComparisonCSV(sortedResults);
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
    
    const summary = generateLegalSummary(sortedResults);

    const table = generateLegalTable(sortedResults);

    const fullContent = `${summary}\n\n---\n\n## 詳細日期比較表格\n\n${table}`;

    navigator.clipboard.writeText(fullContent).then(() => {
      setCopied(true);
      toast.success('法務版摘要已複製');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            ⚖️ 案件時程分析系統
          </h1>
          <p className="text-muted-foreground">
            含階段耗時差異分析表 | Y軸由下而上 (1→10) | 違約責任明確化
          </p>
        </div>
        {comparisonData && comparisonData.results.length > 1 && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleBatchSync}
              disabled={batchSyncMutation.isPending}
            >
              {batchSyncMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              同步所有里程碑
            </Button>
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
                        {generateLegalSummary(sortedResults)}
                      </pre>
                    </div>
                    <Separator />
                    <div>
                      <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                        {generateLegalTable(sortedResults)}
                      </pre>
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
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">案件選擇</CardTitle>
              <CardDescription>
                選擇基準案件（卡關案件）與要比較的正常案件
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {comparisonProjectIds.length + (baselineProjectId ? 1 : 0)}/11
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Baseline Project */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                基準案件（卡關案件）
                <Badge variant="destructive" className="text-xs">必填</Badge>
              </Label>
              {projectsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <ProjectSearchCombobox
                  projects={projects || []}
                  value={baselineProjectId}
                  onValueChange={(value) => {
                    setBaselineProjectId(value);
                    if (value) {
                      setComparisonProjectIds(prev => prev.filter(id => id !== value));
                    }
                  }}
                  placeholder="搜尋案件名稱或代碼..."
                />
              )}
            </div>

            {/* Baseline Year Info */}
            <div className="space-y-2">
              <Label>基準年度</Label>
              <div className="h-10 flex items-center px-3 border rounded-md bg-muted/50">
                {comparisonData ? (
                  <span className="font-medium">{comparisonData.baselineYear} 年</span>
                ) : baselineProjectId && projects ? (
                  <span className="text-muted-foreground">載入中...</span>
                ) : (
                  <span className="text-muted-foreground">請先選擇基準案件</span>
                )}
              </div>
            </div>
          </div>

          {/* Comparison Projects Multi-Select */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              比較案件（同期正常案件）
              <span className="text-muted-foreground text-sm">最多 10 件</span>
            </Label>
            {projectsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <ProjectMultiSelect
                projects={projects || []}
                selectedIds={comparisonProjectIds}
                onSelectionChange={setComparisonProjectIds}
                maxSelection={10}
                excludeIds={baselineProjectId ? [baselineProjectId] : []}
                placeholder="選擇要比較的案件..."
              />
            )}
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

      {/* Loading State */}
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

      {/* Results */}
      {comparisonData && comparisonData.results.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{comparisonData.baselineYear}</div>
                <p className="text-sm text-muted-foreground">基準年度</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{comparisonData.totalCompared + 1}</div>
                <p className="text-sm text-muted-foreground">案件總數</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{COMPARISON_PAIRS.length}</div>
                <p className="text-sm text-muted-foreground">比較階段數</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{TIMELINE_MILESTONES.length}</div>
                <p className="text-sm text-muted-foreground">里程碑總數</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Tabs */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">比較結果</CardTitle>
                  <CardDescription>
                    基準案件：{comparisonData.baseline.project_name}（{comparisonData.baseline.project_code}）
                  </CardDescription>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-red-500 rounded" />
                    <span>{comparisonData.baseline.project_name.length > 8 
                      ? comparisonData.baseline.project_name.substring(0, 8) + '...'
                      : comparisonData.baseline.project_name} (卡關)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-green-500 rounded border-dashed" style={{ borderTop: '2px dashed' }} />
                    <span>同期正常案件</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="chart" className="flex items-center gap-2">
                    <LineChart className="h-4 w-4" />
                    爬升歷程圖
                  </TabsTrigger>
                  <TabsTrigger value="analysis" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden sm:inline">階段耗時差異分析</span>
                    <span className="sm:hidden">差異分析</span>
                  </TabsTrigger>
                  <TabsTrigger value="dates" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    原始日期列表
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chart" className="mt-4">
                  <ProgressLineChart results={sortedResults} />
                </TabsContent>

                <TabsContent value="analysis" className="mt-4">
                  <StageAnalysisTable 
                    results={sortedResults} 
                    stats={comparisonData.stats}
                  />
                </TabsContent>

                <TabsContent value="dates" className="mt-4">
                  <MilestoneDatesTable results={sortedResults} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Comparison Pairs Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                比較區間說明
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                {COMPARISON_PAIRS.map((pair, idx) => (
                  <div key={pair.id} className="text-sm p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{idx + 1}.</span>
                      <span className="font-medium">{pair.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-5">
                      {pair.description}
                      {pair.fitOnly && (
                        <Badge variant="outline" className="ml-2 text-xs">FIT</Badge>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!baselineProjectId && !comparisonLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">
              <LineChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">請選擇基準案件開始比較</p>
              <p className="text-sm mt-1">
                選擇一個卡關案件作為基準，再選擇同期正常案件進行比較
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleBatchSync}
                disabled={batchSyncMutation.isPending}
              >
                {batchSyncMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {batchSyncMutation.isPending ? '同步中...' : '初始化所有專案里程碑'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
