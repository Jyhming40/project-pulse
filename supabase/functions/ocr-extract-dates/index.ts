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
  '併聯日', '併網日',
];

interface ExtractedDate {
  type: 'submission' | 'issue' | 'unknown';
  date: string; // ISO format YYYY-MM-DD
  context: string; // surrounding text for reference
  confidence: number;
  source?: string; // 來源說明
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

function extractDatesFromText(text: string, docTitle?: string): ExtractedDate[] {
  const results: ExtractedDate[] = [];
  const processedDates = new Set<string>();
  
  console.log(`[OCR] Starting date extraction from ${text.length} chars of text`);
  console.log(`[OCR] Document title: ${docTitle || 'none'}`);

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
  return results.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    // Prioritize known types over unknown
    const typePriority = { issue: 1, submission: 2, unknown: 3 };
    return typePriority[a.type] - typePriority[b.type];
  });
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

// Use Lovable AI (Gemini) for OCR
async function performOcrWithLovableAI(imageBase64: string, mimeType: string, maxPages: number = 1): Promise<string> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY 未設定');
  }

  const pageInstruction = maxPages === 0 
    ? '請閱讀文件的所有頁面' 
    : maxPages === 1 
      ? '請只閱讀文件的第一頁' 
      : `請只閱讀文件的前 ${maxPages} 頁`;

  console.log(`[OCR] Using Lovable AI (Gemini) for OCR... (maxPages: ${maxPages})`);

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
              text: `${pageInstruction}，並提取所有可見的文字內容。請特別注意：
1. 提取所有日期資訊（民國年份或西元年份格式皆可）
2. 注意「送件日」、「申請日」、「收件日」、「核發日」、「發文日」等關鍵字及其後的日期
3. 輸出純文字內容，保持原始格式

請輸出文件中的所有文字：`
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
    console.error(`[OCR] Lovable AI error (${response.status}):`, errorText);
    
    if (response.status === 429) {
      throw new Error('AI 服務請求過於頻繁，請稍後再試');
    }
    if (response.status === 402) {
      throw new Error('AI 服務額度不足');
    }
    throw new Error(`AI OCR 處理失敗: ${response.status}`);
  }

  const data = await response.json();
  const extractedText = data.choices?.[0]?.message?.content || '';
  
  console.log(`[OCR] Lovable AI extracted ${extractedText.length} chars`);
  return extractedText;
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
      
      // Get document info including drive_file_id
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('drive_file_id, title')
        .eq('id', documentId)
        .single();
      
      if (docError || !docData) {
        return new Response(
          JSON.stringify({ error: '找不到文件' }),
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

    // Extract dates from OCR text (pass document title for smarter inference)
    const extractedDates = extractDatesFromText(fullText, docTitle || undefined);
    console.log(`[OCR] Extracted ${extractedDates.length} dates`);

    // Only update if autoUpdate is true (for batch upload)
    // Otherwise just return results for user confirmation
    let updatedFields: Record<string, string> = {};
    if (autoUpdate && documentId && extractedDates.length > 0) {
      // Find best submission and issue dates
      const submissionDate = extractedDates.find(d => d.type === 'submission');
      const issueDate = extractedDates.find(d => d.type === 'issue');

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
          console.error('[OCR] Update error:', updateError);
        } else {
          console.log('[OCR] Document auto-updated:', updatedFields);
        }
      }
    } else {
      console.log('[OCR] Returning results for user confirmation (autoUpdate=false)');
    }

    return new Response(
      JSON.stringify({
        success: true,
        extractedDates,
        fullText: fullText.slice(0, 2000), // Return first 2000 chars for debugging
        updatedFields,
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
