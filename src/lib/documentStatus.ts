/**
 * 文件狀態自動判斷邏輯
 * 
 * 狀態優先順序（由高到低）：
 * 1. 已取得 - issued_at（核發日）有日期
 * 2. 已取得 - 有上傳檔案（document_files 有記錄 或 drive_file_id 有值）
 * 3. 已開始 - issued_at 為空，且 submitted_at（送件日）有日期
 * 4. 未開始 - submitted_at 與 issued_at 皆為空，且無上傳檔案
 */

export type DerivedDocStatus = '已取得' | '已開始' | '未開始';

interface DocumentDates {
  submitted_at?: string | null;
  issued_at?: string | null;
  file_count?: number; // 上傳檔案數量（document_files）
  drive_file_id?: string | null; // Google Drive 檔案 ID
}

/**
 * 根據日期欄位與檔案上傳狀態推導文件狀態
 * @param doc 包含 submitted_at、issued_at、file_count 和 drive_file_id 的文件物件
 * @returns 推導出的狀態
 */
export function getDerivedDocStatus(doc: DocumentDates): DerivedDocStatus {
  // 優先順序 1: 已取得（核發日有日期）
  if (doc.issued_at) {
    return '已取得';
  }
  
  // 優先順序 2: 已取得（有上傳檔案 - document_files 或 Google Drive）
  if ((doc.file_count && doc.file_count > 0) || doc.drive_file_id) {
    return '已取得';
  }
  
  // 優先順序 3: 已開始（送件日有日期，但核發日為空且無檔案）
  if (doc.submitted_at) {
    return '已開始';
  }
  
  // 優先順序 4: 未開始（皆無）
  return '未開始';
}

/**
 * 取得推導狀態的顏色樣式
 * @param status 推導出的狀態
 * @returns CSS 類別名稱
 */
export function getDerivedDocStatusColor(status: DerivedDocStatus): string {
  const colorMap: Record<DerivedDocStatus, string> = {
    '未開始': 'bg-muted text-muted-foreground',
    '已開始': 'bg-info/15 text-info',
    '已取得': 'bg-success/15 text-success',
  };
  return colorMap[status] || 'bg-muted text-muted-foreground';
}

/**
 * 取得文件的推導狀態與顏色
 * @param doc 包含 submitted_at、issued_at 和 file_count 的文件物件
 * @returns 包含 status 和 colorClass 的物件
 */
export function getDocStatusInfo(doc: DocumentDates): {
  status: DerivedDocStatus;
  colorClass: string;
  tooltip: string;
} {
  const status = getDerivedDocStatus(doc);
  return {
    status,
    colorClass: getDerivedDocStatusColor(status),
    tooltip: '狀態由送件日 / 核發日 / 上傳檔案自動判斷',
  };
}
