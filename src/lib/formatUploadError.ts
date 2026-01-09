/**
 * 上傳錯誤訊息轉譯器
 * 
 * 將技術性錯誤轉換為使用者友善的中文訊息
 * 永遠不會回傳 error.message 原文或技術錯誤碼
 * 
 * === Constraint/Index Mapping 維護指南 ===
 * 
 * 當 DB 新增 unique constraint 或 index 時，請在對應的 MAP 中新增規則：
 * - DOCUMENTS_UNIQUE_MAP: documents 表專用（Import Batch 使用）
 * - GLOBAL_UNIQUE_MAP: 其他表（investors, projects 等）
 * 
 * 目前已知的 documents 表 unique indexes：
 * - documents_one_current_per_key: (project_id, doc_type) WHERE is_current=true
 * - documents_unique_version_per_key: (project_id, doc_type, version) WHERE is_deleted=false
 */

// === Private Helpers ===

/**
 * 從 Supabase/Postgres 錯誤物件中擷取 constraint/index 名稱
 * 
 * 支援格式：
 * - unique constraint "documents_one_current_per_key"
 * - unique constraint "public.documents_one_current_per_key"
 * - index "documents_unique_version_per_key"
 * - constraint "xxx" / index "xxx"
 * 
 * 若名稱帶 schema 前綴（如 public.xxx），只保留最後一段
 */
function extractConstraintName(err: Record<string, any>): string | null {
  // 1. 直接欄位（最可靠）
  if (err?.constraint && typeof err.constraint === 'string') {
    return normalizeConstraintName(err.constraint);
  }
  if (err?.constraint_name && typeof err.constraint_name === 'string') {
    return normalizeConstraintName(err.constraint_name);
  }
  
  // 2. 從 details 擷取
  const detailsName = extractFromText(err?.details);
  if (detailsName) return detailsName;
  
  // 3. 從 message 擷取（最後手段）
  const messageName = extractFromText(err?.message);
  if (messageName) return messageName;
  
  return null;
}

/**
 * 從文字中擷取 constraint/index 名稱
 * 支援多種 Postgres 錯誤格式
 */
function extractFromText(text: unknown): string | null {
  if (!text || typeof text !== 'string') return null;
  
  // 匹配常見格式：
  // - unique constraint "xxx"
  // - violates unique constraint "xxx"
  // - index "xxx"
  // - constraint "xxx"
  // 名稱可能帶 schema: "public.xxx" 或不帶: "xxx"
  const patterns = [
    /unique\s+constraint\s+["']([^"']+)["']/i,
    /violates\s+.*?constraint\s+["']([^"']+)["']/i,
    /index\s+["']([^"']+)["']/i,
    /constraint\s+["']([^"']+)["']/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return normalizeConstraintName(match[1]);
    }
  }
  
  return null;
}

/**
 * 標準化 constraint 名稱
 * - 移除 schema 前綴（public.xxx -> xxx）
 * - 轉小寫
 */
function normalizeConstraintName(name: string): string {
  const lower = name.toLowerCase().trim();
  // 若有 schema 前綴，取最後一段
  const parts = lower.split('.');
  return parts[parts.length - 1];
}

/**
 * 合併 message/hint/details 為可搜尋文本（供 fallback 用）
 */
function buildSearchText(err: Record<string, any>): string {
  const msg = (err?.message || '').toLowerCase();
  const hint = (err?.hint || '').toLowerCase();
  const details = (err?.details || '').toLowerCase();
  return `${msg} ${hint} ${details}`;
}

// === Constraint Mapping Tables ===

interface ConstraintRule {
  match: RegExp;
  message: string;
}

/**
 * Documents 表專用 unique constraint mapping
 * Import Batch 優先使用此 map，避免誤判其他表的錯誤
 */
const DOCUMENTS_UNIQUE_MAP: ConstraintRule[] = [
  // 同 project+doc_type 只能一筆 is_current=true
  {
    match: /^documents_one_current_per_key$/,
    message: '同類文件的最新版本狀態衝突，請稍後重新上傳。',
  },
  // 同 project+doc_type+version 不可重複
  {
    match: /^documents_unique_version_per_key$/,
    message: '版本編號衝突，可能已存在相同版本。請重新整理頁面後再試。',
  },
  // 寬鬆匹配（若 constraint 名稱略有變化）
  {
    match: /documents.*one.*current|one_current.*documents/i,
    message: '同類文件的最新版本狀態衝突，請稍後重新上傳。',
  },
  {
    match: /documents.*unique.*version|version.*unique.*documents/i,
    message: '版本編號衝突，可能已存在相同版本。請重新整理頁面後再試。',
  },
];

/**
 * 其他表的 unique constraint mapping
 * 用於非 Import Batch 情境
 */
const GLOBAL_UNIQUE_MAP: ConstraintRule[] = [
  // investors 表：investor_code 唯一（精準匹配實際 constraint 名稱）
  {
    match: /^investors_investor_code_key$/,
    message: '投資人代碼已存在，請使用不同的代碼。',
  },
  // projects 表：project_code 唯一（精準匹配實際 constraint 名稱）
  {
    match: /^projects_project_code_key$/,
    message: '案場代碼已存在，請使用不同的代碼。',
  },
];

/**
 * 23505 fallback 關鍵字對應（當無法取得 constraint 名稱時使用）
 * 僅用於 documents 相關情境
 */
