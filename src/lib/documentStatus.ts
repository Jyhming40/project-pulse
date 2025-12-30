/**
 * 文件狀態自動判斷邏輯
 * 
 * 狀態優先順序（由高到低）：
 * 1. 已取得 - issued_at（核發日）有日期
 * 2. 已開始 - issued_at 為空，且 submitted_at（送件日）有日期
 * 3. 未開始 - submitted_at 與 issued_at 皆為空
 */

export type DerivedDocStatus = '已取得' | '已開始' | '未開始';

interface DocumentDates {
  submitted_at?: string | null;
  issued_at?: string | null;
}

/**
 * 根據日期欄位推導文件狀態
 * @param doc 包含 submitted_at 和 issued_at 的文件物件
 * @returns 推導出的狀態
 */
export function getDerivedDocStatus(doc: DocumentDates): DerivedDocStatus {
  // 優先順序 1: 已取得（核發日有日期）
  if (doc.issued_at) {
    return '已取得';
  }
  
  // 優先順序 2: 已開始（送件日有日期，但核發日為空）
  if (doc.submitted_at) {
    return '已開始';
  }
  
  // 優先順序 3: 未開始（兩者皆為空）
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
 * @param doc 包含 submitted_at 和 issued_at 的文件物件
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
    tooltip: '狀態由送件日 / 核發日自動判斷',
  };
}
