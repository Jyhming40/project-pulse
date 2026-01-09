import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptionsForCategory } from '@/hooks/useSystemOptions';
import { 
  DOC_TYPE_CODE_TO_SHORT, 
  getAgencyCodeByDocTypeCode,
  AGENCY_CODE_TO_LABEL,
  getDocTypeLabelByCode,
  type AgencyCode,
} from '@/lib/docTypeMapping';
import { generateDocumentDisplayName } from '@/lib/documentAgency';
import { GroupedDocTypeSelect } from '@/components/GroupedDocTypeSelect';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload,
  File,
  FolderOpen,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

// Default sub-folder template (must match edge function)
const DEFAULT_SUBFOLDER_TEMPLATE = [
  { code: 'RELATED', folder: '00-相關資料' },
  { code: 'SYSTEM_DIAGRAM', folder: '01-系統圖' },
  { code: 'TPC', folder: '02-台電' },
  { code: 'ENERGY_BUREAU', folder: '03-能源署' },
  { code: 'BUILDING_AUTH', folder: '04-建管單位' },
  { code: 'COMPLETION_MANUAL', folder: '05-完工手冊' },
  { code: 'SITE_PHOTO', folder: '06-現勘照片' },
  { code: 'CONSTRUCTION_PHOTO', folder: '07-施工照片' },
  { code: 'GREEN_PERMISSION', folder: '08-綠能容許' },
  { code: 'OFFICIAL_DOC', folder: '09-公文回函' },
  { code: 'HANDOVER', folder: '10-業務轉工程' },
];

// Doc type to subfolder mapping (supports both doc_type_code and short values)
const DOC_TYPE_TO_SUBFOLDER: Record<string, string> = {
  // doc_type_code keys
  'TPC_REVIEW': 'TPC',
  'TPC_CONTRACT': 'TPC',
  'TPC_METER': 'TPC',
  'MOEA_CONSENT': 'ENERGY_BUREAU',
  'MOEA_REGISTER': 'ENERGY_BUREAU',
  'STRUCT_CERT': 'RELATED',
  'LINE_COMP_NOTICE': 'TPC',
  'OTHER': 'RELATED',
  // Generic category codes (直接對應)
  'TPC': 'TPC',
  'ENERGY_BUREAU': 'ENERGY_BUREAU',
  'RELATED': 'RELATED',
  'BUILDING_AUTH': 'BUILDING_AUTH',
  'GREEN_PERMISSION': 'GREEN_PERMISSION',
  // Short value keys (for backwards compatibility)
  '台電審查意見書': 'TPC',
  '台電報竣掛表': 'TPC',
  '台電躉售合約': 'TPC',
  '台電正式躉售': 'TPC',
  '台電派員訪查併聯函': 'TPC',
  '能源署同意備案': 'ENERGY_BUREAU',
  '能源局同意備案': 'ENERGY_BUREAU',
  '能源署設備登記': 'ENERGY_BUREAU',
  '結構技師簽證': 'RELATED',
  '結構簽證': 'RELATED',
  '電機技師簽證': 'RELATED',
  '承裝業簽證': 'RELATED',
  '躉售合約': 'TPC',
  '報竣掛表': 'TPC',
  '設備登記': 'ENERGY_BUREAU',
  '同意備案': 'ENERGY_BUREAU',
  '線補費通知單': 'TPC',
  '免雜執照同意備案': 'BUILDING_AUTH',
  '免雜執照完竣': 'BUILDING_AUTH',
  '附屬綠能設施同意函': 'GREEN_PERMISSION',
  '最終掛表期限': 'TPC',
  // Generic short values
  '台電相關': 'TPC',
  '能源署相關': 'ENERGY_BUREAU',
  '其他相關文件': 'RELATED',
  '建管處相關': 'BUILDING_AUTH',
  '綠能設施': 'GREEN_PERMISSION',
  '其他': 'RELATED',
};

interface FileItem {
  id: string;
  file: File;
  documentType: string;
  agencyCode: string;  // Added agency code
  title: string;
  subfolderCode: string;
  subfolderName: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface BatchUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectCode: string;
  onSuccess?: () => void;
}

