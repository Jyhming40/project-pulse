import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDriveAuth } from '@/hooks/useDriveAuth';
import { deleteDriveFile } from '@/hooks/useDriveSync';
import { useSyncAdminMilestones } from '@/hooks/useSyncAdminMilestones';
import { useOptionsForCategory } from '@/hooks/useSystemOptions';
import { useDocTypeLabel } from '@/hooks/useDocTypeLabel';
import { getDerivedDocStatus, getDerivedDocStatusColor } from '@/lib/documentStatus';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { CreateDocumentDialog } from '@/components/CreateDocumentDialog';
import { DocumentDetailDialog } from '@/components/DocumentDetailDialog';
import { BatchActionBar, BatchActionIcons } from '@/components/BatchActionBar';
import { BatchDeleteDialog } from '@/components/BatchDeleteDialog';
import { BatchUploadDialog } from '@/components/BatchUploadDialog';
import { useBatchSelect } from '@/hooks/useBatchSelect';
import {
  FolderOpen,
  Upload,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileText,
  ChevronDown,
  ChevronRight,
  Clock,
  File,
  Plus,
  Trash2,
  Files,
  AlertTriangle,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';

interface ProjectDocumentsTabProps {
  projectId: string;
  project: {
    id: string;
    project_code: string;
    project_name: string;
    drive_folder_id?: string | null;
    drive_folder_url?: string | null;
    folder_status?: string | null;
    folder_error?: string | null;
    investor_id?: string | null;
  };
}

export function ProjectDocumentsTab({ projectId, project }: ProjectDocumentsTabProps) {
  const { canEdit, user } = useAuth();
  const { isAuthorized: isDriveAuthorized, isLoading: isDriveLoading, authorize: authorizeDrive, isAuthorizing } = useDriveAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncMilestones = useSyncAdminMilestones();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isBatchUploadOpen, setIsBatchUploadOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState<{
    documentType: string;
    title: string;
    file: File | null;
  }>({ documentType: '', title: '', file: null });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [singleDeleteDoc, setSingleDeleteDoc] = useState<{ id: string; title: string } | null>(null);
  const [isDriveIntegrationOpen, setIsDriveIntegrationOpen] = useState(false);
  const [isMissingDocsOpen, setIsMissingDocsOpen] = useState(true);

  // Use unified doc type options from useDocTypeLabel (document_type_config)
  const { getLabel: getDocTypeLabel, dropdownOptions: docTypeOptions, requiredDocTypes, isRequired: isDocTypeRequired, labelCodeMap } = useDocTypeLabel();

  // Extended document type with new columns
  type ExtendedDocument = {
    id: string;
    project_id: string;
    doc_type: string;
    doc_type_code?: string | null;
    doc_status: string;
    created_at: string;
    title?: string | null;
    version?: number | null;
    is_current?: boolean | null;
    drive_file_id?: string | null;
    drive_web_view_link?: string | null;
    drive_path?: string | null;
    drive_parent_folder_id?: string | null;
    owner?: { full_name?: string; email?: string } | null;
    [key: string]: unknown;
  };

  // Fetch documents with versioning
  const { data: documents = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ['project-documents-versioned', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*, owner:profiles!documents_owner_user_id_fkey(full_name, email)')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('doc_type', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ExtendedDocument[];
    },
    enabled: !!projectId,
  });

  // Batch selection for documents
  const docBatchSelect = useBatchSelect(documents);

  // Group documents by type and title
  const groupedDocuments = documents.reduce((acc, doc) => {
    const key = `${doc.doc_type}|${doc.title || doc.doc_type}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(doc);
    return acc;
  }, {} as Record<string, typeof documents>);

  // Get only current versions for main display
  const currentDocuments = documents.filter(doc => doc.is_current !== false);

  // Fetch file counts for each document to determine status
  const { data: documentFileCounts = [] } = useQuery({
    queryKey: ['project-document-file-counts', projectId],
    queryFn: async () => {
      const docIds = documents.map(d => d.id);
      if (docIds.length === 0) return [];
      const { data, error } = await supabase
        .from('document_files')
        .select('document_id')
        .in('document_id', docIds)
        .eq('is_deleted', false);
      if (error) throw error;
      return data || [];
    },
    enabled: documents.length > 0,
  });

  // Build file count map
  const fileCountMap = documentFileCounts.reduce((acc, fc) => {
    acc[fc.document_id] = (acc[fc.document_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Sync obtained rules - when certain documents are obtained, 
  // they can be considered as obtaining other related required documents
  const SYNC_OBTAINED_RULES: Record<string, string[]> = {
    'BUILD_EXEMPT_COMP': ['ENG_STRUCTURAL'],
    'TPC_APPROVED_DRAWING': ['ENG_ELECTRICAL', 'ENG_CONTRACTOR'],
    'TPC_NEGOTIATION': ['ENG_ELECTRICAL', 'ENG_CONTRACTOR'],
    'TPC_FORMAL_FIT': ['MOEA_REGISTER'],
  };
  const SYNC_OBTAINED_RULES_BY_LABEL: Record<string, string[]> = {
    '免雜項竣工': ['ENG_STRUCTURAL'],
    '結構計算書': ['ENG_STRUCTURAL'],
    '審訖圖': ['ENG_ELECTRICAL', 'ENG_CONTRACTOR'],
    '細部協商': ['ENG_ELECTRICAL', 'ENG_CONTRACTOR'],
    '正式躉售': ['MOEA_REGISTER'],
  };

  // Calculate missing required documents - only count as obtained if status is "已取得"
  // Support both doc_type_code and doc_type (label) for matching
  const allObtainedCodes = new Set<string>();
  const allObtainedLabels = new Set<string>();
  
  currentDocuments.forEach(doc => {
    // Check if document has a type code or label
    const hasTypeIdentifier = doc.doc_type_code || doc.doc_type;
    if (!hasTypeIdentifier) return;
    
    // Check status is "已取得"
    const status = getDerivedDocStatus({
      submitted_at: (doc as any).submitted_at,
      issued_at: (doc as any).issued_at,
      file_count: fileCountMap[doc.id] || 0,
      drive_file_id: doc.drive_file_id,
    });
    
    if (status === '已取得') {
      if (doc.doc_type_code) allObtainedCodes.add(doc.doc_type_code);
      if (doc.doc_type) allObtainedLabels.add(doc.doc_type);
    }
  });

  // Build obtained doc type codes with sync rules applied
  const obtainedDocTypeCodes = new Set<string>();
  
  // Direct matches
  allObtainedCodes.forEach(code => {
    obtainedDocTypeCodes.add(code);
  });
  allObtainedLabels.forEach(label => {
    const mappedCode = labelCodeMap.get(label);
    if (mappedCode) obtainedDocTypeCodes.add(mappedCode);
  });
  
  // Apply sync rules (code-based)
  allObtainedCodes.forEach(code => {
    const syncCodes = SYNC_OBTAINED_RULES[code];
    if (syncCodes) {
      syncCodes.forEach(syncCode => obtainedDocTypeCodes.add(syncCode));
    }
  });
  
  // Apply sync rules (label-based for old data)
  allObtainedLabels.forEach(label => {
    const syncCodes = SYNC_OBTAINED_RULES_BY_LABEL[label];
    if (syncCodes) {
      syncCodes.forEach(syncCode => obtainedDocTypeCodes.add(syncCode));
    }
  });
  
  const missingRequiredDocs = requiredDocTypes.filter(
    reqDoc => !obtainedDocTypeCodes.has(reqDoc.value)
  );
  
  // Calculate document completion percentage
  const totalRequired = requiredDocTypes.length;
  const obtainedRequired = totalRequired - missingRequiredDocs.length;
  const completionPercentage = totalRequired > 0 ? Math.round((obtainedRequired / totalRequired) * 100) : 0;

  // Create folder structure
  const handleCreateFolderStructure = async () => {
    if (!projectId || !user) return;
    
    if (!isDriveAuthorized) {
      try {
        await authorizeDrive();
      } catch (err) {
        toast.error('Google Drive 授權失敗');
      }
      return;
    }
    
    setIsCreatingFolder(true);
    try {
      const { data, error } = await supabase.functions.invoke('drive-ensure-folders', {
        body: { projectId },
      });
      
      if (error) throw new Error(error.message);
      
      if (data?.error === 'NEED_AUTH') {
        await authorizeDrive();
        return;
      }

      if (data?.error) {
        throw new Error(data.error);
      }
      
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Google Drive 資料夾結構已建立');
    } catch (err) {
      const error = err as Error;
      toast.error('建立資料夾失敗', { description: error.message });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.documentType || !uploadForm.title) {
      toast.error('請填寫所有必填欄位');
      return;
    }

    if (!isDriveAuthorized) {
      toast.error('請先授權 Google Drive');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('documentType', uploadForm.documentType);
      formData.append('title', uploadForm.title);
      formData.append('file', uploadForm.file);

      setUploadProgress(30);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('請先登入');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-upload-file`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      setUploadProgress(80);

      const result = await response.json();
      
      if (!response.ok) {
        if (result.error === 'NEED_AUTH') {
          await authorizeDrive();
          return;
        }
        throw new Error(result.error || '上傳失敗');
      }

      setUploadProgress(100);
      // Invalidate documents and progress-related queries
      queryClient.invalidateQueries({ queryKey: ['project-documents-versioned', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-drawer', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      // Sync admin milestones after document upload (SSOT)
      syncMilestones.mutate(projectId);
      
      toast.success(`文件上傳成功 (版本 ${result.document?.version || 1})`);
      setIsUploadOpen(false);
      setUploadForm({ documentType: '', title: '', file: null });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      const error = err as Error;
      toast.error('上傳失敗', { description: error.message });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Soft delete document(s)
  const softDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('documents')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id 
        })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documents-versioned', projectId] });
    },
  });

  const handleBatchDelete = async (reason?: string, deleteDriveFiles?: boolean) => {
    const selectedIds = Array.from(docBatchSelect.selectedIds);
    if (selectedIds.length === 0) return;
    
    setIsBatchDeleting(true);
    try {
      // Delete from Drive first if requested
      if (deleteDriveFiles) {
        const docsWithDrive = documents.filter(
          d => selectedIds.includes(d.id) && d.drive_file_id
        );
        const drivePromises = docsWithDrive.map(d => deleteDriveFile(d.id));
        const driveResults = await Promise.all(drivePromises);
        const successCount = driveResults.filter(r => r.driveDeleted).length;
        if (successCount > 0) {
          toast.success(`已刪除 ${successCount} 個雲端檔案`);
        }
      }

      // Soft delete in database
      await supabase
        .from('documents')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
          delete_reason: reason || null
        })
        .in('id', selectedIds);

      queryClient.invalidateQueries({ queryKey: ['project-documents-versioned', projectId] });
      toast.success(`已刪除 ${selectedIds.length} 筆文件`);
      docBatchSelect.deselectAll();
    } catch (err) {
      toast.error('刪除失敗', { description: (err as Error).message });
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleSingleDelete = async (reason?: string, deleteDriveFile_?: boolean) => {
    if (!singleDeleteDoc) return;
    try {
      // Delete from Drive first if requested
      const doc = documents.find(d => d.id === singleDeleteDoc.id);
      if (deleteDriveFile_ && doc?.drive_file_id) {
        const driveResult = await deleteDriveFile(singleDeleteDoc.id);
        if (driveResult.driveDeleted) {
          toast.success('已刪除雲端檔案');
        }
      }

      await supabase
        .from('documents')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
          delete_reason: reason || null
        })
        .eq('id', singleDeleteDoc.id);
      queryClient.invalidateQueries({ queryKey: ['project-documents-versioned', projectId] });
      toast.success('已刪除文件');
      setSingleDeleteDoc(null);
    } catch (err) {
      toast.error('刪除失敗', { description: (err as Error).message });
    }
  };

  const hasDriveFolder = !!project.drive_folder_id;
  const hasInvestor = !!project.investor_id;

  return (
    <div className="space-y-6">
      {/* Drive Connection Status - Collapsible */}
      <Card>
        <CardHeader 
          className="cursor-pointer select-none"
          onClick={() => setIsDriveIntegrationOpen(!isDriveIntegrationOpen)}
        >
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              Google Drive 整合
              {isDriveAuthorized && hasDriveFolder && (
                <Badge variant="secondary" className="bg-success/15 text-success ml-2">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  已連線
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              {isDriveIntegrationOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </CardTitle>
          {!isDriveIntegrationOpen && (
            <CardDescription className="text-xs">
              點擊展開查看連線狀態與資料夾設定
            </CardDescription>
          )}
        </CardHeader>
        {isDriveIntegrationOpen && (
          <CardContent className="space-y-4">
            {/* Drive Auth Status */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Drive 連線狀態：</span>
              {isDriveLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : isDriveAuthorized ? (
                <Badge variant="secondary" className="bg-success/15 text-success">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  已連線
                </Badge>
              ) : (
                <>
                  <Badge variant="secondary" className="bg-warning/15 text-warning">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    未連線
                  </Badge>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); authorizeDrive(); }} disabled={isAuthorizing}>
                    {isAuthorizing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                    授權 Google Drive
                  </Button>
                </>
              )}
            </div>

            {/* Folder Status */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground">資料夾狀態：</span>
              {hasDriveFolder ? (
                <>
                  <Badge variant="secondary" className="bg-success/15 text-success">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    已建立
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); window.open(project.drive_folder_url!, '_blank'); }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    開啟資料夾
                  </Button>
                </>
              ) : (
                <>
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    尚未建立
                  </Badge>
                  {!hasInvestor && (
                    <Alert className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        請先設定投資方，才能建立 Drive 資料夾結構
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </div>

            {/* Folder Error */}
            {project.folder_error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{project.folder_error}</AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            {canEdit && isDriveAuthorized && hasInvestor && (
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={(e) => { e.stopPropagation(); handleCreateFolderStructure(); }}
                  disabled={isCreatingFolder}
                  variant={hasDriveFolder ? "outline" : "default"}
                >
                  {isCreatingFolder ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FolderOpen className="w-4 h-4 mr-2" />
                  )}
                  {hasDriveFolder ? '重新檢查資料夾結構' : '建立案場資料夾結構'}
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Missing Required Documents Alert - Collapsible */}
      {hasDriveFolder && (
        <Collapsible open={isMissingDocsOpen} onOpenChange={setIsMissingDocsOpen}>
          <Card className={missingRequiredDocs.length > 0 ? "border-warning/50 bg-warning/5" : "border-success/50 bg-success/5"}>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-base flex items-center gap-2 ${missingRequiredDocs.length > 0 ? 'text-warning' : 'text-success'}`}>
                    {missingRequiredDocs.length > 0 ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    必要文件進度
                    <Badge variant="secondary" className={missingRequiredDocs.length > 0 ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}>
                      {completionPercentage}%
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {obtainedRequired}/{totalRequired} 項已取得
                    </span>
                    {isMissingDocsOpen ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <Progress 
                  value={completionPercentage} 
                  className={`h-2 mt-2 ${missingRequiredDocs.length > 0 ? '[&>div]:bg-warning' : '[&>div]:bg-success'}`}
                />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {missingRequiredDocs.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">
                      以下 {missingRequiredDocs.length} 項必要文件尚未取得：
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {missingRequiredDocs.map(doc => (
                        <Badge
                          key={doc.value}
                          variant="outline"
                          className="text-warning border-warning/50"
                        >
                          {doc.label}
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-success">
                    🎉 所有必要文件已取得完成！
                  </p>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Documents List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              文件清單
            </CardTitle>
            <CardDescription>
              顯示目前版本，可展開查看歷史版本。<Star className="w-3 h-3 inline mx-1 text-warning" />標記為必要文件
            </CardDescription>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsBatchUploadOpen(true)} disabled={!hasDriveFolder || !isDriveAuthorized}>
                <Files className="w-4 h-4 mr-2" />
                批次上傳
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsUploadOpen(true)} disabled={!hasDriveFolder || !isDriveAuthorized}>
                <Upload className="w-4 h-4 mr-2" />
                上傳檔案
              </Button>
              <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新增文件
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!hasDriveFolder ? (
            <p className="text-center py-8 text-muted-foreground">
              請先建立 Google Drive 資料夾結構，才能上傳文件
            </p>
          ) : isLoadingDocs ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : currentDocuments.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">暫無文件</p>
          ) : (
            <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  {canEdit && (
                    <TableHead className="w-10">
                      <Checkbox 
                        checked={docBatchSelect.isAllSelected}
                        onCheckedChange={() => docBatchSelect.toggleAll()}
                        aria-label="全選"
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="min-w-[120px]">文件類型</TableHead>
                  <TableHead className="min-w-[150px]">標題</TableHead>
                  <TableHead className="min-w-[100px]">版本</TableHead>
                  <TableHead className="min-w-[130px]">上傳時間</TableHead>
                  <TableHead className="min-w-[100px]">上傳者</TableHead>
                  <TableHead className="text-right min-w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedDocuments).map(([key, versions]) => {
                  const current = versions.find(v => v.is_current !== false) || versions[0];
                  const hasVersions = versions.length > 1;
                  const isExpanded = expandedDocs.has(key);
                  
                  return (
                    <React.Fragment key={key}>
                      <TableRow 
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => {
                          setSelectedDocumentId(current.id);
                          setIsDetailOpen(true);
                        }}
                      >
                        {canEdit && (
                          <TableCell className="w-10">
                            <Checkbox 
                              checked={docBatchSelect.isSelected(current.id)}
                              onCheckedChange={() => docBatchSelect.toggle(current.id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label="選取"
                            />
                          </TableCell>
                        )}
                        <TableCell className="w-10">
                          {hasVersions && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(key);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {isDocTypeRequired(current.doc_type_code, current.doc_type) && (
                              <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                            )}
                            <Badge variant="outline">{getDocTypeLabel(current.doc_type_code, current.doc_type)}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {current.title || '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="secondary">v{current.version || 1}</Badge>
                          {hasVersions && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({versions.length} 版本)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {current.created_at
                            ? format(new Date(current.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {(current.owner as { full_name?: string })?.full_name || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {current.drive_web_view_link && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(current.drive_web_view_link!, '_blank');
                                }}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSingleDeleteDoc({ id: current.id, title: current.title || getDocTypeLabel(current.doc_type_code, current.doc_type) });
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {hasVersions && isExpanded && versions.filter(v => v.id !== current.id).map(doc => (
                        <TableRow key={doc.id} className="bg-muted/30">
                          {canEdit && (
                            <TableCell className="w-10">
                              <Checkbox 
                                checked={docBatchSelect.isSelected(doc.id)}
                                onCheckedChange={() => docBatchSelect.toggle(doc.id)}
                                aria-label="選取舊版本"
                              />
                            </TableCell>
                          )}
                          <TableCell className="w-10"></TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {doc.title || '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="outline" className="text-muted-foreground">
                              v{doc.version || 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {doc.created_at
                              ? format(new Date(doc.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })
                              : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {(doc.owner as { full_name?: string })?.full_name || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {doc.drive_web_view_link && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(doc.drive_web_view_link!, '_blank')}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              )}
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setSingleDeleteDoc({ id: doc.id, title: `${doc.title || getDocTypeLabel(doc.doc_type_code, doc.doc_type)} v${doc.version || 1}` })}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上傳文件</DialogTitle>
            <DialogDescription>
              選擇文件類型並上傳檔案，系統會自動存放到對應的 Drive 子資料夾
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>文件類型 *</Label>
              <Select
                value={uploadForm.documentType}
                onValueChange={(value) => setUploadForm({ ...uploadForm, documentType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇文件類型" />
                </SelectTrigger>
                <SelectContent>
                  {docTypeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>文件標題 *</Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                placeholder="例如：台電審查意見書-第一次"
              />
              <p className="text-xs text-muted-foreground">
                同類型同標題的文件會自動建立版本
              </p>
            </div>
            <div className="space-y-2">
              <Label>選擇檔案 *</Label>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
              />
              {uploadForm.file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <File className="w-4 h-4" />
                  {uploadForm.file.name} ({(uploadForm.file.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>
            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-sm text-center text-muted-foreground">上傳中...</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadOpen(false)} disabled={isUploading}>
              取消
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadForm.file || !uploadForm.documentType || !uploadForm.title || isUploading}
            >
              {isUploading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              上傳
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Document Dialog */}
      <CreateDocumentDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        defaultProjectId={projectId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['project-documents-versioned', projectId] });
          queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
          queryClient.invalidateQueries({ queryKey: ['project-drawer', projectId] });
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }}
      />

      {/* Batch Upload Dialog */}
      <BatchUploadDialog
        open={isBatchUploadOpen}
        onOpenChange={setIsBatchUploadOpen}
        projectId={projectId}
        projectCode={project.project_code}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['project-documents-versioned', projectId] });
          queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
          queryClient.invalidateQueries({ queryKey: ['project-drawer', projectId] });
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }}
      />

      {/* Document Detail Dialog */}
      <DocumentDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        documentId={selectedDocumentId}
      />

      {/* Batch Delete Dialog */}
      <BatchDeleteDialog
        open={isBatchDeleteOpen}
        onOpenChange={setIsBatchDeleteOpen}
        selectedCount={docBatchSelect.selectedCount}
        itemLabel="份文件"
        onConfirm={handleBatchDelete}
        isLoading={isBatchDeleting}
        driveFileCount={documents.filter(d => docBatchSelect.selectedIds.has(d.id) && d.drive_file_id).length}
      />

      {/* Single Delete Dialog */}
      <DeleteConfirmDialog
        open={!!singleDeleteDoc}
        onOpenChange={(open) => !open && setSingleDeleteDoc(null)}
        onConfirm={handleSingleDelete}
        title="刪除文件"
        description="確定要刪除此文件嗎？"
        itemName={singleDeleteDoc?.title || ''}
        tableName="documents"
        hasDriveFile={!!documents.find(d => d.id === singleDeleteDoc?.id)?.drive_file_id}
      />

      {/* Batch Action Bar */}
      {canEdit && (
        <BatchActionBar
          selectedCount={docBatchSelect.selectedCount}
          actions={[
            {
              key: 'delete',
              label: '批次刪除',
              icon: BatchActionIcons.delete,
              variant: 'destructive',
              onClick: () => setIsBatchDeleteOpen(true),
            },
          ]}
          onClear={docBatchSelect.deselectAll}
        />
      )}
    </div>
  );
}
