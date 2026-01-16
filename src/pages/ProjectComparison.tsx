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
  BarChart3,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  useProjectsForComparison,
  useComparisonDataManual,
  useProjectYears,
  COMPARISON_PAIRS,
  TIMELINE_MILESTONES,
  generateComparisonCSV,
  generateLegalSummary,
  generateLegalTable,
  ComparisonResult,
} from "@/hooks/useProjectComparison";
import { ProjectSearchCombobox } from "@/components/projects/ProjectSearchCombobox";
import { ProjectMultiSelect } from "@/components/projects/ProjectMultiSelect";
import { MilestoneTimelineChart } from "@/components/projects/MilestoneTimelineChart";

export default function ProjectComparison() {
  const [baselineProjectId, setBaselineProjectId] = useState<string | null>(null);
  const [comparisonProjectIds, setComparisonProjectIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("table");

  const { data: projects, isLoading: projectsLoading } = useProjectsForComparison();
  const { data: years } = useProjectYears();
  const { data: comparisonData, isLoading: comparisonLoading } = useComparisonDataManual(
    baselineProjectId,
    comparisonProjectIds
  );

  // Check for missing milestone codes (dev only)
  const missingCodes = useMemo(() => {
    if (!comparisonData) return [];
    const allCodes = new Set<string>();
    for (const result of comparisonData.results) {
      Object.keys(result.milestones).forEach(code => allCodes.add(code));
    }
    // Use Set to avoid duplicate code warnings
    const requiredCodesSet = new Set(COMPARISON_PAIRS.flatMap(p => [p.from, p.to]));
    return Array.from(requiredCodesSet).filter(code => !allCodes.has(code));
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

  // Prepare timeline data
  const timelineData = useMemo(() => {
    if (!comparisonData) return [];
    
    return comparisonData.results.map(result => ({
      projectId: result.project.id,
      projectName: result.project.project_name,
      projectCode: result.project.project_code,
      isBaseline: result.isBaseline,
      milestones: TIMELINE_MILESTONES.map(def => ({
        code: def.code,
        label: def.label,
        completedAt: result.milestones[def.code] || null,
      })),
    }));
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
      0 // Not using range anymore
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
            比較基準案件與選定案件的行政/工程進度速度差異
          </p>
        </div>
        {comparisonData && comparisonData.results.length > 1 && (
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
                          0
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
          <CardDescription>選擇基準案件與要比較的案件（最多 10 件）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Baseline Project */}
            <div className="space-y-2">
              <Label>基準案件（必填）</Label>
              {projectsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <ProjectSearchCombobox
                  projects={projects || []}
                  value={baselineProjectId}
                  onValueChange={(value) => {
                    setBaselineProjectId(value);
                    // Remove from comparison if selected as baseline
                    if (value) {
                      setComparisonProjectIds(prev => prev.filter(id => id !== value));
                    }
                  }}
                  placeholder="搜尋案件名稱或代碼..."
                />
              )}
            </div>

            {/* Comparison Year Info */}
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
            <Label>比較案件（可多選，最多 10 件）</Label>
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

          {/* Comparison Pairs Info */}
          <div className="p-4 bg-muted/50 rounded-lg">
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

      {comparisonData && comparisonData.results.length > 0 && (
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

          {/* Tabs for Table and Timeline views */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">比較結果</CardTitle>
                  <CardDescription>
                    基準案件：{comparisonData.baseline.project_name}（{comparisonData.baseline.project_code}）
                  </CardDescription>
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="table">表格檢視</TabsTrigger>
                    <TabsTrigger value="timeline">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      時間軸
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === "table" ? (
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
                      {sortedResults.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            請選擇基準案件和比較案件
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedResults.map(result => (
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
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <MilestoneTimelineChart
                  projects={timelineData}
                  milestoneDefinitions={TIMELINE_MILESTONES}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state when no baseline selected */}
      {!baselineProjectId && !comparisonLoading && (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">開始比較案件進度</h3>
              <p>請先選擇一個基準案件，再選擇要比較的案件</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
