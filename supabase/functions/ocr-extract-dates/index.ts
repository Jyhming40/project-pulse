import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Common date patterns in Chinese government documents
const DATE_PATTERNS = [
  // ROC date format: 民國XXX年XX月XX日 or 中華民國XXX年XX月XX日
  /(?:中華)?民國\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g,
  // ROC date without 民國 prefix: XXX年XX月XX日 (2-3 digit year, assumed ROC)
  /(?<!西元)(?<!\d)(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g,
  // Western date: YYYY年MM月DD日
  /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g,
  // Western date: YYYY/MM/DD or YYYY-MM-DD
  /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,
  // ROC date: XXX/MM/DD (ROC year format)
  /(\d{2,3})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,
];

// ============================================================
// 文件類型特定的送件日關鍵字模式（優先級最高）
// ============================================================

// 設備登記函、免雜項竣工、免雜項申請：復台端 XXX年XX月XX日
const SUBMISSION_PATTERN_FUTAN = /復台端\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;

// 免雜項竣工、其他政府函：復貴公司 XXX年XX月XX日
const SUBMISSION_PATTERN_FUGUIGONGSI = /復貴公司\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;

// 審查意見書、台電函：依據貴公司 XXX年XX月XX日
const SUBMISSION_PATTERN_YIJUGUIGONGSI = /依據貴公司\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;

// 躉售合約、審查意見書：臺端於 XXX年XX月XX日 或 台端於 XXX年XX月XX日
const SUBMISSION_PATTERN_TAIDUAN = /[臺台]端於\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;

// 派員訪查併聯函：本處業於 XXX年XX月XX日
const SUBMISSION_PATTERN_BENCHU = /本處業於\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;

// 通用高優先送件日關鍵字
const SUBMISSION_PATTERN_APPLY_DATE = /申請日[期]?[：:]\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;

// 本府/本所/本局 XXX年XX月XX日 收件/收文
const SUBMISSION_PATTERN_RECEIPT = /(?:本府|本所|本局)\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(?:收文|收件)/;

// 核發日關鍵字模式
const ISSUE_PATTERN_OFFICIAL = /發文日期[：:]\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;

// 排除關鍵字 - 這些日期不應被作為送件日或核發日
const EXCLUDED_KEYWORDS = [
  '簽約日', '契約日', '合約日期',
  '施工日', '開工日', '完工日', '竣工日',
  '檢查日', '驗收日', '查驗日',
  '有效期限', '期限至', '届滿日',
];

// ============================================================
// 派員訪查併聯函特有的模式 - 提取「實際掛表日」
// ============================================================
// 併聯運轉日: XXX年XX月XX日 (派員訪查併聯函中的關鍵資訊)
const METER_DATE_PATTERN_BINGLIAN = /併聯(?:運轉)?日[期]?\s*[：:]\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;
// 本處業於 XXX年XX月XX日 派員訪查 (派員訪查併聯函)
const METER_DATE_PATTERN_FANGCHA = /本處業於\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(?:派員)?(?:訪查|查驗)/;

// ============================================================
// 審查意見書特有的模式 - 提取「PV編號」
// ============================================================
// PV編號格式：通常是 XXXXXXPVXXXX 格式
const PV_ID_PATTERN = /(?:本公司編號|PV編號|編號)[：:\s]*([A-Z0-9]{6,}PV[A-Z0-9]{4,})/i;
// 備用模式：直接匹配 PV 編號格式
const PV_ID_PATTERN_DIRECT = /\b(\d{6}PV\d{4})\b/;

interface ExtractedDate {
  type: 'submission' | 'issue' | 'meter_date' | 'unknown';
  date: string; // ISO format YYYY-MM-DD
  context: string; // surrounding text for reference
  confidence: number;
  source?: string; // 來源說明
}

interface ExtractedData {
  dates: ExtractedDate[];
  pvId?: string;
  pvIdContext?: string;
}

function rocToWestern(rocYear: number): number {
  return rocYear + 1911;
}

function parseDate(match: RegExpMatchArray, patternIndex: number): string | null {
  try {
    let year: number;
    let month: number;
    let day: number;

    if (patternIndex === 0) {
      // ROC date with 民國
      year = rocToWestern(parseInt(match[1]));
      month = parseInt(match[2]);
      day = parseInt(match[3]);
    } else if (patternIndex === 1) {
      // ROC date without 民國 prefix (e.g., 110年11月24日)
      const rawYear = parseInt(match[1]);
      // If year is 2-3 digits and less than 200, assume ROC year
      year = rawYear < 200 ? rocToWestern(rawYear) : rawYear;
      month = parseInt(match[2]);
      day = parseInt(match[3]);
    } else if (patternIndex === 2 || patternIndex === 3) {
      // Western date
      year = parseInt(match[1]);
      month = parseInt(match[2]);
      day = parseInt(match[3]);
    } else {
      // ROC date with slashes (assume if year < 200, it's ROC)
      const rawYear = parseInt(match[1]);
      year = rawYear < 200 ? rocToWestern(rawYear) : rawYear;
      month = parseInt(match[2]);
      day = parseInt(match[3]);
    }

    // Validate date
    if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  } catch {
    return null;
  }
}

// 從特定模式匹配中提取日期
function extractDateFromPatternMatch(match: RegExpMatchArray): string | null {
  const rawYear = parseInt(match[1]);
  const year = rawYear < 200 ? rocToWestern(rawYear) : rawYear;
  const month = parseInt(match[2]);
  const day = parseInt(match[3]);
  
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

// 檢查日期是否應被排除
function isExcludedDate(text: string, datePosition: number): boolean {
  const nearbyText = text.slice(Math.max(0, datePosition - 30), datePosition + 50);
  for (const keyword of EXCLUDED_KEYWORDS) {
    if (nearbyText.includes(keyword)) {
      console.log(`[OCR] Excluding date due to keyword: ${keyword}`);
      return true;
    }
  }
  return false;
}

// 從文字中提取 PV 編號
function extractPvId(text: string): { pvId: string; context: string } | null {
  // 首先嘗試帶有關鍵字的模式
  const keywordMatch = text.match(PV_ID_PATTERN);
  if (keywordMatch) {
    const idx = text.indexOf(keywordMatch[0]);
    const context = text.slice(Math.max(0, idx - 20), idx + keywordMatch[0].length + 20);
    console.log(`[OCR] Found PV ID via keyword: ${keywordMatch[1]}`);
    return { pvId: keywordMatch[1], context };
  }
  
  // 備用：直接匹配 PV 編號格式
  const directMatch = text.match(PV_ID_PATTERN_DIRECT);
  if (directMatch) {
    const idx = text.indexOf(directMatch[0]);
    const context = text.slice(Math.max(0, idx - 20), idx + directMatch[0].length + 20);
    console.log(`[OCR] Found PV ID via direct pattern: ${directMatch[1]}`);
    return { pvId: directMatch[1], context };
  }
  
  return null;
}

function extractDatesFromText(text: string, docTitle?: string): ExtractedData {
  const results: ExtractedDate[] = [];
  const processedDates = new Set<string>();
  let extractedPvId: { pvId: string; context: string } | null = null;
  
  console.log(`[OCR] Starting date extraction from ${text.length} chars of text`);
  console.log(`[OCR] Document title: ${docTitle || 'none'}`);
  
  // 檢查是否為派員訪查併聯函
  const isPaiyuanFangcha = docTitle?.includes('派員訪查') || 
                           docTitle?.includes('併聯') ||
                           text.includes('派員訪查') ||
                           text.includes('併聯運轉');
  
  // 檢查是否為審查意見書
  const isShenchaYijian = docTitle?.includes('審查意見書') ||
                          text.includes('審查意見書') ||
                          text.includes('再生能源發電設備');
  
  console.log(`[OCR] Document type detection: isPaiyuanFangcha=${isPaiyuanFangcha}, isShenchaYijian=${isShenchaYijian}`);

  // ============================================================
  // 優先級 1: 使用文件類型特定的模式提取（最高置信度）
  // ============================================================
  
  // 1a. 提取送件日 - 「復台端 XXX年XX月XX日」（設備登記函、免雜項竣工/申請）
  const futanMatch = text.match(SUBMISSION_PATTERN_FUTAN);
  if (futanMatch) {
    const date = extractDateFromPatternMatch(futanMatch);
    if (date && !processedDates.has(date + '_submission')) {
      const idx = text.indexOf(futanMatch[0]);
      if (!isExcludedDate(text, idx)) {
        processedDates.add(date + '_submission');
        results.push({
          type: 'submission',
          date,
          context: text.slice(Math.max(0, idx - 20), idx + futanMatch[0].length + 20).replace(/\s+/g, ' '),
          confidence: 0.98,
          source: '復台端',
        });
        console.log(`[OCR] Found submission date via 復台端: ${date}`);
      }
    }
  }
  
  // 1b. 提取送件日 - 「復貴公司 XXX年XX月XX日」（免雜項竣工、政府函）
  const fuguigongsiMatch = text.match(SUBMISSION_PATTERN_FUGUIGONGSI);
  if (fuguigongsiMatch) {
    const date = extractDateFromPatternMatch(fuguigongsiMatch);
    if (date && !processedDates.has(date + '_submission')) {
      const idx = text.indexOf(fuguigongsiMatch[0]);
      if (!isExcludedDate(text, idx)) {
        processedDates.add(date + '_submission');
        results.push({
          type: 'submission',
          date,
          context: text.slice(Math.max(0, idx - 20), idx + fuguigongsiMatch[0].length + 20).replace(/\s+/g, ' '),
          confidence: 0.98,
          source: '復貴公司',
        });
        console.log(`[OCR] Found submission date via 復貴公司: ${date}`);
      }
    }
  }
  
  // 1c. 提取送件日 - 「依據貴公司 XXX年XX月XX日」（審查意見書、台電函）
  const yijuguigongsiMatch = text.match(SUBMISSION_PATTERN_YIJUGUIGONGSI);
  if (yijuguigongsiMatch) {
    const date = extractDateFromPatternMatch(yijuguigongsiMatch);
    if (date && !processedDates.has(date + '_submission')) {
      const idx = text.indexOf(yijuguigongsiMatch[0]);
      if (!isExcludedDate(text, idx)) {
        processedDates.add(date + '_submission');
        results.push({
          type: 'submission',
          date,
          context: text.slice(Math.max(0, idx - 20), idx + yijuguigongsiMatch[0].length + 20).replace(/\s+/g, ' '),
          confidence: 0.98,
          source: '依據貴公司',
        });
        console.log(`[OCR] Found submission date via 依據貴公司: ${date}`);
      }
    }
  }
  
  // 1d. 提取送件日 - 「臺端於/台端於 XXX年XX月XX日」（躉售合約、審查意見書）
  const taiduanMatch = text.match(SUBMISSION_PATTERN_TAIDUAN);
  if (taiduanMatch) {
    const date = extractDateFromPatternMatch(taiduanMatch);
    if (date && !processedDates.has(date + '_submission')) {
      const idx = text.indexOf(taiduanMatch[0]);
      if (!isExcludedDate(text, idx)) {
        processedDates.add(date + '_submission');
        results.push({
          type: 'submission',
          date,
          context: text.slice(Math.max(0, idx - 20), idx + taiduanMatch[0].length + 20).replace(/\s+/g, ' '),
          confidence: 0.98,
          source: '臺端於',
        });
        console.log(`[OCR] Found submission date via 臺端於: ${date}`);
      }
    }
  }
  
  // 1e. 提取送件日/掛表日 - 「本處業於 XXX年XX月XX日」（派員訪查併聯函）
  const benchuMatch = text.match(SUBMISSION_PATTERN_BENCHU);
  if (benchuMatch) {
    const date = extractDateFromPatternMatch(benchuMatch);
    if (date && !processedDates.has(date + '_submission')) {
      const idx = text.indexOf(benchuMatch[0]);
      if (!isExcludedDate(text, idx)) {
        processedDates.add(date + '_submission');
        results.push({
          type: 'submission',
          date,
          context: text.slice(Math.max(0, idx - 20), idx + benchuMatch[0].length + 20).replace(/\s+/g, ' '),
          confidence: 0.98,
          source: '本處業於（送件日/實際掛表日）',
        });
        console.log(`[OCR] Found submission date via 本處業於: ${date}`);
      }
    }
  }
  
  // 1f. 提取送件日 - 「申請日: XXX年XX月XX日」
  const applyMatch = text.match(SUBMISSION_PATTERN_APPLY_DATE);
  if (applyMatch) {
    const date = extractDateFromPatternMatch(applyMatch);
    if (date && !processedDates.has(date + '_submission')) {
      const idx = text.indexOf(applyMatch[0]);
      if (!isExcludedDate(text, idx)) {
        processedDates.add(date + '_submission');
        results.push({
          type: 'submission',
          date,
          context: text.slice(Math.max(0, idx - 20), idx + applyMatch[0].length + 20).replace(/\s+/g, ' '),
          confidence: 0.98,
          source: '申請日',
        });
        console.log(`[OCR] Found submission date via 申請日: ${date}`);
      }
    }
  }
  
  // 1g. 提取送件日 - 「本府 XXX年XX月XX日 收文/收件」
  const receiptMatch = text.match(SUBMISSION_PATTERN_RECEIPT);
  if (receiptMatch) {
    const date = extractDateFromPatternMatch(receiptMatch);
    if (date && !processedDates.has(date + '_submission')) {
      const idx = text.indexOf(receiptMatch[0]);
      if (!isExcludedDate(text, idx)) {
        processedDates.add(date + '_submission');
        results.push({
          type: 'submission',
          date,
          context: text.slice(Math.max(0, idx - 20), idx + receiptMatch[0].length + 20).replace(/\s+/g, ' '),
          confidence: 0.95,
          source: '收文/收件',
        });
        console.log(`[OCR] Found submission date via 收文/收件: ${date}`);
      }
    }
  }
  
  // ============================================================
  // 優先級 1.5: 派員訪查併聯函 - 提取「實際掛表日」
  // ============================================================
  if (isPaiyuanFangcha) {
    // 嘗試匹配「併聯運轉日: XXX年XX月XX日」
    const binglianMatch = text.match(METER_DATE_PATTERN_BINGLIAN);
    if (binglianMatch) {
      const date = extractDateFromPatternMatch(binglianMatch);
      if (date && !processedDates.has(date + '_meter_date')) {
        processedDates.add(date + '_meter_date');
        const idx = text.indexOf(binglianMatch[0]);
        results.push({
          type: 'meter_date',
          date,
          context: text.slice(Math.max(0, idx - 20), idx + binglianMatch[0].length + 20).replace(/\s+/g, ' '),
          confidence: 0.99,
          source: '併聯運轉日（實際掛表日）',
        });
        console.log(`[OCR] Found meter date via 併聯運轉日: ${date}`);
      }
    }
    
    // 嘗試匹配「本處業於 XXX年XX月XX日 派員訪查」
    const fangchaMatch = text.match(METER_DATE_PATTERN_FANGCHA);
    if (fangchaMatch && !results.some(r => r.type === 'meter_date')) {
      const date = extractDateFromPatternMatch(fangchaMatch);
      if (date && !processedDates.has(date + '_meter_date')) {
        processedDates.add(date + '_meter_date');
        const idx = text.indexOf(fangchaMatch[0]);
        results.push({
          type: 'meter_date',
          date,
          context: text.slice(Math.max(0, idx - 20), idx + fangchaMatch[0].length + 20).replace(/\s+/g, ' '),
          confidence: 0.95,
          source: '本處業於...派員訪查（實際掛表日）',
        });
        console.log(`[OCR] Found meter date via 派員訪查: ${date}`);
      }
    }
  }
  
  // ============================================================
  // 優先級 1.6: 審查意見書 - 提取「PV 編號」
  // ============================================================
  if (isShenchaYijian) {
    extractedPvId = extractPvId(text);
  }
  
  // ============================================================
  // 優先級 2: 提取核發日 - 「發文日期: XXX年XX月XX日」
  // ============================================================
  const issueMatch = text.match(ISSUE_PATTERN_OFFICIAL);
  if (issueMatch) {
    const date = extractDateFromPatternMatch(issueMatch);
    if (date && !processedDates.has(date + '_issue')) {
      processedDates.add(date + '_issue');
      const idx = text.indexOf(issueMatch[0]);
      results.push({
        type: 'issue',
        date,
        context: text.slice(Math.max(0, idx - 20), idx + issueMatch[0].length + 20).replace(/\s+/g, ' '),
        confidence: 0.99,
        source: '發文日期',
      });
      console.log(`[OCR] Found issue date via 發文日期: ${date}`);
    }
  }
  
  // ============================================================
  // 優先級 3: 使用通用模式提取其他可能的日期（較低置信度）
  // ============================================================
  DATE_PATTERNS.forEach((pattern, patternIndex) => {
    pattern.lastIndex = 0;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const date = parseDate(match, patternIndex);
      if (!date) continue;
      
      // 檢查這個日期是否已經被特定模式處理過
      if (processedDates.has(date + '_submission') || processedDates.has(date + '_issue')) {
        continue;
      }
      
      const dateKey = date + '_unknown';
      if (processedDates.has(dateKey)) continue;
      processedDates.add(dateKey);
      
      // 檢查是否應該排除
      if (isExcludedDate(text, match.index)) {
        continue;
      }

      // Get surrounding context
      const start = Math.max(0, match.index - 100);
      const end = Math.min(text.length, match.index + match[0].length + 100);
      const context = text.slice(start, end).replace(/\s+/g, ' ');

      results.push({
        type: 'unknown',
        date,
        context,
        confidence: 0.3,
        source: '通用模式',
      });
    }
  });

  // Sort by confidence (highest first), then by type priority
  const sortedResults = results.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    // Prioritize known types over unknown
    const typePriority: Record<string, number> = { issue: 1, submission: 2, meter_date: 3, unknown: 4 };
    return (typePriority[a.type] || 99) - (typePriority[b.type] || 99);
  });
  
  return {
    dates: sortedResults,
    pvId: extractedPvId?.pvId,
    pvIdContext: extractedPvId?.context,
  };
}

