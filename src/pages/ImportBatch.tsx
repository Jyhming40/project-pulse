import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOptionsForCategory } from '@/hooks/useSystemOptions';
import { useImportBatch, ImportFileItem } from '@/hooks/useImportBatch';
import { inferAgencyCodeFromDocTypeCode, DOC_TYPE_CODE_TO_SHORT, AGENCY_CODE_TO_LABEL, getDocTypeLabelByCode, type AgencyCode } from '@/lib/docTypeMapping';
import { GroupedDocTypeSelect } from '@/components/GroupedDocTypeSelect';
import { ImportSummaryDialog } from '@/components/ImportSummaryDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Upload,
  FileUp,
  Trash2,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Building2,
  Calendar,
  FolderUp,
  RefreshCw,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ImportBatch() {
  const { user } = useAuth();
  const { options: agencyCodeOptions } = useOptionsForCategory('agency');
  
  const {
    items,
    projects,
    isLoadingProjects,
    isUploading,
    loadProjects,
    addFiles,
    updateItem,
    batchUpdateItems,
    removeItem,
    clearItems,
    uploadAll,
  } = useImportBatch();
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDocTypeCode, setBatchDocTypeCode] = useState<string>('');
  const [batchAgencyCode, setBatchAgencyCode] = useState<string>('');
  const [batchProjectId, setBatchProjectId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [showSummary, setShowSummary] = useState(false);
  const prevIsUploading = useRef(false);
  
  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Show summary dialog when upload completes
  useEffect(() => {
    if (prevIsUploading.current && !isUploading) {
      // Upload just finished
      const hasCompleted = items.some(i => i.status === 'success' || i.status === 'error');
      if (hasCompleted) {
        setShowSummary(true);
      }
    }
    prevIsUploading.current = isUploading;
  }, [isUploading, items]);
  
  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      addFiles(files);
    }
  }, [addFiles]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      addFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [addFiles]);
  
  // Toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  
  // Select all
  const selectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  }, [items, selectedIds]);
  
  // Apply batch updates - updateItem already recalculates displayNamePreview
  const applyBatchDocTypeCode = useCallback(() => {
    if (!batchDocTypeCode) return;
    const ids = Array.from(selectedIds);
    const agencyCode = inferAgencyCodeFromDocTypeCode(batchDocTypeCode);
    ids.forEach(id => {
      updateItem(id, { 
        docTypeCode: batchDocTypeCode,
        agencyCode: agencyCode || undefined,
      });
    });
    setBatchDocTypeCode('');
  }, [batchDocTypeCode, selectedIds, updateItem]);
  
  const applyBatchAgencyCode = useCallback(() => {
    if (!batchAgencyCode) return;
    const ids = Array.from(selectedIds);
    ids.forEach(id => updateItem(id, { agencyCode: batchAgencyCode }));
    setBatchAgencyCode('');
  }, [batchAgencyCode, selectedIds, updateItem]);
  
  const applyBatchProject = useCallback(() => {
    if (!batchProjectId) return;
    const project = projects.find(p => p.id === batchProjectId);
    if (!project) return;
    const ids = Array.from(selectedIds);
    ids.forEach(id => updateItem(id, { 
      projectId: project.id,
      projectCode: project.project_code,
    }));
    setBatchProjectId('');
  }, [batchProjectId, selectedIds, projects, updateItem]);
  
  // Handle upload
  const handleUpload = useCallback(() => {
    if (!user?.id) return;
    uploadAll(user.id);
  }, [user, uploadAll]);
  
  // Stats
  const pendingCount = items.filter(i => i.status === 'pending').length;
  const readyCount = items.filter(i => i.status === 'ready').length;
  const successCount = items.filter(i => i.status === 'success').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const uploadingCount = items.filter(i => i.status === 'uploading').length;
  
  const progress = items.length > 0 
    ? ((successCount + errorCount) / items.filter(i => i.status !== 'pending').length) * 100 
    : 0;
  
  // Get status badge
  const getStatusBadge = (item: ImportFileItem) => {
    switch (item.status) {
      case 'pending':
        return <Badge variant="outline" className="text-muted-foreground"><Clock className="w-3 h-3 mr-1" />待確認</Badge>;
      case 'ready':
        return <Badge variant="secondary" className="text-primary"><Check className="w-3 h-3 mr-1" />可上傳</Badge>;
      case 'uploading':
        return <Badge className="bg-info text-info-foreground"><Loader2 className="w-3 h-3 mr-1 animate-spin" />上傳中</Badge>;
      case 'success':
        return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="w-3 h-3 mr-1" />成功</Badge>;
      case 'error':
        return (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="destructive"><X className="w-3 h-3 mr-1" />失敗</Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-medium mb-1">上傳失敗</p>
              <p className="text-sm">{item.error || '發生未知錯誤'}</p>
              <p className="text-xs text-muted-foreground mt-1">可移除此檔案後重新加入上傳</p>
            </TooltipContent>
          </Tooltip>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">批次匯入工作台</h1>
          <p className="text-muted-foreground mt-1">
            多檔選取 → 欄位確認 → 批次上傳
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <>
              <Button variant="outline" onClick={clearItems} disabled={isUploading}>
                <Trash2 className="w-4 h-4 mr-2" />
                清除全部
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={isUploading || readyCount === 0}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    上傳中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    上傳 {readyCount} 份檔案
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Stats Cards */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{items.length}</p>
                <p className="text-xs text-muted-foreground">總檔案</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">待確認</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{readyCount}</p>
                <p className="text-xs text-muted-foreground">可上傳</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{successCount}</p>
                <p className="text-xs text-muted-foreground">已完成</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <X className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{errorCount}</p>
                <p className="text-xs text-muted-foreground">失敗</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Progress Bar */}
      {isUploading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            正在上傳 {uploadingCount > 0 ? uploadingCount : successCount + errorCount}/{items.filter(i => i.status !== 'pending').length}...
          </p>
        </div>
      )}
      
      {/* Drop Zone */}
      <Card 
        ref={dropZoneRef}
        className={cn(
          "border-2 border-dashed transition-colors",
          items.length === 0 ? "py-16" : "py-8"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <CardContent className="flex flex-col items-center justify-center text-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          />
          <FolderUp className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            拖放檔案至此處或
          </h3>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="w-4 h-4 mr-2" />
            選擇檔案
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            支援 PDF、Word、Excel、圖片等格式，可一次選取多個檔案
          </p>
        </CardContent>
      </Card>
      
      {/* Batch Actions */}
      {selectedIds.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium">
                已選取 {selectedIds.size} 項，批次套用：
              </span>
              
              {/* Batch Project */}
              <div className="flex items-center gap-2">
                <Select value={batchProjectId} onValueChange={setBatchProjectId}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="選擇案場..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-mono text-xs">{p.project_code}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="secondary" onClick={applyBatchProject} disabled={!batchProjectId}>
                  套用
                </Button>
              </div>
              
              {/* Batch DocTypeCode */}
              <div className="flex items-center gap-2">
                <GroupedDocTypeSelect
                  value={batchDocTypeCode}
                  onValueChange={(code, agencyCode) => {
                    setBatchDocTypeCode(code);
                    // agencyCode will be applied when user clicks "套用"
                  }}
                  placeholder="選擇類型..."
                  className="w-[180px] h-9"
                />
                <Button size="sm" variant="secondary" onClick={applyBatchDocTypeCode} disabled={!batchDocTypeCode}>
                  套用
                </Button>
              </div>
              
              {/* Batch AgencyCode */}
              <div className="flex items-center gap-2">
                <Select value={batchAgencyCode} onValueChange={setBatchAgencyCode}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="選擇機關..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agencyCodeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="secondary" onClick={applyBatchAgencyCode} disabled={!batchAgencyCode}>
                  套用
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* File List Table */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">檔案清單</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="w-4 h-4" />
                <span>上傳新版本不會覆蓋舊文件，系統會自動建立新版本</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox 
                        checked={selectedIds.size === items.length && items.length > 0}
                        onCheckedChange={selectAll}
                      />
                    </TableHead>
                    <TableHead className="min-w-[200px]">原始檔名</TableHead>
                    <TableHead className="min-w-[150px]">案場</TableHead>
                    <TableHead className="min-w-[120px]">文件類型</TableHead>
                    <TableHead className="min-w-[100px]">機關</TableHead>
                    <TableHead className="w-[100px]">日期</TableHead>
                    <TableHead className="w-[60px]">版本</TableHead>
                    <TableHead className="min-w-[280px]">Display Name 預覽</TableHead>
                    <TableHead className="w-[90px]">狀態</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow 
                      key={item.id}
                      className={cn(
                        item.status === 'success' && 'bg-success/5',
                        item.status === 'error' && 'bg-destructive/5'
                      )}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          disabled={item.status === 'uploading' || item.status === 'success'}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate max-w-[180px]" title={item.originalName}>
                            {item.originalName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={item.projectId || ''} 
                          onValueChange={(val) => {
                            const project = projects.find(p => p.id === val);
                            updateItem(item.id, { 
                              projectId: val,
                              projectCode: project?.project_code || null,
                            });
                          }}
                          disabled={item.status === 'uploading' || item.status === 'success'}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="選擇..." />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                <span className="font-mono">{p.project_code}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <GroupedDocTypeSelect
                          value={item.docTypeCode || ''}
                          onValueChange={(code, agencyCode) => {
                            updateItem(item.id, { 
                              docTypeCode: code,
                              agencyCode: agencyCode || item.agencyCode,
                            });
                          }}
                          placeholder="選擇..."
                          disabled={item.status === 'uploading' || item.status === 'success'}
                          className="h-8 text-xs w-[140px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={item.agencyCode || ''} 
                          onValueChange={(val) => updateItem(item.id, { agencyCode: val })}
                          disabled={item.status === 'uploading' || item.status === 'success'}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="選擇..." />
                          </SelectTrigger>
                          <SelectContent>
                            {agencyCodeOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          value={item.dateStr || ''}
                          onChange={(e) => updateItem(item.id, { dateStr: e.target.value })}
                          placeholder="YYYYMMDD"
                          className="h-8 text-xs w-[90px] font-mono"
                          disabled={item.status === 'uploading' || item.status === 'success'}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-sm">v{item.suggestedVersion.toString().padStart(2, '0')}</span>
                          {item.existingDocId && (
                            <Tooltip>
                              <TooltipTrigger>
                                <RefreshCw className="w-3 h-3 text-info" />
                              </TooltipTrigger>
                              <TooltipContent>偵測到既有文件，將建立新版本</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded block truncate max-w-[260px]" title={item.displayNamePreview}>
                          {item.displayNamePreview}
                        </code>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeItem(item.id)}
                          disabled={item.status === 'uploading' || item.status === 'success'}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      
      {/* Empty State */}
      {items.length === 0 && !isLoadingProjects && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FolderUp className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">尚未選取任何檔案</h3>
            <p className="text-sm text-muted-foreground mb-4">
              拖放檔案至上方區域，或點擊「選擇檔案」按鈕
            </p>
          </CardContent>
        </Card>
      )}

      {/* Import Summary Dialog */}
      <ImportSummaryDialog
        open={showSummary}
        onOpenChange={setShowSummary}
        items={items}
        onClear={clearItems}
      />
    </div>
  );
}
