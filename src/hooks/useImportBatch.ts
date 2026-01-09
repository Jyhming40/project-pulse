import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { 
  docTypeCodeToEnum, 
  inferAgencyCodeFromDocTypeCode,
  DOC_TYPE_CODE_TO_SHORT,
  AGENCY_CODE_TO_LABEL,
} from '@/lib/docTypeMapping';
import { generateDocumentDisplayName } from '@/lib/documentAgency';
import { formatUploadError, logUploadError } from '@/lib/formatUploadError';
import { toast } from 'sonner';

// === Types ===

export interface ImportFileItem {
  id: string;
  file: File;
  originalName: string;
  
  // Inferred fields (can be modified by user)
  projectId: string | null;
  projectCode: string | null;
  docTypeCode: string | null;
  agencyCode: string | null;
  dateStr: string | null; // YYYYMMDD format
  
  // Computed
  displayNamePreview: string;
  suggestedVersion: number;
  existingDocId: string | null; // If there's a matching existing doc
  
  // Status
  status: 'pending' | 'ready' | 'uploading' | 'success' | 'error';
  error?: string;
}

export interface ImportProject {
  id: string;
  project_code: string;
  project_name: string;
  drive_folder_id: string | null;
}

// === Inference Logic ===

const DOC_TYPE_KEYWORDS: Record<string, string[]> = {
  TPC_REVIEW: ['審查意見', '台電審查', '審查意見書'],
  TPC_CONTRACT: ['躉售', '躉售合約', '購售電契約'],
  TPC_METER: ['掛表', '報竣', '掛錶'],
  MOEA_CONSENT: ['同意備案', '備案'],
  MOEA_REGISTER: ['設備登記', '登記'],
  STRUCT_CERT: ['結構', '結構簽證', '結構技師'],
  LAND_CONTRACT: ['土地', '租約', '土地契約'],
};

export function inferDocTypeCodeFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  
  for (const [code, keywords] of Object.entries(DOC_TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return code;
      }
    }
  }
  
  return null;
}