const UNIQUE_FALLBACK_KEYWORDS: Array<{ keywords: string[]; message: string }> = [
  {
    keywords: ['version'],
    message: '版本編號衝突，可能已存在相同版本。請重新整理頁面後再試。',
  },
  {
    keywords: ['is_current', 'current'],
    message: '同類文件的最新版本狀態衝突，請稍後重新上傳。',
  },
];

// === Main Export ===

/**
 * 將技術性錯誤轉換為使用者友善的中文訊息
 * 絕對不會回傳 error.message 原文或技術錯誤碼
 * 
 * @param error - 原始錯誤物件
 * @param context - 可選，指定情境（如 'documents'）以使用專屬 mapping
 */
export function formatUploadError(error: unknown, context?: 'documents' | 'global'): string {
  if (!error) {
    return '上傳時發生未知錯誤，請稍後重試。';
  }

  const err = error as Record<string, any>;
  const code = err?.code;
  const searchText = buildSearchText(err);
  const constraintName = extractConstraintName(err);

  // === Postgres / Supabase DB 錯誤碼 ===

  // 23505: unique_violation - 資料重複
  if (code === '23505') {
    // 1. 優先使用 constraint 名稱匹配
    if (constraintName) {
      // 優先使用 documents map（Import Batch 專用）
      const docContext = context === 'global' ? false : true;
      
      if (docContext) {
        for (const rule of DOCUMENTS_UNIQUE_MAP) {
          if (rule.match.test(constraintName)) {
            return rule.message;
          }
        }
      }
      
      // 再嘗試 global map
      for (const rule of GLOBAL_UNIQUE_MAP) {
        if (rule.match.test(constraintName)) {
          return rule.message;
        }
      }
    }
    
    // 2. Fallback: 使用 searchText 關鍵字匹配（僅限 documents 情境）
    if (context !== 'global') {
      for (const rule of UNIQUE_FALLBACK_KEYWORDS) {
        if (rule.keywords.some(kw => searchText.includes(kw))) {
          return rule.message;
        }
      }
    }
    
    // 3. Generic unique violation
    return '資料重複，可能已存在相同版本或文件。請重新整理後再試。';
  }

  // 23514: check_violation - 欄位值不符合限制
  if (code === '23514') {
    if (searchText.includes('doc_type')) {
      return '文件類型不合法，請重新選擇正確的文件類型。';
    }
    return '資料格式不符合規定，請檢查填寫內容後重試。';
  }

  // 23503: foreign_key_violation - 關聯資料不存在
  if (code === '23503') {
    return '關聯資料不存在，請確認案場設定正確。';
  }

  // 23502: not_null_violation - 必填欄位缺失
  if (code === '23502') {
    return '缺少必要欄位，請確認案場與文件類型皆已填寫。';
  }

  // 42501: insufficient_privilege - 權限不足
  if (code === '42501') {
    return '您沒有執行此操作的權限，請聯繫管理員。';
  }

  // PGRST* - PostgREST 錯誤
  if (typeof code === 'string' && code.startsWith('PGRST')) {
    return '資料操作失敗，請稍後重試。';
  }

  // === 網路 / 連線 / 認證錯誤 ===

  if (searchText.includes('network') || searchText.includes('fetch') || searchText.includes('timeout')) {
    return '網路連線失敗，請檢查網路狀態後重試。';
  }

  if (searchText.includes('未登入') || searchText.includes('session') || searchText.includes('unauthorized') || searchText.includes('401')) {
    return '登入狀態已失效，請重新登入後再試。';
  }

  if (searchText.includes('forbidden') || searchText.includes('403')) {
    return '您沒有執行此操作的權限。';
  }

  // === Google Drive / Storage 錯誤 ===
  // 必須明確包含 'drive' 或 'storage'，避免單獨 'upload' 誤判

  const hasDriveOrStorage = searchText.includes('drive') || searchText.includes('storage');
  
  if (hasDriveOrStorage) {
    if (searchText.includes('quota') || searchText.includes('limit')) {
      return '雲端儲存空間不足，請聯繫管理員。';
    }
    if (searchText.includes('permission') || searchText.includes('access')) {
      return '雲端資料夾存取權限不足，請確認 Google Drive 設定。';
    }
    return '檔案上傳至雲端失敗，請檢查網路後重試。';
  }

  // === 應用程式層錯誤（中文錯誤訊息）===

  if (searchText.includes('找不到案場')) {
    return '找不到指定的案場，請重新選擇。';
  }

  if (searchText.includes('缺少必要欄位')) {
    return '請填寫案場與文件類型後再上傳。';
  }

  if (searchText.includes('找不到') || searchText.includes('不存在')) {
    return '找不到相關資料，請重新整理頁面後再試。';
  }

  // === 通用 fallback ===
  
  // 絕對不回傳原始 error.message
  return '上傳失敗，請稍後重試。若問題持續，請聯繫管理員。';
}

/**
 * 記錄技術錯誤（供工程師除錯）
 * 在 UI 顯示友善訊息的同時，保留原始錯誤供 console 查看
 */
export function logUploadError(error: unknown, context?: string): void {
  const prefix = context ? `[${context}]` : '[UploadError]';
  const err = error as Record<string, any>;
  const constraintName = extractConstraintName(err);
  
  // 輸出完整錯誤資訊供除錯
  console.error(prefix, {
    code: err?.code,
    constraint: constraintName,
    message: err?.message,
    details: err?.details,
    hint: err?.hint,
    raw: error,
  });
}