// Refresh Google OAuth access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      console.error('[OCR] Missing Google OAuth credentials');
      return null;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('[OCR] Failed to refresh token:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('[OCR] Token refresh error:', error);
    return null;
  }
}

// Maximum file size for OCR (3MB to avoid memory issues)
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;

// Fetch file content from Google Drive with size limit
async function fetchDriveFile(driveFileId: string, accessToken: string): Promise<{ content: string; mimeType: string; skipped?: boolean; skipReason?: string } | null> {
  try {
    console.log(`[OCR] Attempting to fetch Drive file: ${driveFileId}`);
    
    // First get file metadata to check mime type and SIZE
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=mimeType,name,size`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!metaResponse.ok) {
      const errorText = await metaResponse.text();
      console.error(`[OCR] Failed to get file metadata (${metaResponse.status}):`, errorText);
      return null;
    }

    const metadata = await metaResponse.json();
    const mimeType = metadata.mimeType;
    const fileSize = parseInt(metadata.size || '0');
    console.log(`[OCR] Drive file metadata: ${metadata.name}, type: ${mimeType}, size: ${fileSize} bytes`);

    // Check file size limit
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      console.log(`[OCR] File too large (${fileSize} bytes > ${MAX_FILE_SIZE_BYTES} bytes), skipping OCR`);
      return { 
        content: '', 
        mimeType, 
        skipped: true, 
        skipReason: `檔案過大 (${(fileSize / 1024 / 1024).toFixed(1)}MB > 3MB)，請手動輸入日期` 
      };
    }

    // For Google Docs/Sheets/Slides, export as PDF
    let downloadUrl: string;
    let finalMimeType = mimeType;
    
    if (mimeType.startsWith('application/vnd.google-apps')) {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}/export?mimeType=application/pdf`;
      finalMimeType = 'application/pdf';
      console.log('[OCR] Exporting Google Workspace file as PDF');
    } else {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;
    }

    console.log(`[OCR] Downloading from: ${downloadUrl.substring(0, 80)}...`);
    
    const fileResponse = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      console.error(`[OCR] Failed to download file (${fileResponse.status}):`, errorText);
      return null;
    }

    const buffer = await fileResponse.arrayBuffer();
    console.log(`[OCR] Downloaded ${buffer.byteLength} bytes`);
    
    // Double-check downloaded size
    if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
      console.log(`[OCR] Downloaded file too large, skipping`);
      return { 
        content: '', 
        mimeType: finalMimeType, 
        skipped: true, 
        skipReason: `檔案過大，請手動輸入日期` 
      };
    }
    
    // More memory-efficient base64 encoding using btoa with chunks
    const uint8Array = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const content = btoa(binary);
    
    console.log(`[OCR] Base64 encoded content length: ${content.length}`);
    return { content, mimeType: finalMimeType };
  } catch (error) {
    console.error('[OCR] Drive file fetch error:', error);
    return null;
  }
}