export function BatchUploadDialog({
  open,
  onOpenChange,
  projectId,
  projectCode,
  onSuccess,
}: BatchUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [driveSubfolders, setDriveSubfolders] = useState(DEFAULT_SUBFOLDER_TEMPLATE);

  const { options: docTypeOptions } = useOptionsForCategory('doc_type_code');

  // Get subfolder name from code
  const getSubfolderName = useCallback((code: string) => {
    const folder = driveSubfolders.find(sf => sf.code === code);
    return folder?.folder || '00-相關資料';
  }, [driveSubfolders]);

  // Get subfolder code from doc type (default to OFFICIAL_DOC)
  const getSubfolderCodeFromDocType = useCallback((docType: string): string => {
    return DOC_TYPE_TO_SUBFOLDER[docType] || 'OFFICIAL_DOC';
  }, []);

  // Generate unique ID
  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Generate standardized title based on encoding format
  const generateStandardTitle = useCallback((docTypeCode: string, agencyCode: string) => {
    const docTypeLabel = getDocTypeLabelByCode(docTypeCode) || docTypeCode;
    const agencyLabel = AGENCY_CODE_TO_LABEL[agencyCode as AgencyCode] || agencyCode;
    
    return generateDocumentDisplayName({
      projectCode,
      agency: agencyLabel,
      docType: docTypeLabel,
      date: new Date(),
      version: 1,
    }).replace(/\.[^/.]+$/, ''); // Remove extension for title
  }, [projectCode]);

  // Add files - always default to OFFICIAL_DOC subfolder
  const handleFilesSelected = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newItems: FileItem[] = Array.from(selectedFiles).map(file => {
      // Try to infer doc type from filename
      let inferredDocType = '';
      const lowerName = file.name.toLowerCase();
      for (const [docType] of Object.entries(DOC_TYPE_TO_SUBFOLDER)) {
        if (lowerName.includes(docType.toLowerCase()) || 
            lowerName.includes(docType.replace(/[^\u4e00-\u9fff]/g, '').toLowerCase())) {
          inferredDocType = docType;
          break;
        }
      }

      // If no inference, use first doc type or default
      if (!inferredDocType && docTypeOptions.length > 0) {
        inferredDocType = docTypeOptions[0].value;
      }

      // Always use OFFICIAL_DOC as default subfolder
      const subfolderCode = 'OFFICIAL_DOC';
      // Infer agency code from doc_type_code
      const agencyCode = getAgencyCodeByDocTypeCode(inferredDocType) || 'OTHER';

      // Generate standardized title
      const standardTitle = generateStandardTitle(inferredDocType, agencyCode);

      return {
        id: generateId(),
        file,
        documentType: inferredDocType,
        agencyCode,
        title: standardTitle,
        subfolderCode,
        subfolderName: getSubfolderName(subfolderCode),
        status: 'pending' as const,
      };
    });

    setFiles(prev => [...prev, ...newItems]);
  }, [docTypeOptions, getSubfolderName, generateStandardTitle]);

  // Update file item - do NOT auto-change subfolder when doc type changes
  const updateFileItem = useCallback((id: string, updates: Partial<FileItem>) => {
    setFiles(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, ...updates };
      
      // If doc type changed, update agency and regenerate title (but keep subfolder fixed)
      if (updates.documentType && updates.documentType !== item.documentType) {
        // Update agency code based on new doc type
        const inferredAgency = getAgencyCodeByDocTypeCode(updates.documentType);
        if (inferredAgency) {
          updated.agencyCode = inferredAgency;
        }
        // Regenerate standardized title
        updated.title = generateStandardTitle(updates.documentType, updated.agencyCode);
        // Do NOT change subfolder - keep it as user set or default (OFFICIAL_DOC)
      }
      
      // If manual subfolder change
      if (updates.subfolderCode && updates.subfolderCode !== item.subfolderCode) {
        updated.subfolderName = getSubfolderName(updates.subfolderCode);
      }
      
      return updated;
    }));
  }, [getSubfolderName, generateStandardTitle]);

  // Remove file
  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(item => item.id !== id));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Upload single file
  const uploadSingleFile = async (item: FileItem, accessToken: string): Promise<boolean> => {
    // Convert doc_type_code to short value for database storage
    const docTypeShort = DOC_TYPE_CODE_TO_SHORT[item.documentType] || item.documentType;
    
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('documentType', docTypeShort);
    formData.append('title', item.title);
    formData.append('file', item.file);
    // Pass the selected subfolder code to override default
    formData.append('subfolderCode', item.subfolderCode);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-upload-file`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '上傳失敗');
      }

      updateFileItem(item.id, { status: 'success' });
      return true;
    } catch (err) {
      updateFileItem(item.id, { 
        status: 'error', 
        error: (err as Error).message 
      });
      return false;
    }
  };

  // Upload all files
  const handleUploadAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) {
      toast.error('沒有待上傳的檔案');
      return;
    }

    // Validate all files have required fields
    const invalidFiles = pendingFiles.filter(f => !f.documentType || !f.title);
    if (invalidFiles.length > 0) {
      toast.error(`有 ${invalidFiles.length} 個檔案缺少必填欄位`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('請先登入');
      setIsUploading(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < pendingFiles.length; i++) {
      const item = pendingFiles[i];
      updateFileItem(item.id, { status: 'uploading' });

      const success = await uploadSingleFile(item, session.access_token);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }

      setUploadProgress(Math.round(((i + 1) / pendingFiles.length) * 100));
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`成功上傳 ${successCount} 個檔案`);
      onSuccess?.();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} 個檔案上傳失敗`);
    }

    // If all succeeded, close dialog
    if (errorCount === 0 && successCount > 0) {
      clearFiles();
      onOpenChange(false);
    }
  };

  // Status badge
  const getStatusBadge = (item: FileItem) => {
    switch (item.status) {
      case 'uploading':
        return (
          <Badge variant="secondary" className="bg-primary/15 text-primary">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            上傳中
          </Badge>
        );
      case 'success':
        return (
          <Badge variant="secondary" className="bg-success/15 text-success">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            完成
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" title={item.error}>
            <AlertCircle className="w-3 h-3 mr-1" />
            失敗
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">待上傳</Badge>
        );
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!isUploading) onOpenChange(open);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            批次上傳文件
          </DialogTitle>
          <DialogDescription>
            選擇多個檔案一次上傳，系統會根據文件類型自動分配儲存位置，您也可以手動調整
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* File input */}
          <div className="flex items-center gap-3">
            <Input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Plus className="w-4 h-4 mr-2" />
              選擇檔案
            </Button>
            {files.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFiles}
                disabled={isUploading}
              >
                清除全部
              </Button>
            )}
            <div className="flex-1" />
            <div className="text-sm text-muted-foreground">
              {files.length > 0 && (
                <>
                  共 {files.length} 個檔案
                  {successCount > 0 && <span className="text-success ml-2">✓ {successCount}</span>}
                  {errorCount > 0 && <span className="text-destructive ml-2">✗ {errorCount}</span>}
                </>
              )}
            </div>
          </div>

          {/* File list */}
          {files.length === 0 ? (
            <div 
              className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <File className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>點擊選擇檔案或拖曳檔案到此處</p>
              <p className="text-sm mt-2">支援一次選擇多個檔案</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">檔案名稱</TableHead>
                    <TableHead className="min-w-[150px]">文件類型</TableHead>
                    <TableHead className="min-w-[100px]">發證機關</TableHead>
                    <TableHead className="min-w-[150px]">標題</TableHead>
                    <TableHead className="min-w-[150px]">儲存位置</TableHead>
                    <TableHead className="w-[80px]">狀態</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <File className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <span className="truncate max-w-[150px]" title={item.file.name}>
                            {item.file.name}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </TableCell>
                      <TableCell>
                        <GroupedDocTypeSelect
                          value={item.documentType}
                          onValueChange={(code, agencyCode) => {
                            updateFileItem(item.id, { 
                              documentType: code, 
                              agencyCode: agencyCode 
                            });
                          }}
                          disabled={item.status !== 'pending'}
                          className="h-8 w-[160px]"
                          placeholder="選擇類型"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {AGENCY_CODE_TO_LABEL[item.agencyCode as AgencyCode] || item.agencyCode}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.title}
                          onChange={(e) => updateFileItem(item.id, { title: e.target.value })}
                          className="h-8"
                          disabled={item.status !== 'pending'}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.subfolderCode}
                          onValueChange={(value) => updateFileItem(item.id, { subfolderCode: value })}
                          disabled={item.status !== 'pending'}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {driveSubfolders.map(sf => (
                              <SelectItem key={sf.code} value={sf.code}>
                                <div className="flex items-center gap-2">
                                  <FolderOpen className="w-3 h-3" />
                                  {sf.folder}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item)}
                      </TableCell>
                      <TableCell>
                        {item.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => removeFile(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Upload progress */}
          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-sm text-center text-muted-foreground">
                正在上傳... {uploadProgress}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            {successCount > 0 && errorCount === 0 ? '完成' : '取消'}
          </Button>
          <Button
            onClick={handleUploadAll}
            disabled={pendingCount === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                上傳中
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                上傳 {pendingCount > 0 ? `(${pendingCount})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
