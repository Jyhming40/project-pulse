import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSyncAdminMilestones } from '@/hooks/useSyncAdminMilestones';
import { useDocTypeLabel } from '@/hooks/useDocTypeLabel';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface DocumentForUpload {
  id: string;
  doc_type: string;
  title: string | null;
  version: number | null;
  projects?: {
    project_code: string;
    project_name: string;
    drive_folder_id?: string | null;
  };
}

interface BatchUploadVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocuments: DocumentForUpload[];
  onSuccess?: () => void;
}

interface UploadItem {
  documentId: string;
  file: File | null;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  newVersion?: number;
}

export function BatchUploadVersionDialog({
  open,
  onOpenChange,
  selectedDocuments,
  onSuccess,
}: BatchUploadVersionDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const syncMilestones = useSyncAdminMilestones();
  const { getLabel: getDocTypeLabel } = useDocTypeLabel();
  
  const [uploadItems, setUploadItems] = useState<Record<string, UploadItem>>(() =>
    Object.fromEntries(
      selectedDocuments.map(doc => [
        doc.id,
        { documentId: doc.id, file: null, status: 'pending' as const },
      ])
    )
  );
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (docId: string, file: File | null) => {
    setUploadItems(prev => ({
      ...prev,
      [docId]: { ...prev[docId], file, status: 'pending' },
    }));
  };

  const uploadSingleDocument = async (doc: DocumentForUpload, file: File) => {
    const project = doc.projects;
    if (!project?.drive_folder_id) {
      throw new Error('案場尚未設定 Drive 資料夾');
    }

    // Get project_id from the document
    const { data: docData, error: fetchError } = await supabase
      .from('documents')
      .select('project_id')
      .eq('id', doc.id)
      .single();

    if (fetchError || !docData) {
      throw new Error('找不到文件資料');
    }

    // Upload to Google Drive with correct parameters
    // The edge function handles versioning and document record creation
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', docData.project_id);
    formData.append('documentType', doc.doc_type);
    formData.append('title', doc.title || doc.doc_type);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('未登入');

    const uploadResponse = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-upload-file`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const errData = await uploadResponse.json().catch(() => ({}));
      throw new Error(errData.error || '上傳失敗');
    }

    const uploadResult = await uploadResponse.json();

    // Mark old document as not current
    await supabase
      .from('documents')
      .update({ is_current: false })
      .eq('id', doc.id);

    // Return both the new version and project_id for sync
    return {
      version: uploadResult.document?.version || (doc.version || 1) + 1,
      projectId: docData.project_id,
    };
  };

  const handleBatchUpload = async () => {
    const itemsToUpload = Object.entries(uploadItems).filter(
      ([_, item]) => item.file !== null
    );

    if (itemsToUpload.length === 0) {
      toast.error('請至少選擇一個檔案');
      return;
    }

    setIsUploading(true);
    
    // Track project IDs that were successfully uploaded to
    const successProjectIds = new Set<string>();

    for (const [docId, item] of itemsToUpload) {
      if (!item.file) continue;

      setUploadItems(prev => ({
        ...prev,
        [docId]: { ...prev[docId], status: 'uploading' },
      }));

      try {
        const doc = selectedDocuments.find(d => d.id === docId);
        if (!doc) throw new Error('找不到文件');

        const result = await uploadSingleDocument(doc, item.file);
        
        // Track the project ID for sync
        successProjectIds.add(result.projectId);
        
        setUploadItems(prev => ({
          ...prev,
          [docId]: { ...prev[docId], status: 'success', newVersion: result.version },
        }));
      } catch (error: any) {
        setUploadItems(prev => ({
          ...prev,
          [docId]: { ...prev[docId], status: 'error', error: error.message },
        }));
      }
    }

    setIsUploading(false);

    const successCount = Object.values(uploadItems).filter(
      item => item.status === 'success'
    ).length;

    if (successCount > 0) {
      toast.success(`成功上傳 ${successCount} 個新版本`);
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
      
      // Sync admin milestones for all affected projects (SSOT)
      for (const projectId of successProjectIds) {
        syncMilestones.mutate(projectId);
      }
      
      onSuccess?.();
    }
  };

  const uploadedCount = Object.values(uploadItems).filter(
    item => item.status === 'success'
  ).length;
  const totalWithFiles = Object.values(uploadItems).filter(
    item => item.file !== null
  ).length;
  const progress = totalWithFiles > 0 ? (uploadedCount / totalWithFiles) * 100 : 0;

  const handleClose = () => {
    if (!isUploading) {
      setUploadItems(
        Object.fromEntries(
          selectedDocuments.map(doc => [
            doc.id,
            { documentId: doc.id, file: null, status: 'pending' as const },
          ])
        )
      );
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            批次上傳新版本
          </DialogTitle>
          <DialogDescription>
            為選取的 {selectedDocuments.length} 份文件上傳新版本
          </DialogDescription>
        </DialogHeader>

        {isUploading && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              正在上傳 {uploadedCount}/{totalWithFiles}...
            </p>
          </div>
        )}

        <ScrollArea className="flex-1 pr-4 max-h-[400px]">
          <div className="space-y-3">
            {selectedDocuments.map(doc => {
              const item = uploadItems[doc.id];
              const project = doc.projects;

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {doc.title || getDocTypeLabel(null, doc.doc_type)}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        v{doc.version || 1}
                      </Badge>
                    </div>
                    {project && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {project.project_code} • {project.project_name}
                      </p>
                    )}
                    {item?.file && (
                      <p className="text-xs text-primary mt-1 truncate">
                        📎 {item.file.name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item?.status === 'success' ? (
                      <Badge className="bg-success text-success-foreground">
                        <Check className="w-3 h-3 mr-1" />
                        v{item.newVersion}
                      </Badge>
                    ) : item?.status === 'error' ? (
                      <Badge variant="destructive" className="max-w-[120px]">
                        <X className="w-3 h-3 mr-1 shrink-0" />
                        <span className="truncate">{item.error}</span>
                      </Badge>
                    ) : item?.status === 'uploading' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <>
                        <input
                          type="file"
                          ref={el => (fileInputRefs.current[doc.id] = el)}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                          onChange={e => {
                            const file = e.target.files?.[0] || null;
                            handleFileSelect(doc.id, file);
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRefs.current[doc.id]?.click()}
                          disabled={isUploading}
                        >
                          {item?.file ? '更換檔案' : '選擇檔案'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {selectedDocuments.some(d => !d.projects?.drive_folder_id) && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>部分案場尚未設定 Google Drive 資料夾，無法上傳檔案。</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            {uploadedCount > 0 ? '關閉' : '取消'}
          </Button>
          <Button
            onClick={handleBatchUpload}
            disabled={isUploading || totalWithFiles === 0}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                上傳中...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                上傳 {totalWithFiles} 個檔案
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