// Use Lovable AI (Gemini) for OCR - optimized for government documents
async function performOcrWithLovableAI(imageBase64: string, mimeType: string, maxPages: number = 1): Promise<string> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY 未設定');
  }

  console.log(`[OCR] Using Lovable AI (Gemini) for OCR... (maxPages: ${maxPages})`);

  // 針對政府函文優化的 prompt - 強調只讀第一頁，並專注於日期關鍵字
  const ocrPrompt = `你是專門辨識台灣政府公文的 OCR 助手。

【重要】這是一份多頁 PDF 文件，但你只需要辨識「第一頁」的內容。請忽略第二頁及之後的所有內容。

請從第一頁中提取所有文字，特別注意以下日期相關關鍵字：
- 「發文日期：」後面的日期 → 這是核發日
- 「復台端」、「復貴公司」後面的日期 → 這是送件日（申請人送件的日期）
- 「依據貴公司」、「臺端於」、「台端於」後面的日期 → 這是送件日
- 「本處業於」、「本府」後面的日期 → 這是送件日或收件日
- 「申請日」、「收文」、「收件」後面的日期 → 這是送件日

日期格式可能是：
- 民國年份：如「113年05月20日」或「中華民國113年5月20日」
- 西元年份：如「2024年5月20日」

請輸出第一頁的完整文字內容：`;

  // Retry logic with exponential backoff for transient errors (502, 503, 504)
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: ocrPrompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OCR] Lovable AI error (${response.status}, attempt ${attempt}/${maxRetries}):`, errorText);
        
        if (response.status === 429) {
          throw new Error('AI 服務請求過於頻繁，請稍後再試');
        }
        if (response.status === 402) {
          throw new Error('AI 服務額度不足');
        }
        
        // Retry on transient errors (502, 503, 504)
        if ([502, 503, 504].includes(response.status) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`[OCR] Transient error ${response.status}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw new Error(`AI OCR 處理失敗: ${response.status}`);
      }

      const data = await response.json();
      const extractedText = data.choices?.[0]?.message?.content || '';
      
      console.log(`[OCR] Lovable AI extracted ${extractedText.length} chars from first page`);
      return extractedText;
      
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on non-transient errors
      if ((error as Error).message.includes('請求過於頻繁') || 
          (error as Error).message.includes('額度不足')) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[OCR] Error occurred, retrying in ${delay}ms...`, (error as Error).message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('AI OCR 處理失敗');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授權' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '無效的認證令牌' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const contentType = req.headers.get('content-type') || '';
    let imageBase64: string | null = null;
    let documentId: string | null = null;
    let mimeType = 'application/pdf';
    let autoUpdate = false; // Default to NOT auto-update, let user confirm
    let maxPages = 1; // Default to first page only

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      documentId = formData.get('documentId') as string | null;
      autoUpdate = formData.get('autoUpdate') === 'true';
      maxPages = parseInt(formData.get('maxPages') as string) || 1;
      const file = formData.get('file') as File | null;
      
      if (file) {
        // Check file size limit for uploaded files
        if (file.size > MAX_FILE_SIZE_BYTES) {
          console.log(`[OCR] Uploaded file too large: ${file.size} bytes`);
          return new Response(
            JSON.stringify({ 
              success: true,
              skipped: true,
              skipReason: `檔案過大 (${(file.size / 1024 / 1024).toFixed(1)}MB > 3MB)，請手動輸入日期`,
              extractedDates: [],
              fullText: ''
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        imageBase64 = btoa(binary);
        mimeType = file.type || 'application/pdf';
      }
    } else {
      const body = await req.json();
      documentId = body.documentId;
      imageBase64 = body.imageBase64;
      mimeType = body.mimeType || 'application/pdf';
      autoUpdate = body.autoUpdate === true;
      maxPages = typeof body.maxPages === 'number' ? body.maxPages : 1;
    }

    // Track document title for smarter date extraction
    let docTitle: string | null = null;
    
    // If no file provided but documentId exists, try to fetch from Drive
    if (!imageBase64 && documentId) {
      console.log(`[OCR] No file provided, attempting to fetch from Drive for document: ${documentId}`);
      
      // Get document info including drive_file_id with retry for transient errors
      let docData: { drive_file_id: string | null; title: string | null } | null = null;
      let docError: Error | null = null;
      
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from('documents')
          .select('drive_file_id, title')
          .eq('id', documentId)
          .single();
        
        if (!error && data) {
          docData = data;
          break;
        }
        
        docError = error;
        console.log(`[OCR] Document lookup attempt ${attempt + 1} failed:`, error?.message);
        
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
      
      if (docError || !docData) {
        console.error(`[OCR] Document not found after retries: ${documentId}`, docError?.message);
        return new Response(
          JSON.stringify({ error: '找不到文件', details: docError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Store title for smarter date extraction
      docTitle = docData.title;
      console.log(`[OCR] Document title: ${docTitle}`);
      
      if (!docData.drive_file_id) {
        return new Response(
          JSON.stringify({ error: '此文件沒有關聯的 Google Drive 檔案' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's Drive token
      const { data: tokenData, error: tokenError } = await supabase
        .from('user_drive_tokens')
        .select('access_token, refresh_token, token_expires_at')
        .eq('user_id', user.id)
        .single();

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ error: '未連接 Google Drive，請先授權' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if token is expired and refresh if needed
      let accessToken = tokenData.access_token;
      const expiresAt = new Date(tokenData.token_expires_at);
      
      if (expiresAt < new Date()) {
        console.log('[OCR] Access token expired, refreshing...');
        const newToken = await refreshAccessToken(tokenData.refresh_token);
        if (!newToken) {
          return new Response(
            JSON.stringify({ error: 'Google Drive 授權已過期，請重新授權' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        accessToken = newToken;
        
        // Update token in database
        await supabase
          .from('user_drive_tokens')
          .update({
            access_token: newToken,
            token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      }

      // Fetch file from Drive (with size limit check)
      const driveFile = await fetchDriveFile(docData.drive_file_id, accessToken);
      if (!driveFile) {
        return new Response(
          JSON.stringify({ error: '無法從 Google Drive 取得檔案' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Handle skipped files (too large)
      if (driveFile.skipped) {
        console.log(`[OCR] File skipped: ${driveFile.skipReason}`);
        return new Response(
          JSON.stringify({ 
            success: true,
            skipped: true,
            skipReason: driveFile.skipReason,
            extractedDates: [],
            fullText: ''
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      imageBase64 = driveFile.content;
      mimeType = driveFile.mimeType;
      console.log(`[OCR] Successfully fetched file from Drive, size: ${imageBase64.length} chars`);
    }

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: '缺少檔案資料' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[OCR] Processing document, type: ${mimeType}, documentId: ${documentId}`);

    // Use Lovable AI (Gemini) for OCR - no API key needed!
    console.log(`[OCR] Processing with maxPages: ${maxPages}`);
    const fullText = await performOcrWithLovableAI(imageBase64, mimeType, maxPages);

    if (!fullText) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: '未偵測到文字',
          extractedDates: [],
          fullText: ''
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[OCR] OCR text length: ${fullText.length} chars`);

    // Extract dates and data from OCR text (pass document title for smarter inference)
    const extractedData = extractDatesFromText(fullText, docTitle || undefined);
    console.log(`[OCR] Extracted ${extractedData.dates.length} dates, PV ID: ${extractedData.pvId || 'none'}`);

    // Only update if autoUpdate is true (for batch upload)
    // Otherwise just return results for user confirmation
    let updatedFields: Record<string, string> = {};
    let projectUpdatedFields: Record<string, string> = {};
    
    if (autoUpdate && documentId && extractedData.dates.length > 0) {
      // Find best submission, issue, and meter dates
      const submissionDate = extractedData.dates.find(d => d.type === 'submission');
      const issueDate = extractedData.dates.find(d => d.type === 'issue');
      const meterDate = extractedData.dates.find(d => d.type === 'meter_date');

      if (submissionDate || issueDate) {
        const updateData: Record<string, string | null> = {};
        
        if (submissionDate) {
          updateData.submitted_at = submissionDate.date;
          updatedFields.submitted_at = submissionDate.date;
        }
        
        if (issueDate) {
          updateData.issued_at = issueDate.date;
          updatedFields.issued_at = issueDate.date;
        }

        const { error: updateError } = await supabase
          .from('documents')
          .update(updateData)
          .eq('id', documentId);

        if (updateError) {
          console.error('[OCR] Document update error:', updateError);
        } else {
          console.log('[OCR] Document auto-updated:', updatedFields);
        }
      }
      
      // 如果有實際掛表日或 PV 編號，更新專案資料
      if (meterDate || extractedData.pvId) {
        // 先取得文件所屬的專案 ID
        const { data: docData } = await supabase
          .from('documents')
          .select('project_id')
          .eq('id', documentId)
          .single();
          
        if (docData?.project_id) {
          const projectUpdateData: Record<string, string | null> = {};
          
          if (meterDate) {
            projectUpdateData.actual_meter_date = meterDate.date;
            projectUpdatedFields.actual_meter_date = meterDate.date;
          }
          
          if (extractedData.pvId) {
            projectUpdateData.taipower_pv_id = extractedData.pvId;
            projectUpdatedFields.taipower_pv_id = extractedData.pvId;
          }
          
          const { error: projectUpdateError } = await supabase
            .from('projects')
            .update(projectUpdateData)
            .eq('id', docData.project_id);
            
          if (projectUpdateError) {
            console.error('[OCR] Project update error:', projectUpdateError);
          } else {
            console.log('[OCR] Project auto-updated:', projectUpdatedFields);
          }
        }
      }
    } else {
      console.log('[OCR] Returning results for user confirmation (autoUpdate=false)');
    }

    return new Response(
      JSON.stringify({
        success: true,
        extractedDates: extractedData.dates,
        pvId: extractedData.pvId,
        pvIdContext: extractedData.pvIdContext,
        fullText: fullText.slice(0, 2000), // Return first 2000 chars for debugging
        updatedFields,
        projectUpdatedFields,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[OCR] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
