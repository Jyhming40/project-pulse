import { useState, useMemo } from 'react';
import { useDuplicateScanner, DuplicateGroup, ConfidenceLevel, ProjectForComparison } from '@/hooks/useDuplicateScanner';
import { useDuplicateScannerSettings } from '@/hooks/useDuplicateScannerSettings';
import { DuplicateScannerSettingsPanel } from '@/components/DuplicateScannerSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Eye,
  RefreshCw,
  FileSearch,
  ChevronRight,
  Info,
  Check,
  X,
  GitMerge,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const confidenceLevelConfig: Record<ConfidenceLevel, { label: string; color: string; description: string }> = {
  high: { 
    label: '高可信度', 
    color: 'bg-destructive text-destructive-foreground',
    description: '案場代碼或投資代碼+年份+序號完全相同'
  },
  medium: { 
    label: '中可信度', 
    color: 'bg-amber-500 text-white',
    description: '地址相似≥80% 或 名稱相似≥75%'
  },
  low: { 
    label: '低可信度', 
    color: 'bg-muted text-muted-foreground',
    description: '同投資方、同鄉鎮市區、容量相近'
  },
};

type ActionMode = 'dismiss' | 'confirm' | 'merge' | null;

export default function DuplicateScanner() {
  const { 
    isLoading, 
    scanForDuplicates, 
    dismissPair,
    confirmAndDelete,
    mergeProjects,
    isDismissing,
    isConfirming,
    isMerging
  } = useDuplicateScanner();
  
  const { settings } = useDuplicateScannerSettings();

  const [hasScanned, setHasScanned] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  
  // Action state
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [selectedKeepProject, setSelectedKeepProject] = useState<string | null>(null);
  const [mergeDocuments, setMergeDocuments] = useState(true);
  const [mergeStatusHistory, setMergeStatusHistory] = useState(true);
  const [actionReason, setActionReason] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const isProcessing = isDismissing || isConfirming || isMerging;

  const handleScan = () => {
    const results = scanForDuplicates();
    setDuplicateGroups(results);
    setHasScanned(true);
  };

  const resetActionState = () => {
    setActionMode(null);
    setSelectedKeepProject(null);
    setMergeDocuments(true);
    setMergeStatusHistory(true);
    setActionReason('');
    setShowConfirmDialog(false);
  };

  const handleCloseDialog = () => {
    setSelectedGroup(null);
    resetActionState();
  };

  const handleDismiss = async () => {
    if (!selectedGroup) return;
    const projectIds = selectedGroup.projects.map(p => p.id);
    await dismissPair({ projectIds, reason: actionReason || undefined });
    const results = scanForDuplicates();
    setDuplicateGroups(results);
    handleCloseDialog();
  };

  const handleConfirmDelete = async () => {
    if (!selectedGroup || !selectedKeepProject) return;
    const deleteProject = selectedGroup.projects.find(p => p.id !== selectedKeepProject);
    if (!deleteProject) return;
    
    await confirmAndDelete({
      keepProjectId: selectedKeepProject,
      deleteProjectId: deleteProject.id,
      reason: actionReason || undefined,
    });
    const results = scanForDuplicates();
    setDuplicateGroups(results);
    handleCloseDialog();
  };

  const handleMerge = async () => {
    if (!selectedGroup || !selectedKeepProject) return;
    const mergeProject = selectedGroup.projects.find(p => p.id !== selectedKeepProject);
    if (!mergeProject) return;
    
    await mergeProjects({
      keepProjectId: selectedKeepProject,
      mergeProjectId: mergeProject.id,
      mergeDocuments,
      mergeStatusHistory,
      reason: actionReason || undefined,
    });
    const results = scanForDuplicates();
    setDuplicateGroups(results);
    handleCloseDialog();
  };

  const executeAction = () => {
    if (actionMode === 'dismiss') {
      handleDismiss();
    } else if (actionMode === 'confirm') {
      handleConfirmDelete();
    } else if (actionMode === 'merge') {
      handleMerge();
    }
  };

  const stats = useMemo(() => {
    const high = duplicateGroups.filter(g => g.confidenceLevel === 'high').length;
    const medium = duplicateGroups.filter(g => g.confidenceLevel === 'medium').length;
    const low = duplicateGroups.filter(g => g.confidenceLevel === 'low').length;
    return { high, medium, low, total: high + medium + low };
  }, [duplicateGroups]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">疑似重複案件掃描</h1>
          <p className="text-muted-foreground">
            掃描並比對可能重複的案場資料，協助資料治理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DuplicateScannerSettingsPanel onSettingsChange={() => {
            // Clear current results when settings change
            if (hasScanned) {
              setDuplicateGroups([]);
              setHasScanned(false);
            }
          }} />
          <Button onClick={handleScan} disabled={isLoading}>
            {hasScanned ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                重新掃描
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                開始掃描
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Card className="border-info/50 bg-info/5">
        <CardContent className="flex items-start gap-3 pt-4">
          <Info className="w-5 h-5 text-info mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-info">掃描說明</p>
            <p className="text-muted-foreground mt-1">
              系統會根據案場代碼、投資方、地址相似度≥80%、名稱相似度≥75%、同鄉鎮市區等條件比對疑似重複的案場。
              地址相似度與名稱相似度皆低於40%的配對將被排除。所有刪除操作皆為 Soft Delete，可於回收區復原。
            </p>
          </div>
        </CardContent>
      </Card>

      {hasScanned && (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">總計群組</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-destructive">高可信度</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats.high}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-600">中可信度</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{stats.medium}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">低可信度</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">{stats.low}</div>
              </CardContent>
            </Card>
          </div>

          {/* Duplicate Groups List */}
          {duplicateGroups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="w-12 h-12 text-success mb-4" />
                <h3 className="text-lg font-medium">未發現疑似重複資料</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  目前案場資料中沒有發現可能重複的項目
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>疑似重複群組列表</CardTitle>
                <CardDescription>
                  點擊群組查看詳細比對資訊並進行處理
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {duplicateGroups.map((group) => (
                      <div
                        key={group.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedGroup(group)}
                      >
                        <div className="flex items-center gap-4">
                          <Badge className={cn("px-2 py-1", confidenceLevelConfig[group.confidenceLevel].color)}>
                            {confidenceLevelConfig[group.confidenceLevel].label}
                          </Badge>
                          <div>
                            <div className="font-medium">
                              {group.projects.length} 個案場
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                              {group.matchedCriteria.slice(0, 3).map((c, i) => (
                                <span key={i} className="flex items-center gap-1">
                                  <Check className="w-3 h-3 text-success" />
                                  {c.name}
                                  {c.value && <span className="text-xs">({c.value})</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-muted-foreground">
                            {group.projects.slice(0, 2).map(p => p.project_code).join(', ')}
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!hasScanned && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileSearch className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">準備掃描</h3>
            <p className="text-muted-foreground text-sm mt-1 text-center max-w-md">
              點擊「開始掃描」按鈕，系統將分析所有案場資料並找出可能重複的項目
            </p>
          </CardContent>
        </Card>
      )}

      {/* Comparison Dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={() => handleCloseDialog()}>
        <DialogContent className="max-w-6xl max-h-[95vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              案場比對
              {selectedGroup && (
                <Badge className={cn("ml-2", confidenceLevelConfig[selectedGroup.confidenceLevel].color)}>
                  {confidenceLevelConfig[selectedGroup.confidenceLevel].label}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {confidenceLevelConfig[selectedGroup?.confidenceLevel || 'low'].description}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6">
              {/* Criteria Display */}
              {selectedGroup && (
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-success/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-success">
                        <Check className="w-4 h-4" />
                        命中條件
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {selectedGroup.matchedCriteria.map((c, i) => (
                          <div key={i} className="text-sm flex items-center justify-between">
                            <span>{c.name}</span>
                            {c.value && <span className="text-muted-foreground text-xs">{c.value}</span>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-muted">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                        <X className="w-4 h-4" />
                        未命中條件
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {selectedGroup.unmatchedCriteria.length > 0 ? (
                          selectedGroup.unmatchedCriteria.map((c, i) => (
                            <div key={i} className="text-sm flex items-center justify-between text-muted-foreground">
                              <span>{c.name}</span>
                              {c.value && <span className="text-xs">{c.value}</span>}
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">無</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Project Comparison Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">選擇保留</TableHead>
                    <TableHead>案場編號</TableHead>
                    <TableHead>案場名稱</TableHead>
                    <TableHead>投資方</TableHead>
                    <TableHead>地址</TableHead>
                    <TableHead className="text-right">容量</TableHead>
                    <TableHead>建檔時間</TableHead>
                    <TableHead className="text-right">文件數</TableHead>
                    <TableHead className="text-right">狀態數</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedGroup?.projects.map((project) => (
                    <TableRow 
                      key={project.id}
                      className={cn(
                        selectedKeepProject === project.id && "bg-success/10"
                      )}
                    >
                      <TableCell>
                        <RadioGroup 
                          value={selectedKeepProject || ''} 
                          onValueChange={setSelectedKeepProject}
                        >
                          <RadioGroupItem value={project.id} id={project.id} />
                        </RadioGroup>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {project.site_code_display || project.project_code}
                      </TableCell>
                      <TableCell className="font-medium">{project.project_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {project.investor_name || '-'}
                          {project.investor_code && (
                            <span className="text-muted-foreground ml-1">({project.investor_code})</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate block">{project.address || '-'}</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[300px]">
                            <p>{project.address || '無地址資料'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {project.capacity_kwp?.toFixed(2) || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(project.created_at), 'yyyy/MM/dd', { locale: zhTW })}
                      </TableCell>
                      <TableCell className="text-right">{project.document_count}</TableCell>
                      <TableCell className="text-right">{project.status_history_count}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => window.open(`/projects/${project.id}`, '_blank')}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>查看案場</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator />

              {/* Action Section */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  處理動作
                </h4>
                
                <div className="grid grid-cols-3 gap-3">
                  <Card 
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary",
                      actionMode === 'dismiss' && "border-primary bg-primary/5"
                    )}
                    onClick={() => setActionMode('dismiss')}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                        <span className="font-medium">標記不是重複</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        此組合不會再出現於掃描結果
                      </p>
                    </CardContent>
                  </Card>

                  <Card 
                    className={cn(
                      "cursor-pointer transition-all hover:border-destructive",
                      actionMode === 'confirm' && "border-destructive bg-destructive/5",
                      !selectedKeepProject && "opacity-50"
                    )}
                    onClick={() => selectedKeepProject && setActionMode('confirm')}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Trash2 className="w-5 h-5 text-destructive" />
                        <span className="font-medium">確認重複並刪除</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        保留選中案場，刪除另一案場（可復原）
                      </p>
                    </CardContent>
                  </Card>

                  <Card 
                    className={cn(
                      "cursor-pointer transition-all hover:border-info",
                      actionMode === 'merge' && "border-info bg-info/5",
                      !selectedKeepProject && "opacity-50"
                    )}
                    onClick={() => selectedKeepProject && setActionMode('merge')}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <GitMerge className="w-5 h-5 text-info" />
                        <span className="font-medium">合併案場</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        將文件與狀態歷史合併至選中案場
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Action Options */}
                {actionMode === 'merge' && (
                  <Card className="border-info/50">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="mergeDocuments" 
                          checked={mergeDocuments}
                          onCheckedChange={(checked) => setMergeDocuments(checked as boolean)}
                        />
                        <Label htmlFor="mergeDocuments">合併文件</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="mergeStatusHistory" 
                          checked={mergeStatusHistory}
                          onCheckedChange={(checked) => setMergeStatusHistory(checked as boolean)}
                        />
                        <Label htmlFor="mergeStatusHistory">合併狀態歷史</Label>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {actionMode && (
                  <div className="space-y-2">
                    <Label>備註（選填）</Label>
                    <Textarea 
                      placeholder="輸入處理原因或備註..."
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      rows={2}
                    />
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex gap-2 sm:gap-0">
            {actionMode && (
              <Button
                variant={actionMode === 'dismiss' ? 'outline' : actionMode === 'confirm' ? 'destructive' : 'default'}
                onClick={() => setShowConfirmDialog(true)}
                disabled={isProcessing || ((actionMode === 'confirm' || actionMode === 'merge') && !selectedKeepProject)}
              >
                {isProcessing ? '處理中...' : (
                  actionMode === 'dismiss' ? '確認標記不是重複' :
                  actionMode === 'confirm' ? '確認刪除' :
                  '確認合併'
                )}
              </Button>
            )}
            <Button variant="ghost" onClick={handleCloseDialog}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {actionMode === 'dismiss' && <XCircle className="w-5 h-5" />}
              {actionMode === 'confirm' && <AlertTriangle className="w-5 h-5 text-destructive" />}
              {actionMode === 'merge' && <GitMerge className="w-5 h-5 text-info" />}
              {actionMode === 'dismiss' && '確認標記為非重複？'}
              {actionMode === 'confirm' && '確認刪除案場？'}
              {actionMode === 'merge' && '確認合併案場？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionMode === 'dismiss' && (
                '標記後，此組合將不會再出現於未來的掃描結果中。'
              )}
              {actionMode === 'confirm' && selectedGroup && (
                <>
                  將保留案場 <strong>{selectedGroup.projects.find(p => p.id === selectedKeepProject)?.project_code}</strong>，
                  並刪除案場 <strong>{selectedGroup.projects.find(p => p.id !== selectedKeepProject)?.project_code}</strong>。
                  刪除的案場可在回收區中復原。
                </>
              )}
              {actionMode === 'merge' && selectedGroup && (
                <>
                  將案場 <strong>{selectedGroup.projects.find(p => p.id !== selectedKeepProject)?.project_code}</strong> 的
                  {mergeDocuments && '文件'}
                  {mergeDocuments && mergeStatusHistory && '、'}
                  {mergeStatusHistory && '狀態歷史'}
                  合併至 <strong>{selectedGroup.projects.find(p => p.id === selectedKeepProject)?.project_code}</strong>，
                  並刪除原案場。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>取消</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                actionMode === 'confirm' && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
              onClick={() => executeAction()}
              disabled={isProcessing}
            >
              {isProcessing ? '處理中...' : '確認'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
