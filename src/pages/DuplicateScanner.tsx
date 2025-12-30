import { useState, useMemo } from 'react';
import { useDuplicateScanner, DuplicateGroup, ConfidenceLevel, ProjectForComparison } from '@/hooks/useDuplicateScanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
  Info
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
    description: '同投資方且地址或名稱相似'
  },
  low: { 
    label: '低可信度', 
    color: 'bg-muted text-muted-foreground',
    description: '同投資方、同區域、容量相近'
  },
};

export default function DuplicateScanner() {
  const { 
    isLoading, 
    scanForDuplicates, 
    markNotDuplicate, 
    softDeleteDuplicate,
    isMarkingNotDuplicate,
    isSoftDeleting
  } = useDuplicateScanner();

  const [hasScanned, setHasScanned] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<ProjectForComparison | null>(null);

  const handleScan = () => {
    const results = scanForDuplicates();
    setDuplicateGroups(results);
    setHasScanned(true);
  };

  const handleMarkNotDuplicate = async (group: DuplicateGroup) => {
    const projectIds = group.projects.map(p => p.id);
    await markNotDuplicate({ projectIds });
    // Rescan after marking
    const results = scanForDuplicates();
    setDuplicateGroups(results);
    setSelectedGroup(null);
  };

  const handleSoftDelete = async (project: ProjectForComparison) => {
    await softDeleteDuplicate(project.id);
    // Rescan after deletion
    const results = scanForDuplicates();
    setDuplicateGroups(results);
    setProjectToDelete(null);
    setSelectedGroup(null);
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

      {/* Info Alert */}
      <Card className="border-info/50 bg-info/5">
        <CardContent className="flex items-start gap-3 pt-4">
          <Info className="w-5 h-5 text-info mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-info">掃描說明</p>
            <p className="text-muted-foreground mt-1">
              系統會根據案場代碼、投資方、地址、名稱、容量等資訊比對疑似重複的案場。
              所有刪除操作皆為 Soft Delete，可於回收區復原。
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
                  點擊群組查看詳細比對資訊
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
                            <div className="text-sm text-muted-foreground">
                              {group.criteria.join('、')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-muted-foreground">
                            {group.projects.slice(0, 2).map(p => p.project_code).join(', ')}
                            {group.projects.length > 2 && ` +${group.projects.length - 2}`}
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
      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
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
              {selectedGroup && (
                <>
                  判斷依據：{selectedGroup.criteria.join('、')}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {confidenceLevelConfig[selectedGroup.confidenceLevel].description}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>案場編號</TableHead>
                  <TableHead>案場名稱</TableHead>
                  <TableHead>投資方</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead className="text-right">容量 (kWp)</TableHead>
                  <TableHead>建檔時間</TableHead>
                  <TableHead className="text-right">文件數</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedGroup?.projects.map((project) => (
                  <TableRow key={project.id}>
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
                    <TableCell className="max-w-[200px] truncate">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{project.address || '-'}</span>
                        </TooltipTrigger>
                        <TooltipContent>
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
                    <TableCell>
                      <div className="flex items-center gap-1">
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProjectToDelete(project);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>標記刪除（移至回收區）</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => selectedGroup && handleMarkNotDuplicate(selectedGroup)}
              disabled={isMarkingNotDuplicate}
            >
              <XCircle className="w-4 h-4 mr-2" />
              標記「不是重複」
            </Button>
            <Button variant="ghost" onClick={() => setSelectedGroup(null)}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              確認刪除此案場？
            </AlertDialogTitle>
            <AlertDialogDescription>
              {projectToDelete && (
                <>
                  您即將將案場 <strong>{projectToDelete.project_code}</strong> ({projectToDelete.project_name}) 
                  標記為重複資料並移至回收區。
                  <br /><br />
                  刪除原因將記錄為「重複資料清理」，您可以在回收區中復原此操作。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSoftDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => projectToDelete && handleSoftDelete(projectToDelete)}
              disabled={isSoftDeleting}
            >
              {isSoftDeleting ? '處理中...' : '確認刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
