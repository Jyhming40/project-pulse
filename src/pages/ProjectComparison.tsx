import { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
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
  AlertOctagon,
  Calculator,
  Grid3X3,
  Scale,
  GripVertical,
  RotateCcw,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { useCustomStages } from "@/hooks/useCustomStages";
import { useProjectDisputes } from "@/hooks/useProjectDisputes";
import { useSectionOrder, SectionId } from "@/hooks/useSectionOrder";
import { ProjectSearchCombobox } from "@/components/projects/ProjectSearchCombobox";
import { ProjectMultiSelect } from "@/components/projects/ProjectMultiSelect";
import { ProgressPlotlyChart } from "@/components/projects/ProgressPlotlyChart";
import { StageDurationBarChart } from "@/components/projects/StageDurationBarChart";
import { StageDurationHeatmap } from "@/components/projects/StageDurationHeatmap";
import { StageAnalysisTable } from "@/components/projects/StageAnalysisTable";
import { MilestoneDatesTable } from "@/components/projects/MilestoneDatesTable";
import { ComparisonControlPanel, SectionVisibility, ChartMode } from "@/components/projects/ComparisonControlPanel";
import { BottleneckAnalysis } from "@/components/projects/BottleneckAnalysis";
import { ComparisonStatsCards } from "@/components/projects/ComparisonStatsCards";
import { IntervalSelector } from "@/components/projects/IntervalSelector";
import { DisputeSettingsPanel, DisputeDisplayStrategyPanel } from "@/components/projects/DisputeSettingsPanel";
import { DisputeKpiCards } from "@/components/projects/DisputeKpiCards";
import { SortableSectionCard } from "@/components/projects/SortableSectionCard";
import { useBatchSyncMilestones } from "@/hooks/useBatchSyncMilestones";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function ProjectComparison() {
  const [baselineProjectId, setBaselineProjectId] = useState<string | null>(null);
  const [comparisonProjectIds, setComparisonProjectIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  
  // Selected intervals for legal output (default: all)
  const [selectedIntervals, setSelectedIntervals] = useState<string[]>(
    COMPARISON_PAIRS.map(p => p.id)
  );
  
  // Right panel state
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibility>({
    chart: true,
    bottleneck: true,
    stats: true,
    analysis: true,
    dates: true,
    pairInfo: false,
  });
  
  // Chart mode state
  const [chartMode, setChartMode] = useState<ChartMode>("progress");
  
  // Section expanded state (for collapsible sections)
  const [sectionsExpanded, setSectionsExpanded] = useState({
    chart: true,
    bottleneck: true,
    stats: true,
    analysis: true,
    dates: true,
    pairInfo: false,
    disputeKpi: true,
  });

  // Dispute settings from localStorage
  const { disputes, strategy, isLoading: disputesLoading } = useProjectDisputes();
  
  // Custom stages from useCustomStages hook
  const { userStages } = useCustomStages();

  // Section order (drag-and-drop)
  const { sectionOrder, reorderSections, resetOrder } = useSectionOrder();

  // DnD sensors
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderSections(active.id as string, over.id as string);
      toast.success('區塊順序已更新');
    }
  }, [reorderSections]);

  const { data: projects, isLoading: projectsLoading, refetch: refetchProjects } = useProjectsForComparison();
  const { data: comparisonData, isLoading: comparisonLoading, refetch: refetchComparison } = useComparisonDataManual(
    baselineProjectId,
    comparisonProjectIds
  );
  const batchSyncMutation = useBatchSyncMilestones();

  const handleBatchSync = async () => {
    const result = await batchSyncMutation.mutateAsync();
    if (result.success) {
      await Promise.all([refetchProjects(), refetchComparison()]);
    }
  };

  const missingCodes: string[] = [];

  // Sort results: baseline first, then by total days descending
  const sortedResults = useMemo(() => {
    if (!comparisonData) return [];
    const baseline = comparisonData.results.find(r => r.isBaseline);
    const others = comparisonData.results
      .filter(r => !r.isBaseline)
      .sort((a, b) => {
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

  // Get selected projects for dispute panel
  const selectedProjects = useMemo(() => {
    if (!projects) return [];
    const ids = baselineProjectId ? [baselineProjectId, ...comparisonProjectIds] : comparisonProjectIds;
    return projects.filter(p => ids.includes(p.id));
  }, [projects, baselineProjectId, comparisonProjectIds]);

  // Filter disputes based on selected projects
  const relevantDisputes = useMemo(() => {
    return disputes.filter(d => selectedProjects.some(p => p.id === d.project_id));
  }, [disputes, selectedProjects]);

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
    
    const summary = generateLegalSummary(sortedResults, selectedIntervals);
    const table = generateLegalTable(sortedResults);
    const fullContent = `${summary}\n\n---\n\n## 詳細日期比較表格\n\n${table}`;

    navigator.clipboard.writeText(fullContent).then(() => {
      setCopied(true);
      toast.success('法務版摘要已複製');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleSectionExpanded = (section: keyof typeof sectionsExpanded) => {
    setSectionsExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Get chart icon based on mode
  const getChartIcon = () => {
    switch (chartMode) {
      case "progress": return <LineChart className="h-5 w-5 text-primary" />;
      case "duration-bar": return <BarChart3 className="h-5 w-5 text-primary" />;
      case "heatmap": return <Grid3X3 className="h-5 w-5 text-primary" />;
    }
  };

  const getChartTitle = () => {
    switch (chartMode) {
      case "progress": return "進度爬升曲線";
      case "duration-bar": return "階段耗時長條圖";
      case "heatmap": return "階段耗時熱力圖";
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Main Content (Left) */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                ⚖️ 案件時程分析系統
              </h1>
              <p className="text-muted-foreground">
                含階段耗時差異分析表 | Plotly 互動圖表 | 違約責任明確化
              </p>
            </div>
            {comparisonData && comparisonData.results.length > 1 && (
              <div className="flex gap-2 flex-wrap">
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
                  同步里程碑
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
                    
                    {/* Interval selector */}
                    <div className="flex items-center gap-4 py-2 border-b">
                      <IntervalSelector
                        selectedIntervals={selectedIntervals}
                        onSelectionChange={setSelectedIntervals}
                      />
                      <span className="text-sm text-muted-foreground">
                        已選擇 {selectedIntervals.length} / {COMPARISON_PAIRS.length} 個區間
                      </span>
                    </div>
                    
                    <ScrollArea className="h-[55vh] pr-4">
                      <div className="space-y-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                            {generateLegalSummary(sortedResults, selectedIntervals)}
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

          {/* Missing Codes Warning */}
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
                    <div className="text-2xl font-bold">{relevantDisputes.length}</div>
                    <p className="text-sm text-muted-foreground">爭議記錄</p>
                  </CardContent>
                </Card>
              </div>

              {/* Sortable Sections with Drag Hint */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <GripVertical className="h-3 w-3" />
                  <span>拖曳左側手柄可調整區塊順序</span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={resetOrder}>
                        <RotateCcw className="h-3 w-3 mr-1" />
                        重置順序
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>恢復預設區塊順序</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
                  <div className="space-y-6">
                    {sectionOrder.map((sectionId) => {
                      // Render each section based on its ID and visibility
                      switch (sectionId) {
                        case 'chart':
                          if (!sectionVisibility.chart) return null;
                          return (
                            <SortableSectionCard key={sectionId} id={sectionId}>
                              <Collapsible open={sectionsExpanded.chart} onOpenChange={() => toggleSectionExpanded('chart')}>
                                <CardHeader className="pb-2 pl-10">
                                  <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-6 -mt-6 px-6 pt-6 pb-2 rounded-t-lg">
                                      <div className="flex items-center gap-2">
                                        {getChartIcon()}
                                        <CardTitle className="text-lg">{getChartTitle()}</CardTitle>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-xs">Plotly 互動</Badge>
                                        {sectionsExpanded.chart ? (
                                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                        )}
                                      </div>
                                    </div>
                                  </CollapsibleTrigger>
                                  <CardDescription className="ml-1">
                                    基準案件：{comparisonData.baseline.project_name}（{comparisonData.baseline.project_code}）
                                  </CardDescription>
                                </CardHeader>
                                <CollapsibleContent>
                                  <CardContent className="pt-4">
                                    {chartMode === "progress" && (
                                      <ProgressPlotlyChart 
                                        results={sortedResults} 
                                        disputes={relevantDisputes}
                                        displayStrategy={strategy}
                                      />
                                    )}
                                    {chartMode === "duration-bar" && (
                                      <StageDurationBarChart 
                                        results={sortedResults}
                                        disputes={relevantDisputes}
                                        displayStrategy={strategy}
                                        customStages={userStages}
                                      />
                                    )}
                                    {chartMode === "heatmap" && (
                                      <StageDurationHeatmap 
                                        results={sortedResults}
                                        disputes={relevantDisputes}
                                        displayStrategy={strategy}
                                        customStages={userStages}
                                      />
                                    )}
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </SortableSectionCard>
                          );

                        case 'disputeKpi':
                          if (relevantDisputes.length === 0) return null;
                          return (
                            <SortableSectionCard key={sectionId} id={sectionId}>
                              <Collapsible open={sectionsExpanded.disputeKpi} onOpenChange={() => toggleSectionExpanded('disputeKpi')}>
                                <CardHeader className="pb-2 pl-10">
                                  <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-6 -mt-6 px-6 pt-6 pb-2 rounded-t-lg">
                                      <div className="flex items-center gap-2">
                                        <Scale className="h-5 w-5 text-amber-500" />
                                        <CardTitle className="text-lg">爭議影響分析</CardTitle>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">Iteration 2</Badge>
                                        {sectionsExpanded.disputeKpi ? (
                                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                        )}
                                      </div>
                                    </div>
                                  </CollapsibleTrigger>
                                  <CardDescription className="ml-1">
                                    各案場爭議期間與流程區間的重疊統計
                                  </CardDescription>
                                </CardHeader>
                                <CollapsibleContent>
                                  <CardContent className="pt-4">
                                    <DisputeKpiCards 
                                      results={sortedResults}
                                      disputes={relevantDisputes}
                                      strategy={strategy}
                                    />
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </SortableSectionCard>
                          );

                        case 'bottleneck':
                          if (!sectionVisibility.bottleneck) return null;
                          return (
                            <SortableSectionCard key={sectionId} id={sectionId}>
                              <Collapsible open={sectionsExpanded.bottleneck} onOpenChange={() => toggleSectionExpanded('bottleneck')}>
                                <CardHeader className="pb-2 pl-10">
                                  <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-6 -mt-6 px-6 pt-6 pb-2 rounded-t-lg">
                                      <div className="flex items-center gap-2">
                                        <AlertOctagon className="h-5 w-5 text-destructive" />
                                        <CardTitle className="text-lg">瓶頸階段識別</CardTitle>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {sectionsExpanded.bottleneck ? (
                                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                        )}
                                      </div>
                                    </div>
                                  </CollapsibleTrigger>
                                  <CardDescription className="ml-1">
                                    自動識別各案件延遲最嚴重的階段，突顯超過平均 1.5 倍或 2 倍的瓶頸
                                  </CardDescription>
                                </CardHeader>
                                <CollapsibleContent>
                                  <CardContent className="pt-4">
                                    <BottleneckAnalysis 
                                      results={sortedResults} 
                                      stats={comparisonData.stats}
                                    />
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </SortableSectionCard>
                          );

                        case 'stats':
                          if (!sectionVisibility.stats) return null;
                          return (
                            <SortableSectionCard key={sectionId} id={sectionId}>
                              <Collapsible open={sectionsExpanded.stats} onOpenChange={() => toggleSectionExpanded('stats')}>
                                <CardHeader className="pb-2 pl-10">
                                  <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-6 -mt-6 px-6 pt-6 pb-2 rounded-t-lg">
                                      <div className="flex items-center gap-2">
                                        <Calculator className="h-5 w-5 text-primary" />
                                        <CardTitle className="text-lg">同年度統計分析</CardTitle>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {sectionsExpanded.stats ? (
                                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                        )}
                                      </div>
                                    </div>
                                  </CollapsibleTrigger>
                                  <CardDescription className="ml-1">
                                    平均值、中位數、標準差等統計指標，以及基準案件與同期的差異
                                  </CardDescription>
                                </CardHeader>
                                <CollapsibleContent>
                                  <CardContent className="pt-4">
                                    <ComparisonStatsCards 
                                      results={sortedResults} 
                                      stats={comparisonData.stats}
                                      customStages={userStages}
                                    />
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </SortableSectionCard>
                          );

                        case 'analysis':
                          if (!sectionVisibility.analysis) return null;
                          return (
                            <SortableSectionCard key={sectionId} id={sectionId}>
                              <Collapsible open={sectionsExpanded.analysis} onOpenChange={() => toggleSectionExpanded('analysis')}>
                                <CardHeader className="pb-2 pl-10">
                                  <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-6 -mt-6 px-6 pt-6 pb-2 rounded-t-lg">
                                      <div className="flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5 text-primary" />
                                        <CardTitle className="text-lg">階段耗時差異分析</CardTitle>
                                      </div>
                                      {sectionsExpanded.analysis ? (
                                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                      )}
                                    </div>
                                  </CollapsibleTrigger>
                                </CardHeader>
                                <CollapsibleContent>
                                  <CardContent className="pt-4">
                                    <StageAnalysisTable 
                                      results={sortedResults} 
                                      stats={comparisonData.stats}
                                      customStages={userStages}
                                    />
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </SortableSectionCard>
                          );

                        case 'dates':
                          if (!sectionVisibility.dates) return null;
                          return (
                            <SortableSectionCard key={sectionId} id={sectionId}>
                              <Collapsible open={sectionsExpanded.dates} onOpenChange={() => toggleSectionExpanded('dates')}>
                                <CardHeader className="pb-2 pl-10">
                                  <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-6 -mt-6 px-6 pt-6 pb-2 rounded-t-lg">
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-primary" />
                                        <CardTitle className="text-lg">原始日期列表</CardTitle>
                                      </div>
                                      {sectionsExpanded.dates ? (
                                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                      )}
                                    </div>
                                  </CollapsibleTrigger>
                                </CardHeader>
                                <CollapsibleContent>
                                  <CardContent className="pt-4">
                                    <MilestoneDatesTable results={sortedResults} />
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </SortableSectionCard>
                          );

                        case 'pairInfo':
                          if (!sectionVisibility.pairInfo) return null;
                          return (
                            <SortableSectionCard key={sectionId} id={sectionId}>
                              <Collapsible open={sectionsExpanded.pairInfo} onOpenChange={() => toggleSectionExpanded('pairInfo')}>
                                <CardHeader className="pb-2 pl-10">
                                  <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-6 -mt-6 px-6 pt-6 pb-2 rounded-t-lg">
                                      <div className="flex items-center gap-2">
                                        <Info className="h-5 w-5 text-primary" />
                                        <CardTitle className="text-lg">比較區間說明</CardTitle>
                                      </div>
                                      {sectionsExpanded.pairInfo ? (
                                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                      )}
                                    </div>
                                  </CollapsibleTrigger>
                                </CardHeader>
                                <CollapsibleContent>
                                  <CardContent className="pt-4">
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
                                </CollapsibleContent>
                              </Collapsible>
                            </SortableSectionCard>
                          );

                        default:
                          return null;
                      }
                    })}
                  </div>
                </SortableContext>
              </DndContext>
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
      </div>

      {/* Right Control Panel */}
      <ComparisonControlPanel
        visibility={sectionVisibility}
        onVisibilityChange={setSectionVisibility}
        isCollapsed={panelCollapsed}
        onCollapseChange={setPanelCollapsed}
        chartMode={chartMode}
        onChartModeChange={setChartMode}
        disputeSettingsSlot={
          <DisputeSettingsPanel selectedProjects={selectedProjects} />
        }
        disputeStrategySlot={
          <DisputeDisplayStrategyPanel />
        }
      />
    </div>
  );
}
