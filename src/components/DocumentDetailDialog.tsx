import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSoftDelete } from '@/hooks/useSoftDelete';
import { deleteDriveFile } from '@/hooks/useDriveSync';
import { useSyncAdminMilestones } from '@/hooks/useSyncAdminMilestones';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { useCodebookOptions } from '@/hooks/useCodebook';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  FileText,
  ExternalLink,
  Calendar,
  User,
  Clock,
  Building2,
  AlertCircle,
  CheckCircle2,
  File,
  Edit2,
  Save,
  X,
  ArrowLeftRight,
  Tag,
  Trash2,
  Cloud,
} from 'lucide-react';
import { getDerivedDocStatus, getDerivedDocStatusColor } from '@/lib/documentStatus';
import { DOC_TYPE_CODE_TO_SHORT, SHORT_TO_DOC_TYPE_CODE } from '@/lib/docTypeMapping';
import { toast } from 'sonner';
import { DocumentVersionCompare } from './DocumentVersionCompare';
import { DocumentTagSelector } from './DocumentTagSelector';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface DocumentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  onDeleted?: () => void;
}

export function DocumentDetailDialog({
  open,
  onOpenChange,
  documentId,
  onDeleted,
}: DocumentDetailDialogProps) {
  const { canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    doc_type: '',
    submitted_at: '',
    issued_at: '',
    due_at: '',
    note: '',
  });
  
  // Get doc_type_code options from system_options (single source of truth)
  const { options: docTypeOptions } = useCodebookOptions('doc_type_code');

  // Soft delete hook for documents
  const { softDelete, isDeleting } = useSoftDelete({
    tableName: 'documents',
    queryKey: ['project-documents-versioned', 'all-documents', 'project-documents', 'document-detail'],
    onSuccess: () => {
      onOpenChange(false);
      onDeleted?.();
    },
  });

  // Fetch document with all versions
  const { data: document, isLoading } = useQuery({
    queryKey: ['document-detail', documentId],
    queryFn: async () => {
      if (!documentId) return null;
      
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          projects(project_code, project_name),
          owner:profiles!documents_owner_user_id_fkey(full_name, email)
        `)
        .eq('id', documentId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!documentId,
  });

  // Fetch all versions of the same document (same project, doc_type, title)
  const { data: versions = [] } = useQuery({
    queryKey: ['document-versions', documentId],
    queryFn: async () => {
      if (!document) return [];
      
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          owner:profiles!documents_owner_user_id_fkey(full_name, email)
        `)
        .eq('project_id', document.project_id)
        .eq('doc_type', document.doc_type)
        .eq('is_deleted', false)
        .order('version', { ascending: false });
      
      if (error) throw error;
      
      // Filter by title if exists
      if (document.title) {
        return data.filter(d => d.title === document.title);
      }
      
      return data;
    },
    enabled: open && !!document,
  });

  // Fetch files for each version
  const { data: files = [] } = useQuery({
    queryKey: ['document-files', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      
      const versionIds = versions.map(v => v.id);
      if (versionIds.length === 0) versionIds.push(documentId);
      
      const { data, error } = await supabase
        .from('document_files')
        .select('*')
        .in('document_id', versionIds)
        .eq('is_deleted', false)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open && (versions.length > 0 || !!documentId),
  });

  // Sync admin milestones hook
  const syncMilestones = useSyncAdminMilestones();

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof editData) => {
      if (!documentId) throw new Error('No document ID');

      // Convert doc_type_code to short value for database storage
      const docTypeValue = data.doc_type 
        ? (DOC_TYPE_CODE_TO_SHORT[data.doc_type] || data.doc_type)
        : document?.doc_type || null;

      const updatePayload: Record<string, string | null> = {
        doc_type: docTypeValue,
        submitted_at: data.submitted_at || null,
        issued_at: data.issued_at || null,
        due_at: data.due_at || null,
        note: data.note || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('documents')
        .update(updatePayload)
        .eq('id', documentId);

      if (error) throw error;

      // Log audit
      await supabase.rpc('log_audit_action', {
        p_table_name: 'documents',
        p_record_id: documentId,
        p_action: 'UPDATE',
        p_old_data: {
          doc_type: document?.doc_type,
          submitted_at: document?.submitted_at,
          issued_at: document?.issued_at,
          due_at: document?.due_at,
          note: document?.note,
        },
        p_new_data: updatePayload,
        p_reason: '編輯文件資訊',
      });

      // Return project_id for milestone sync
      return document?.project_id;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ['document-detail', documentId] });
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
      queryClient.invalidateQueries({ queryKey: ['project-documents'] });
      queryClient.invalidateQueries({ queryKey: ['project-documents-versioned'] });
      toast.success('文件資訊已更新');
      setIsEditing(false);

      // Sync milestones based on updated document status (SSOT)
      if (projectId) {
        syncMilestones.mutate(projectId);
      }
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  const handleEdit = () => {
    // Convert doc_type short value back to code for the select
    const docTypeCode = document?.doc_type 
      ? (SHORT_TO_DOC_TYPE_CODE[document.doc_type] || document.doc_type)
      : '';
    
    setEditData({
      doc_type: docTypeCode,
      submitted_at: document?.submitted_at?.split('T')[0] || '',
      issued_at: document?.issued_at?.split('T')[0] || '',
      due_at: document?.due_at?.split('T')[0] || '',
      note: document?.note || '',
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(editData);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  if (!open) return null;

  const project = document?.projects as { project_code: string; project_name: string } | null;
  const owner = document?.owner as { full_name?: string; email?: string } | null;
  const derivedStatus = document ? getDerivedDocStatus(document) : '未開始';
  const statusColor = getDerivedDocStatusColor(derivedStatus);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                文件詳情
              </DialogTitle>
              {canEdit && !isEditing && document && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    編輯
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    刪除
                  </Button>
                </div>
              )}
            </div>
            <DialogDescription>
              查看文件完整資訊與歷史版本
            </DialogDescription>
          </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !document ? (
            <div className="text-center py-12 text-muted-foreground">
              找不到文件
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {document.title || document.doc_type}
                    </h3>
                    {project && (
                      <p className="text-sm text-muted-foreground mt-1">
                        <span className="font-mono">{project.project_code}</span>
                        {' '}• {project.project_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{document.doc_type}</Badge>
                    <Badge className={statusColor}>{derivedStatus}</Badge>
                  </div>
                </div>

                {/* Tags Section */}
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground shrink-0">標籤：</span>
                  <DocumentTagSelector documentId={documentId!} canEdit={canEdit} />
                </div>

                {isEditing ? (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    {/* Document Type */}
                    <div className="space-y-2">
                      <Label htmlFor="doc_type">文件類型</Label>
                      <Select 
                        value={editData.doc_type} 
                        onValueChange={(value) => setEditData(prev => ({ ...prev, doc_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選擇文件類型..." />
                        </SelectTrigger>
                        <SelectContent>
                          {docTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Date Fields */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="submitted_at">送件日</Label>
                        <Input
                          id="submitted_at"
                          type="date"
                          value={editData.submitted_at}
                          onChange={e =>
                            setEditData(prev => ({ ...prev, submitted_at: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="issued_at">核發日</Label>
                        <Input
                          id="issued_at"
                          type="date"
                          value={editData.issued_at}
                          onChange={e =>
                            setEditData(prev => ({ ...prev, issued_at: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="due_at">到期日</Label>
                        <Input
                          id="due_at"
                          type="date"
                          value={editData.due_at}
                          onChange={e =>
                            setEditData(prev => ({ ...prev, due_at: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="note">備註</Label>
                      <Textarea
                        id="note"
                        value={editData.note}
                        onChange={e =>
                          setEditData(prev => ({ ...prev, note: e.target.value }))
                        }
                        rows={3}
                        placeholder="輸入備註..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={handleCancel}>
                        <X className="w-4 h-4 mr-1" />
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={updateMutation.isPending}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        儲存
                      </Button>
                    </div>
                  </div>
                ) : (
                  document.note && (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      {document.note}
                    </p>
                  )
                )}
              </div>

              <Separator />

              {/* Key Dates */}
              {!isEditing && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      送件日
                    </p>
                    <p className="text-sm font-medium">
                      {document.submitted_at
                        ? format(new Date(document.submitted_at), 'yyyy/MM/dd')
                        : '-'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      核發日
                    </p>
                    <p className="text-sm font-medium">
                      {document.issued_at
                        ? format(new Date(document.issued_at), 'yyyy/MM/dd')
                        : '-'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      到期日
                    </p>
                    <p className="text-sm font-medium">
                      {document.due_at
                        ? format(new Date(document.due_at), 'yyyy/MM/dd')
                        : '-'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" />
                      負責人
                    </p>
                    <p className="text-sm font-medium">
                      {owner?.full_name || '-'}
                    </p>
                  </div>
                </div>
              )}

              {!isEditing && <Separator />}

              {/* Current Version & Drive Link */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-sm">
                    版本 {document.version || 1}
                  </Badge>
                  {document.is_current && (
                    <Badge variant="default" className="text-xs">
                      目前版本
                    </Badge>
                  )}
                </div>
                {document.drive_web_view_link && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(document.drive_web_view_link!, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    在 Drive 中開啟
                  </Button>
                )}
              </div>

              {/* Version History */}
              {versions.length > 1 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      版本歷史 ({versions.length} 個版本)
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCompareOpen(true)}
                    >
                      <ArrowLeftRight className="w-4 h-4 mr-2" />
                      版本比較
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>版本</TableHead>
                          <TableHead>上傳時間</TableHead>
                          <TableHead>上傳者</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {versions.map((v) => {
                          const vOwner = v.owner as { full_name?: string } | null;
                          const isCurrent = v.id === document.id;
                          
                          return (
                            <TableRow key={v.id} className={isCurrent ? 'bg-primary/5' : ''}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant={isCurrent ? 'default' : 'outline'}>
                                    v{v.version || 1}
                                  </Badge>
                                  {v.is_current && (
                                    <span className="text-xs text-muted-foreground">目前</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {v.created_at
                                  ? format(new Date(v.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {vOwner?.full_name || '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {v.drive_web_view_link && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(v.drive_web_view_link!, '_blank')}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Files */}
              {files.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <File className="w-4 h-4" />
                    附件檔案 ({files.length} 個)
                  </h4>
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{file.original_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {file.file_size
                                ? `${(file.file_size / 1024 / 1024).toFixed(2)} MB`
                                : '-'}
                              {' '}•{' '}
                              {file.uploaded_at
                                ? format(new Date(file.uploaded_at), 'yyyy/MM/dd HH:mm')
                                : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-muted-foreground pt-4 border-t">
                <div className="flex flex-wrap gap-4">
                  <span>
                    建立時間：{document.created_at
                      ? format(new Date(document.created_at), 'yyyy/MM/dd HH:mm')
                      : '-'}
                  </span>
                  <span>
                    最後更新：{document.updated_at
                      ? format(new Date(document.updated_at), 'yyyy/MM/dd HH:mm')
                      : '-'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Version Compare Dialog */}
        <DocumentVersionCompare
          open={isCompareOpen}
          onOpenChange={setIsCompareOpen}
          versions={versions}
        />
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <DeleteConfirmDialog
      open={isDeleteDialogOpen}
      onOpenChange={setIsDeleteDialogOpen}
      onConfirm={async (reason, shouldDeleteDrive) => {
        if (documentId) {
          // Delete from Drive first if requested
          if (shouldDeleteDrive && document?.drive_file_id) {
            const driveResult = await deleteDriveFile(documentId);
            if (driveResult.driveDeleted) {
              toast.success('雲端檔案已刪除');
            } else if (driveResult.message) {
              toast.warning('雲端檔案刪除失敗', { description: driveResult.message });
            }
          }
          // Then soft delete the document record
          await softDelete({ id: documentId, reason });
        }
      }}
      title="刪除文件"
      itemName={document?.title || document?.doc_type}
      tableName="documents"
      isPending={isDeleting}
      hasDriveFile={!!document?.drive_file_id}
    />
  </>
  );
}
