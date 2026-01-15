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
 * 同步取得規則：
 * 當某些文件取得時，可視為同步取得其他相關必要文件
 * key: 觸發文件的 code
 * value: 可同步視為取得的文件 codes
 */
const SYNC_OBTAINED_RULES: Record<string, string[]> = {
  // 取得「免雜項竣工」或「結構計算書」→ 視為取得「結構技師簽證」
  'BUILD_EXEMPT_COMP': ['ENG_STRUCTURAL'],
  // 結構計算書目前沒有專門 code，暫時用標籤方式處理
  
  // 取得「審訖圖」或「細部協商」→ 視為取得「電機技師簽證」、「承裝業簽證」
  'TPC_APPROVED_DRAWING': ['ENG_ELECTRICAL', 'ENG_CONTRACTOR'],
  'TPC_NEGOTIATION': ['ENG_ELECTRICAL', 'ENG_CONTRACTOR'],
  
  // 取得「正式躉售」→ 視為取得「設備登記」
  'TPC_FORMAL_FIT': ['MOEA_REGISTER'],
};

// 用標籤對應的同步規則（處理舊資料只有 label 沒有 code 的情況）
const SYNC_OBTAINED_RULES_BY_LABEL: Record<string, string[]> = {
  '免雜項竣工': ['ENG_STRUCTURAL'],
  '結構計算書': ['ENG_STRUCTURAL'],
  '審訖圖': ['ENG_ELECTRICAL', 'ENG_CONTRACTOR'],
  '細部協商': ['ENG_ELECTRICAL', 'ENG_CONTRACTOR'],
  '正式躉售': ['MOEA_REGISTER'],
};

/**
 * 計算每個案場的文件完成度
 * 公式：已取得的必要文件類型數 / 必要文件類型總數（is_required = true）
 */
export function useProjectDocumentProgress(projectIds: string[]) {
  return useQuery({
    queryKey: ['project-document-progress', projectIds.length > 0],
    queryFn: async () => {
      if (!projectIds.length) return {};

      // 1. 取得所有「必要」的文件類型（is_required = true）
      const { data: requiredDocTypes, error: docTypeError } = await supabase
        .from('document_type_config')
        .select('code, label')
        .eq('is_active', true)
        .eq('is_required', true);

      if (docTypeError) {
        console.error('Error fetching document_type_config:', docTypeError);
        throw docTypeError;
      }
      
      // 建立 code 和 label 的 Set 與 Map
      const requiredCodes = new Set((requiredDocTypes || []).map((dt: any) => dt.code));
      const labelToCodeMap = new Map<string, string>();
      (requiredDocTypes || []).forEach((dt: any) => {
        labelToCodeMap.set(dt.label, dt.code);
      });
      const requiredCount = requiredCodes.size;

      if (requiredCount === 0) {
        console.warn('No required document types found');
        return {};
      }

      // 2. 取得所有非刪除的文件資料 (不用 .in() 以避免 URL 過長問題)
      // 使用 projectIds Set 來做 client-side 過濾
      const projectIdSet = new Set(projectIds);
      
      const { data: allDocuments, error: docError } = await supabase
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
        .eq('is_deleted', false);

      if (docError) {
        console.error('Error fetching documents:', docError);
        throw docError;
      }

      // Client-side 過濾出需要的案場文件
      const documents = (allDocuments || []).filter(d => projectIdSet.has(d.project_id));

      // 3. 取得所有文件的檔案數量
      const documentIds = documents?.map(d => d.id) || [];
      let fileCountMap: Record<string, number> = {};
      
      if (documentIds.length > 0) {
        // 分批查詢以避免 URL 過長
        const batchSize = 100;
        for (let i = 0; i < documentIds.length; i += batchSize) {
          const batch = documentIds.slice(i, i + batchSize);
          const { data: fileCounts, error: fileError } = await supabase
            .from('document_files')
            .select('document_id')
            .in('document_id', batch)
            .eq('is_deleted', false);

          if (!fileError && fileCounts) {
            fileCounts.forEach(fc => {
              fileCountMap[fc.document_id] = (fileCountMap[fc.document_id] || 0) + 1;
            });
          }
        }
      }

      // 4. 計算每個案場的完成度
      const progressMap: Record<string, ProjectDocProgress> = {};
      
      projectIds.forEach(projectId => {
        const projectDocs = documents?.filter(d => d.project_id === projectId) || [];
        
        // 使用 Set 記錄已取得的必要文件類型（用 code）
        const obtainedDocCodes = new Set<string>();
        // 記錄所有已取得的文件（包含非必要），用於同步規則檢查
        const allObtainedCodes = new Set<string>();
        const allObtainedLabels = new Set<string>();
        
        projectDocs.forEach(doc => {
          const docCode = doc.doc_type_code;
          const docLabel = doc.doc_type;
          
          const status = getDerivedDocStatus({
            submitted_at: doc.submitted_at,
            issued_at: doc.issued_at,
            file_count: fileCountMap[doc.id] || 0,
            drive_file_id: doc.drive_file_id,
          });
          
          if (status === '已取得') {
            // 記錄已取得的文件（用於同步規則）
            if (docCode) allObtainedCodes.add(docCode);
            if (docLabel) allObtainedLabels.add(docLabel);
            
            // 檢查是否為必要文件（優先用 code 比對）
            if (docCode && requiredCodes.has(docCode)) {
              obtainedDocCodes.add(docCode);
            } else if (docLabel) {
              // 用 label 找對應的 code
              const matchedCode = labelToCodeMap.get(docLabel);
              if (matchedCode) {
                obtainedDocCodes.add(matchedCode);
              }
            }
          }
        });
        
        // 5. 套用同步取得規則
        // 檢查 code-based 規則
        allObtainedCodes.forEach(code => {
          const syncCodes = SYNC_OBTAINED_RULES[code];
          if (syncCodes) {
            syncCodes.forEach(syncCode => {
              if (requiredCodes.has(syncCode)) {
                obtainedDocCodes.add(syncCode);
              }
            });
          }
        });
        
        // 檢查 label-based 規則（處理舊資料）
        allObtainedLabels.forEach(label => {
          const syncCodes = SYNC_OBTAINED_RULES_BY_LABEL[label];
          if (syncCodes) {
            syncCodes.forEach(syncCode => {
              if (requiredCodes.has(syncCode)) {
                obtainedDocCodes.add(syncCode);
              }
            });
          }
        });
        
        const obtainedCount = obtainedDocCodes.size;
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
    staleTime: 60 * 1000, // 60 秒內不重新請求
  });
}
