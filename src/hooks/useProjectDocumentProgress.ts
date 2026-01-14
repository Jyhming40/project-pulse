import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDerivedDocStatus } from '@/lib/documentStatus';

interface ProjectDocProgress {
  projectId: string;
  obtainedCount: number;      // 已取得的不重複文件類型數
  requiredCount: number;      // 必要文件類型總數
  percentage: number;         // 完成百分比
}

/**
 * 計算每個案場的文件完成度
 * 公式：已取得的必要文件類型數 / 必要文件類型總數（is_required = true）
 */
export function useProjectDocumentProgress(projectIds: string[]) {
  return useQuery({
    queryKey: ['project-document-progress', projectIds],
    queryFn: async () => {
      if (!projectIds.length) return {};

      // 1. 取得所有「必要」的文件類型（is_required = true）
      const { data: requiredDocTypes, error: docTypeError } = await supabase
        .from('document_type_config' as any)
        .select('code, label')
        .eq('is_active', true)
        .eq('is_required', true);

      if (docTypeError) throw docTypeError;
      
      // 建立 code 和 label 的 Set，支援兩種格式比對
      const requiredCodes = new Set((requiredDocTypes || []).map((dt: any) => dt.code));
      const requiredLabels = new Set((requiredDocTypes || []).map((dt: any) => dt.label));
      const requiredCount = requiredCodes.size;

      // 2. 取得所有案場的文件資料，包含檔案數量
      const { data: documents, error: docError } = await supabase
        .from('documents')
        .select(`
          id,
          project_id,
          doc_type_code,
          doc_type,
          submitted_at,
          issued_at,
          drive_file_id,
          is_deleted
        `)
        .in('project_id', projectIds)
        .eq('is_deleted', false);

      if (docError) throw docError;

      // 3. 取得所有文件的檔案數量
      const documentIds = documents?.map(d => d.id) || [];
      let fileCountMap: Record<string, number> = {};
      
      if (documentIds.length > 0) {
        const { data: fileCounts, error: fileError } = await supabase
          .from('document_files')
          .select('document_id')
          .in('document_id', documentIds)
          .eq('is_deleted', false);

        if (!fileError && fileCounts) {
          // 計算每個文件的檔案數
          fileCounts.forEach(fc => {
            fileCountMap[fc.document_id] = (fileCountMap[fc.document_id] || 0) + 1;
          });
        }
      }

      // 4. 計算每個案場的完成度
      const progressMap: Record<string, ProjectDocProgress> = {};
      
      projectIds.forEach(projectId => {
        const projectDocs = documents?.filter(d => d.project_id === projectId) || [];
        
        // 使用 Set 記錄已取得的必要文件類型
        const obtainedDocTypes = new Set<string>();
        
        projectDocs.forEach(doc => {
          const docCode = doc.doc_type_code;
          const docLabel = doc.doc_type;
          
          // 檢查是否為必要文件（支援 code 或 label 兩種格式）
          const isRequiredDoc = (docCode && requiredCodes.has(docCode)) || 
                                (docLabel && requiredLabels.has(docLabel));
          if (!isRequiredDoc) return;
          
          const status = getDerivedDocStatus({
            submitted_at: doc.submitted_at,
            issued_at: doc.issued_at,
            file_count: fileCountMap[doc.id] || 0,
            drive_file_id: doc.drive_file_id,
          });
          
          if (status === '已取得') {
            // 使用 code 或 label 作為 key（優先用 code，以便去重）
            const key = docCode || docLabel;
            if (key) obtainedDocTypes.add(key);
          }
        });
        
        const obtainedCount = obtainedDocTypes.size;
        const percentage = requiredCount > 0 
          ? Math.round((obtainedCount / requiredCount) * 100) 
          : 0;
        
        progressMap[projectId] = {
          projectId,
          obtainedCount,
          requiredCount,
          percentage,
        };
      });

      return progressMap;
    },
    enabled: projectIds.length > 0,
    staleTime: 30 * 1000, // 30 秒內不重新請求
  });
}
