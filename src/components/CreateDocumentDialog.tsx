import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDriveAuth } from '@/hooks/useDriveAuth';
import { useOptionsForCategory } from '@/hooks/useSystemOptions';
import { generateDocumentDisplayName } from '@/lib/documentAgency';
import { 
  docTypeCodeToEnum, 
  inferAgencyCodeFromDocTypeCode, 
  canAutoInferAgencyFromCode,
  AGENCY_CODE_TO_LABEL,
} from '@/lib/docTypeMapping';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  FileText,
  Calendar,
  Cloud,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string | null;
  onSuccess?: () => void;
}

export function CreateDocumentDialog({
  open,
  onOpenChange,
  defaultProjectId,
  onSuccess,
}: CreateDocumentDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAuthorized: isDriveAuthorized, authorize: authorizeDrive, isAuthorizing } = useDriveAuth();
  // Use doc_type_code as primary selection for governance
  const { options: docTypeCodeOptions } = useOptionsForCategory('doc_type_code');
  const { options: agencyCodeOptions } = useOptionsForCategory('agency');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state - use codes as primary selection value
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [docTypeCode, setDocTypeCode] = useState(''); // doc_type_code (e.g., 'TPC_REVIEW')
  const [agencyCode, setAgencyCode] = useState(''); // agency code (e.g., 'TPC')
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [submittedAt, setSubmittedAt] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Auto-infer agency when doc_type_code changes
  useEffect(() => {
    if (docTypeCode) {
      const inferredAgencyCode = inferAgencyCodeFromDocTypeCode(docTypeCode);
      if (inferredAgencyCode) {
        setAgencyCode(inferredAgencyCode);
      }
    }
  }, [docTypeCode]);
  
  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setProjectId(defaultProjectId || '');
      setDocTypeCode('');
      setAgencyCode('');
      setTitle('');
      setNote('');
      setSubmittedAt('');
      setIssuedAt('');
      setDueAt('');
      setSelectedFile(null);
      setUploadProgress(0);
    }
  }, [open, defaultProjectId]);
  
  // Fetch projects for selection
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-document-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_code, project_name')
        .eq('is_deleted', false)
        .order('project_code', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });
  
  // Get selected project info
  const selectedProject = projects.find(p => p.id === projectId);
  
  // Get agency label from code for display
  const getAgencyLabel = (code: string) => {
    const opt = agencyCodeOptions.find(o => o.value === code);
    return opt?.label || AGENCY_CODE_TO_LABEL[code] || code;
  };
  
  // Get doc_type label from code for display
  const getDocTypeLabel = (code: string) => {
    const opt = docTypeCodeOptions.find(o => o.value === code);
    return opt?.label || docTypeCodeToEnum(code);
  };
  
  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Extract extension for display name
    }
  };
  
  // Create document mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user || !projectId || !docTypeCode) {
        throw new Error('請填寫必要欄位');
      }
      
      // Convert doc_type_code to documents.doc_type enum value
      const docTypeEnum = docTypeCodeToEnum(docTypeCode);
      const docTypeLabel = getDocTypeLabel(docTypeCode);
      
      setIsUploading(true);
      setUploadProgress(10);
      
      try {
        // 1. Create document record (using enum value for legacy compatibility)
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .insert({
            project_id: projectId,
            doc_type: docTypeEnum, // Store enum value for legacy compatibility
            title: title || docTypeLabel,
            note,
            submitted_at: submittedAt || null,
            issued_at: issuedAt || null,
            due_at: dueAt || null,
            owner_user_id: user.id,
            created_by: user.id,
            version: 1,
            is_current: true,
          })
          .select()
          .single();
        
        if (docError) throw docError;
        
        setUploadProgress(30);
        
        // 2. If file selected and Drive authorized, upload to Drive
        if (selectedFile && isDriveAuthorized && selectedProject) {
          setUploadProgress(50);
          
          // Get file extension
          const ext = selectedFile.name.split('.').pop() || 'pdf';
          
          // Generate display name with agency label
          const agencyLabel = getAgencyLabel(agencyCode);
          const displayName = generateDocumentDisplayName({
            projectCode: selectedProject.project_code,
            agency: agencyLabel || '未指定',
            docType: docTypeLabel,
            date: new Date(),
            version: 1,
            status: issuedAt ? '已取得' : (submittedAt ? '已開始' : '未開始'),
            extension: ext,
          });
          
          // Upload to Google Drive via edge function
          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('projectId', projectId);
          formData.append('documentId', docData.id);
          formData.append('fileName', displayName);
          
          const session = await supabase.auth.getSession();
          
          const uploadResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-upload-file`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.data.session?.access_token}`,
              },
              body: formData,
            }
          );
          
          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            console.warn('Drive upload failed:', errorData);
            // Continue without file upload - don't fail the whole operation
          } else {
            const uploadResult = await uploadResponse.json();
            
            setUploadProgress(80);
            
            // Update document with Drive info
            if (uploadResult.fileId) {
              await supabase
                .from('documents')
                .update({
                  drive_file_id: uploadResult.fileId,
                  drive_web_view_link: uploadResult.webViewLink,
                  drive_path: uploadResult.path,
                })
                .eq('id', docData.id);
            }
            
            // Create document_files record
            await supabase
              .from('document_files')
              .insert({
                document_id: docData.id,
                original_name: selectedFile.name,
                storage_path: uploadResult.fileId || `drive://${selectedFile.name}`,
                file_size: selectedFile.size,
                mime_type: selectedFile.type,
                uploaded_by: user.id,
              });
          }
        }
        
        setUploadProgress(100);
        
        // Log audit
        await supabase.rpc('log_audit_action', {
          p_table_name: 'documents',
          p_record_id: docData.id,
          p_action: 'CREATE',
          p_old_data: null,
          p_new_data: { ...docData, doc_type_code: docTypeCode, agency_code: agencyCode },
          p_reason: `新增文件：${docTypeLabel}`,
        });
        
        return docData;
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
      queryClient.invalidateQueries({ queryKey: ['project-documents'] });
      toast.success('文件新增成功');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error('新增失敗', { description: error.message });
    },
  });
  
  const canSubmit = projectId && docTypeCode && !isUploading && !createMutation.isPending;
  const showAgencySelect = !canAutoInferAgencyFromCode(docTypeCode);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            新增文件
          </DialogTitle>
          <DialogDescription>
            建立新的文件記錄並上傳檔案
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-4">
            {/* Project Selection */}
            <div className="space-y-2">
              <Label htmlFor="project">
                案場 <span className="text-destructive">*</span>
              </Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇案場..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {p.project_code}
                      </span>
                      {p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Document Type Code */}
            <div className="space-y-2">
              <Label htmlFor="docTypeCode">
                文件類型 <span className="text-destructive">*</span>
              </Label>
              <Select value={docTypeCode} onValueChange={setDocTypeCode}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇類型..." />
                </SelectTrigger>
                <SelectContent>
                  {docTypeCodeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Agency - only show if cannot auto-infer */}
            {docTypeCode && (
              <div className="space-y-2">
                <Label htmlFor="agency">
                  發證機關
                  {!showAgencySelect && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      自動推斷
                    </Badge>
                  )}
                </Label>
                {showAgencySelect ? (
                  <Select value={agencyCode} onValueChange={setAgencyCode}>
                    <SelectTrigger>
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
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{getAgencyLabel(agencyCode)}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">文件標題（選填）</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={docTypeCode ? getDocTypeLabel(docTypeCode) : '輸入文件標題...'}
              />
              <p className="text-xs text-muted-foreground">
                留空將使用文件類型作為標題
              </p>
            </div>
            
            {/* Date Fields */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="submittedAt" className="text-xs flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  送件日
                </Label>
                <Input
                  id="submittedAt"
                  type="date"
                  value={submittedAt}
                  onChange={(e) => setSubmittedAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuedAt" className="text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  核發日
                </Label>
                <Input
                  id="issuedAt"
                  type="date"
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueAt" className="text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  到期日
                </Label>
                <Input
                  id="dueAt"
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </div>
            </div>
            
            {/* Status Info */}
            <Alert className="bg-muted/50">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                文件狀態由日期自動判斷：核發日有值 → 已取得；送件日有值 → 已開始；皆空 → 未開始
              </AlertDescription>
            </Alert>
            
            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">備註（選填）</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="輸入備註..."
                rows={2}
              />
            </div>
            
            {/* File Upload */}
            <div className="space-y-2">
              <Label>檔案上傳（選填）</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
                
                {!isDriveAuthorized ? (
                  <div className="space-y-3">
                    <Cloud className="w-8 h-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      需要連接 Google Drive 才能上傳檔案
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={authorizeDrive}
                      disabled={isAuthorizing}
                    >
                      {isAuthorizing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          連接中...
                        </>
                      ) : (
                        '連接 Google Drive'
                      )}
                    </Button>
                  </div>
                ) : selectedFile ? (
                  <div className="space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-primary" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      移除
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FileUp className="w-8 h-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      點擊選擇檔案或拖曳至此
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      選擇檔案
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>上傳中...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}
          </div>
        </ScrollArea>
        
        <DialogFooter className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading || createMutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
          >
            {(isUploading || createMutation.isPending) ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                建立中...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                建立文件
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