export function parseDateFromFilename(filename: string): string | null {
  // Match YYYYMMDD pattern
  const match = filename.match(/(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
  if (match) {
    return match[0]; // Return YYYYMMDD
  }
  
  // Match YYYY-MM-DD pattern
  const dashMatch = filename.match(/(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/);
  if (dashMatch) {
    return dashMatch[0].replace(/-/g, '');
  }
  
  return null;
}

export function inferProjectCodeFromFilename(filename: string, projects: ImportProject[]): ImportProject | null {
  // Try to match project_code in filename
  for (const project of projects) {
    if (filename.includes(project.project_code)) {
      return project;
    }
  }
  return null;
}

// === Display Name Generator ===

export function generateDisplayNamePreview(params: {
  projectCode: string | null;
  docTypeCode: string | null;
  agencyCode: string | null;
  dateStr: string | null;
  version: number;
  extension: string;
}): string {
  const { projectCode, docTypeCode, agencyCode, dateStr, version, extension } = params;
  
  if (!projectCode || !docTypeCode) {
    return '(待確認必要欄位)';
  }
  
  const docTypeLabel = DOC_TYPE_CODE_TO_SHORT[docTypeCode] || '其他';
  const agencyLabel = agencyCode ? (AGENCY_CODE_TO_LABEL[agencyCode] || agencyCode) : '未指定';
  const dateFormatted = dateStr || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const versionStr = `v${version.toString().padStart(2, '0')}`;
  
  // Format: {ProjectCode}_{Agency}_{DocumentType}_{YYYYMMDD}_v{XX}.pdf
  return `${projectCode}_${agencyLabel}_${docTypeLabel}_${dateFormatted}_${versionStr}.${extension}`;
}

// === Main Hook ===

export function useImportBatch() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ImportFileItem[]>([]);
  const [projects, setProjects] = useState<ImportProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Load projects
  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_code, project_name, drive_folder_id')
        .eq('is_deleted', false)
        .order('project_code');
      
      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast.error('載入案場失敗', { description: error.message });
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);
  
  // Add files
  const addFiles = useCallback((files: File[]) => {
    const newItems: ImportFileItem[] = files.map(file => {
      const id = crypto.randomUUID();
      const ext = file.name.split('.').pop() || 'pdf';
      
      // Infer fields from filename
      const inferredDocTypeCode = inferDocTypeCodeFromFilename(file.name);
      const inferredAgencyCode = inferredDocTypeCode 
        ? inferAgencyCodeFromDocTypeCode(inferredDocTypeCode) 
        : null;
      const inferredDate = parseDateFromFilename(file.name);
      const inferredProject = inferProjectCodeFromFilename(file.name, projects);
      
      const item: ImportFileItem = {
        id,
        file,
        originalName: file.name,
        projectId: inferredProject?.id || null,
        projectCode: inferredProject?.project_code || null,
        docTypeCode: inferredDocTypeCode,
        agencyCode: inferredAgencyCode,
        dateStr: inferredDate,
        displayNamePreview: '',
        suggestedVersion: 1,
        existingDocId: null,
        status: 'pending',
      };
      
      // Calculate display name preview
      item.displayNamePreview = generateDisplayNamePreview({
        projectCode: item.projectCode,
        docTypeCode: item.docTypeCode,
        agencyCode: item.agencyCode,
        dateStr: item.dateStr,
        version: item.suggestedVersion,
        extension: ext,
      });
      
      return item;
    });
    
    setItems(prev => [...prev, ...newItems]);
    
    // Check for duplicates/versions for each item
    newItems.forEach(item => {
      if (item.projectId && item.docTypeCode) {
        checkExistingVersion(item.id, item.projectId, item.docTypeCode);
      }
    });
  }, [projects]);
  
  // Check for existing document with same project + doc_type_code
  const checkExistingVersion = useCallback(async (
    itemId: string,
    projectId: string,
    docTypeCode: string
  ) => {
    try {
      const docType = docTypeCodeToEnum(docTypeCode);
      
      const { data, error } = await supabase
        .from('documents')
        .select('id, version')
        .eq('project_id', projectId)
        .eq('doc_type', docType)
        .eq('is_deleted', false)
        .order('version', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const existingDoc = data[0];
        const newVersion = (existingDoc.version || 1) + 1;
        
        setItems(prev => prev.map(item => {
          if (item.id === itemId) {
            const ext = item.file.name.split('.').pop() || 'pdf';
            return {
              ...item,
              existingDocId: existingDoc.id,
              suggestedVersion: newVersion,
              displayNamePreview: generateDisplayNamePreview({
                projectCode: item.projectCode,
                docTypeCode: item.docTypeCode,
                agencyCode: item.agencyCode,
                dateStr: item.dateStr,
                version: newVersion,
                extension: ext,
              }),
            };
          }
          return item;
        }));
      }
    } catch (error) {
      console.error('Error checking existing version:', error);
    }
  }, []);
  
  // Update a single item
  const updateItem = useCallback((itemId: string, updates: Partial<ImportFileItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, ...updates };
        
        // Recalculate display name if relevant fields changed
        if ('projectCode' in updates || 'docTypeCode' in updates || 
            'agencyCode' in updates || 'dateStr' in updates || 'suggestedVersion' in updates) {
          const ext = item.file.name.split('.').pop() || 'pdf';
          updated.displayNamePreview = generateDisplayNamePreview({
            projectCode: updated.projectCode,
            docTypeCode: updated.docTypeCode,
            agencyCode: updated.agencyCode,
            dateStr: updated.dateStr,
            version: updated.suggestedVersion,
            extension: ext,
          });
        }
        
        // Update status
        if (updated.projectId && updated.docTypeCode) {
          updated.status = 'ready';
          
          // Check for existing version when project or docType changes
          if ('projectId' in updates || 'docTypeCode' in updates) {
            checkExistingVersion(itemId, updated.projectId!, updated.docTypeCode!);
          }
        } else {
          updated.status = 'pending';
        }
        
        return updated;
      }
      return item;
    }));
  }, [checkExistingVersion]);
  
  // Batch update selected items
  const batchUpdateItems = useCallback((itemIds: string[], updates: Partial<ImportFileItem>) => {
    itemIds.forEach(id => updateItem(id, updates));
  }, [updateItem]);
  
  // Remove item
  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);
  
  // Clear all items
  const clearItems = useCallback(() => {
    setItems([]);
  }, []);
  
  // Upload a single item with race-condition safety and three-stage write
  const uploadItem = useCallback(async (
    item: ImportFileItem,
    userId: string,
    retryCount: number = 0
  ): Promise<boolean> => {
    if (!item.projectId || !item.docTypeCode) {
      throw new Error('缺少必要欄位');
    }
    
    const project = projects.find(p => p.id === item.projectId);
    if (!project) {
      throw new Error('找不到案場');
    }
    
    // Get doc_type short value (enforced by DB constraint)
    const docType = docTypeCodeToEnum(item.docTypeCode);
    const ext = item.file.name.split('.').pop() || 'pdf';
    
    // 1. Upload to Google Drive if folder is configured (Drive failure doesn't block DB)
    let driveFileId: string | null = null;
    let driveWebViewLink: string | null = null;
    let drivePath: string | null = null;
    
    if (project.drive_folder_id) {
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('folderId', project.drive_folder_id);
      formData.append('fileName', item.displayNamePreview);
      
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
        console.warn('Drive upload failed:', errData);
        // Continue without Drive - don't fail the whole operation
      } else {
        const uploadResult = await uploadResponse.json();
        driveFileId = uploadResult.id || uploadResult.fileId || null;
        driveWebViewLink = uploadResult.webViewLink || null;
        drivePath = uploadResult.name || uploadResult.path || null;
      }
    }
    
    // 2. Three-stage DB safe sequence to avoid current=0 scenario
    let newDocId: string | null = null;
    
    try {
      // Stage 1: Get fresh max version (with error handling)
      const { data: versionData, error: versionError } = await supabase
        .from('documents')
        .select('version')
        .eq('project_id', item.projectId)
        .eq('doc_type', docType)
        .eq('is_deleted', false)
        .order('version', { ascending: false })
        .limit(1);
      
      if (versionError) throw versionError;
      
      const freshVersion = (versionData && versionData.length > 0 && versionData[0].version)
        ? versionData[0].version + 1
        : 1;
      
      // Stage 2: Insert new document with is_current=FALSE first (safe insert)
      const { data: docData, error: insertError } = await supabase
        .from('documents')
        .insert({
          project_id: item.projectId,
          doc_type: docType,
          doc_type_code: item.docTypeCode, // New field
          agency_code: item.agencyCode, // New field
          title: item.displayNamePreview.replace(`.${ext}`, ''),
          version: freshVersion,
          is_current: false, // Start with false to avoid constraint violation
          drive_file_id: driveFileId,
          drive_web_view_link: driveWebViewLink,
          drive_path: drivePath,
          owner_user_id: userId,
          created_by: userId,
        })
        .select()
        .single();
      
      if (insertError) {
        // Check for unique constraint violation (version duplicate)
        if (insertError.code === '23505' && retryCount < 2) {
          console.log(`Unique constraint violation (attempt ${retryCount + 1}), retrying...`);
          return await uploadItem(item, userId, retryCount + 1);
        }
        throw insertError;
      }
      
      newDocId = docData.id;
      
      // Stage 3a: Clear ALL existing is_current for this project+doc_type
      const { error: clearError } = await supabase
        .from('documents')
        .update({ is_current: false })
        .eq('project_id', item.projectId)
        .eq('doc_type', docType)
        .eq('is_current', true)
        .eq('is_deleted', false)
        .eq('is_archived', false);
      
      if (clearError) {
        // Rollback: mark the new doc as deleted (no delete_reason to avoid field issues)
        await supabase
          .from('documents')
          .update({ is_deleted: true })
          .eq('id', newDocId)
          .eq('is_deleted', false);
        throw clearError;
      }
      
      // Stage 3b: Set the new document as is_current=true (align with partial unique index conditions)
      const { error: setCurrentError } = await supabase
        .from('documents')
        .update({ is_current: true })
        .eq('id', newDocId)
        .eq('is_deleted', false)
        .eq('is_archived', false);
      
      if (setCurrentError) {
        // Rollback: mark the new doc as deleted (no delete_reason)
        await supabase
          .from('documents')
          .update({ is_deleted: true })
          .eq('id', newDocId)
          .eq('is_deleted', false);
        throw setCurrentError;
      }
      
      // 3. Create document_files record (with error handling)
      const { error: fileError } = await supabase.from('document_files').insert({
        document_id: newDocId,
        original_name: item.originalName,
        storage_path: driveFileId || `local://${item.displayNamePreview}`,
        file_size: item.file.size,
        mime_type: item.file.type,
        uploaded_by: userId,
      });
      
      if (fileError) {
        // Rollback: mark the new doc as deleted (no delete_reason)
        await supabase
          .from('documents')
          .update({ is_deleted: true })
          .eq('id', newDocId)
          .eq('is_deleted', false);
        throw fileError;
      }
      
      // 4. Log audit with consistent inserted version
      const insertedVersion = docData.version ?? freshVersion ?? 1;
      const { error: auditError } = await supabase.rpc('log_audit_action', {
        p_table_name: 'documents',
        p_record_id: newDocId,
        p_action: 'CREATE',
        p_old_data: null,
        p_new_data: { 
          doc_type_code: item.docTypeCode, 
          agency_code: item.agencyCode,
          version: insertedVersion,
          is_new_version: insertedVersion > 1,
        },
        p_reason: insertedVersion > 1 
          ? `批次匯入新版本 v${insertedVersion}` 
          : `批次匯入文件`,
      });
      
      if (auditError) {
        console.warn('Audit log failed (non-critical):', auditError);
        // Don't throw - audit failure shouldn't fail the upload
      }
      
      return true;
    } catch (error: any) {
      // If we created a doc but failed later, ensure it's marked deleted (no delete_reason)
      if (newDocId) {
        try {
          await supabase
            .from('documents')
            .update({ is_deleted: true })
            .eq('id', newDocId)
            .eq('is_deleted', false);
        } catch {
          // Ignore rollback errors
        }
      }
      
      // Check for unique constraint violation on retry
      if (error.code === '23505' && retryCount < 2) {
        console.log(`Unique constraint violation in catch (attempt ${retryCount + 1}), retrying...`);
        return await uploadItem(item, userId, retryCount + 1);
      }
      throw error;
    }
  }, [projects]);
  
  // Upload all ready items
  const uploadAll = useCallback(async (userId: string) => {
    const readyItems = items.filter(item => item.status === 'ready');
    
    if (readyItems.length === 0) {
      toast.error('沒有可上傳的檔案');
      return;
    }
    
    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const item of readyItems) {
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: 'uploading' } : i
      ));
      
      try {
        await uploadItem(item, userId);
        successCount++;
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, status: 'success' } : i
        ));
      } catch (error: any) {
        errorCount++;
        // Log original error for debugging (engineers only)
        logUploadError(error, 'ImportBatch');
        // Convert technical errors to user-friendly messages (use 'documents' context)
        const userMessage = formatUploadError(error, 'documents');
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, status: 'error', error: userMessage } : i
        ));
      }
    }
    
    setIsUploading(false);
    
    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
      toast.success(`成功上傳 ${successCount} 份文件`);
    }
    
    if (errorCount > 0) {
      toast.error(`${errorCount} 份文件上傳失敗`);
    }
  }, [items, uploadItem, queryClient]);
  
  return {
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
  };
}
