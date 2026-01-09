/**
 * 上傳錯誤訊息轉譯器
 * 
 * 將技術性錯誤轉換為使用者友善的中文訊息
 * 永遠不會回傳 error.message 原文或技術錯誤碼
 */

export function formatUploadError(error: unknown): string {
  if (!error) {
    return '上傳時發生未知錯誤，請稍後重試。';
  }

  const err = error as Record<string, any>;
  const code = err?.code;
  const msg = (err?.message || '').toLowerCase();
  const hint = (err?.hint || '').toLowerCase();
  const details = (err?.details || '').toLowerCase();
  const fullText = `${msg} ${hint} ${details}`;

  // === Postgres / Supabase DB 錯誤碼 ===

  // 23505: unique_violation - 資料重複
  if (code === '23505') {
    if (fullText.includes('version')) {
      return '版本編號衝突，可能已存在相同版本。請重新整理頁面後再試。';
    }
    if (fullText.includes('is_current') || fullText.includes('current')) {
      return '同類文件的最新版本狀態衝突，請稍後重新上傳。';
    }
    return '資料重複，可能已存在相同版本或文件。請重新整理後再試。';
  }

  // 23514: check_violation - 欄位值不符合限制
  if (code === '23514') {
    if (fullText.includes('doc_type')) {
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

  if (fullText.includes('network') || fullText.includes('fetch') || fullText.includes('timeout')) {
    return '網路連線失敗，請檢查網路狀態後重試。';
  }

  if (fullText.includes('未登入') || fullText.includes('session') || fullText.includes('unauthorized') || fullText.includes('401')) {
    return '登入狀態已失效，請重新登入後再試。';
  }

  if (fullText.includes('forbidden') || fullText.includes('403')) {
    return '您沒有執行此操作的權限。';
  }

  // === Google Drive / Storage 錯誤 ===

  if (fullText.includes('drive') || fullText.includes('storage') || fullText.includes('upload')) {
    if (fullText.includes('quota') || fullText.includes('limit')) {
      return '雲端儲存空間不足，請聯繫管理員。';
    }
    if (fullText.includes('permission') || fullText.includes('access')) {
      return '雲端資料夾存取權限不足，請確認 Google Drive 設定。';
    }
    return '檔案上傳至雲端失敗，請檢查網路後重試。';
  }

  // === 應用程式層錯誤（中文錯誤訊息）===

  if (msg.includes('找不到案場')) {
    return '找不到指定的案場，請重新選擇。';
  }

  if (msg.includes('缺少必要欄位')) {
    return '請填寫案場與文件類型後再上傳。';
  }

  if (msg.includes('找不到') || msg.includes('不存在')) {
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
  console.error(prefix, error);
}
