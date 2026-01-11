import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum file size for OCR processing (3MB)
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;

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

interface AIExtractedResult {
  submitted_at?: string;
  submitted_at_context?: string;
  issued_at?: string;
  issued_at_context?: string;
  meter_date?: string;
  meter_date_context?: string;
  pv_id?: string;
  pv_id_context?: string;
  raw_text?: string;
}

// ============================================================
// Regex 備援模式 - 當 AI 沒抓到時使用
// ============================================================

// 送件日 patterns
const SUBMISSION_PATTERNS = [
  { pattern: /復台端\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, source: '復台端' },
  { pattern: /復貴公司\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, source: '復貴公司' },
  { pattern: /依據貴公司\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, source: '依據貴公司' },
  { pattern: /依據[臺台]端\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, source: '依據臺端' },
  { pattern: /[臺台]端於\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, source: '臺端於' },
  { pattern: /本處業於\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, source: '本處業於' },
  { pattern: /申請日[期]?[：:]\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, source: '申請日' },
  { pattern: /收件日期[：:]\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, source: '收件日期' },
  { pattern: /受理日期[：:]\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, source: '受理日期' },
];

// 核發日 patterns
const ISSUE_PATTERNS = [
  { pattern: /發文日期[：:]\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, source: '發文日期' },
];

// 掛表日 patterns
const METER_PATTERNS = [
  { pattern: /併聯(?:運轉)?日[期]?\s*[：:]\s*(?:中華)?民?國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, source: '併聯運轉日' },
];

// PV ID patterns
const PV_ID_PATTERNS = [
  /(?:本公司編號|PV編號|編號|受理號碼)[：:\s]*([A-Z0-9]{6,}PV[A-Z0-9]{4,})/i,
  /\b(\d{6}PV\d{4})\b/,
];

// ROC year to Western year conversion
function rocToWestern(rocYear: number): number {
  return rocYear + 1911;
}

// Extract date from regex match
function extractDateFromMatch(match: RegExpMatchArray): string | null {
  const rawYear = parseInt(match[1]);
  const year = rawYear < 200 ? rocToWestern(rawYear) : rawYear;
  const month = parseInt(match[2]);
  const day = parseInt(match[3]);
  
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

// Parse a date string and convert ROC dates to Western format
function parseAndFormatDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Already in YYYY-MM-DD format
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]);
    const day = parseInt(isoMatch[3]);
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  
  // ROC date format: 民國XXX年XX月XX日 or 中華民國XXX年XX月XX日
  const rocMatch = dateStr.match(/(?:中華)?民國?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (rocMatch) {
    const year = rocToWestern(parseInt(rocMatch[1]));
    const month = parseInt(rocMatch[2]);
    const day = parseInt(rocMatch[3]);
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  
  // Plain year format: XXX年XX月XX日 (assume ROC if year < 200)
  const plainMatch = dateStr.match(/(\d{2,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (plainMatch) {
    let year = parseInt(plainMatch[1]);
    if (year < 200) year = rocToWestern(year);
    const month = parseInt(plainMatch[2]);
    const day = parseInt(plainMatch[3]);
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  
  // Slash or dash format: YYYY/MM/DD or XXX/MM/DD
  const slashMatch = dateStr.match(/(\d{2,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (slashMatch) {
    let year = parseInt(slashMatch[1]);
    if (year < 200) year = rocToWestern(year);
    const month = parseInt(slashMatch[2]);
    const day = parseInt(slashMatch[3]);
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  
  return null;
}

// Regex fallback extraction from OCR text
function extractWithRegexFallback(text: string, aiResult: AIExtractedResult): ExtractedData {
  const results: ExtractedDate[] = [];
  const processedDates = new Set<string>();
  
  // 1. Add AI-extracted dates first
  if (aiResult.submitted_at) {
    const parsedDate = parseAndFormatDate(aiResult.submitted_at);
    if (parsedDate) {
      processedDates.add(parsedDate + '_submission');
      results.push({
        type: 'submission',
        date: parsedDate,
        context: aiResult.submitted_at_context || aiResult.submitted_at,
        confidence: 0.95,
        source: 'AI 語意辨識',
      });
    }
  }
  
  if (aiResult.issued_at) {
    const parsedDate = parseAndFormatDate(aiResult.issued_at);
    if (parsedDate) {
      processedDates.add(parsedDate + '_issue');
      results.push({
        type: 'issue',
        date: parsedDate,
        context: aiResult.issued_at_context || aiResult.issued_at,
        confidence: 0.95,
        source: 'AI 語意辨識',
      });
    }
  }
  
  if (aiResult.meter_date) {
    const parsedDate = parseAndFormatDate(aiResult.meter_date);
    if (parsedDate) {
      processedDates.add(parsedDate + '_meter');
      results.push({
        type: 'meter_date',
        date: parsedDate,
        context: aiResult.meter_date_context || aiResult.meter_date,
        confidence: 0.95,
        source: 'AI 語意辨識',
      });
    }
  }
  
  // 2. Regex fallback for missing dates
  const hasSubmission = results.some(r => r.type === 'submission');
  const hasIssue = results.some(r => r.type === 'issue');
  const hasMeter = results.some(r => r.type === 'meter_date');
  
  // Fallback: Find submission date with regex
  if (!hasSubmission && text) {
    for (const { pattern, source } of SUBMISSION_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const date = extractDateFromMatch(match);
        if (date && !processedDates.has(date + '_submission')) {
          processedDates.add(date + '_submission');
          const idx = text.indexOf(match[0]);
          results.push({
            type: 'submission',
            date,
            context: text.slice(Math.max(0, idx - 20), idx + match[0].length + 20).replace(/\s+/g, ' '),
            confidence: 0.85,
            source: `Regex 備援 (${source})`,
          });
          console.log(`[OCR] Regex fallback found submission: ${date} via ${source}`);
          break;
        }
      }
    }
  }
  
  // Fallback: Find issue date with regex
  if (!hasIssue && text) {
    for (const { pattern, source } of ISSUE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const date = extractDateFromMatch(match);
        if (date && !processedDates.has(date + '_issue')) {
          processedDates.add(date + '_issue');
          const idx = text.indexOf(match[0]);
          results.push({
            type: 'issue',
            date,
            context: text.slice(Math.max(0, idx - 20), idx + match[0].length + 20).replace(/\s+/g, ' '),
            confidence: 0.85,
            source: `Regex 備援 (${source})`,
          });
          console.log(`[OCR] Regex fallback found issue: ${date} via ${source}`);
          break;
        }
      }
    }
  }
  
  // Fallback: Find meter date with regex
  if (!hasMeter && text) {
    for (const { pattern, source } of METER_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const date = extractDateFromMatch(match);
        if (date && !processedDates.has(date + '_meter')) {
          processedDates.add(date + '_meter');
          const idx = text.indexOf(match[0]);
          results.push({
            type: 'meter_date',
            date,
            context: text.slice(Math.max(0, idx - 20), idx + match[0].length + 20).replace(/\s+/g, ' '),
            confidence: 0.85,
            source: `Regex 備援 (${source})`,
          });
          console.log(`[OCR] Regex fallback found meter_date: ${date} via ${source}`);
          break;
        }
      }
    }
  }
  
  // 3. Extract PV ID (AI first, then regex fallback)
  let pvId = aiResult.pv_id;
  let pvIdContext = aiResult.pv_id_context;
  
  if (!pvId && text) {
    for (const pattern of PV_ID_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        pvId = match[1];
        const idx = text.indexOf(match[0]);
        pvIdContext = text.slice(Math.max(0, idx - 20), idx + match[0].length + 20);
        console.log(`[OCR] Regex fallback found PV ID: ${pvId}`);
        break;
      }
    }
  }
  
  return {
    dates: results,
    pvId,
    pvIdContext,
  };
}

// Refresh Google Drive access token
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    console.error('[OCR] Missing Google OAuth credentials');
    return null;
  }
  
  try {
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
      console.error('[OCR] Token refresh failed:', await response.text());
      return null;
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('[OCR] Token refresh error:', error);
    return null;
  }
}

// Fetch file from Google Drive
async function fetchDriveFile(driveFileId: string, accessToken: string): Promise<{ content: string; mimeType: string; skipped?: boolean; skipReason?: string } | null> {
  try {
    console.log(`[OCR] Fetching Drive file: ${driveFileId}`);
    
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=mimeType,size,name`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!metaResponse.ok) {
      console.error('[OCR] Failed to get file metadata:', await metaResponse.text());
      return null;
    }
    
    const metadata = await metaResponse.json();
    console.log(`[OCR] File metadata: name=${metadata.name}, type=${metadata.mimeType}, size=${metadata.size}`);
    
    const fileSize = parseInt(metadata.size || '0');
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      return { 
        content: '', 
        mimeType: metadata.mimeType,
        skipped: true,
        skipReason: `檔案過大 (${(fileSize / 1024 / 1024).toFixed(1)}MB > 3MB)，請手動輸入日期`
      };
    }
    
    let finalMimeType = metadata.mimeType;
    let downloadUrl: string;
    
    if (metadata.mimeType.includes('google-apps')) {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}/export?mimeType=application/pdf`;
      finalMimeType = 'application/pdf';
    } else {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;
    }
    
    const fileResponse = await fetch(downloadUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (!fileResponse.ok) {
      console.error('[OCR] Failed to download file:', await fileResponse.text());
      return null;
    }
    
    const buffer = await fileResponse.arrayBuffer();
    
    if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
      return { 
        content: '', 
        mimeType: finalMimeType,
        skipped: true,
        skipReason: `檔案過大 (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB > 3MB)，請手動輸入日期`
      };
    }
    
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

// Use AI semantic understanding to extract dates directly
async function extractDatesWithAI(imageBase64: string, mimeType: string, docTitle?: string): Promise<AIExtractedResult> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY 未設定');
  }

  console.log(`[OCR] Using AI semantic understanding for date extraction...`);

  const systemPrompt = `你是專門辨識台灣政府公文的 AI 助手。你的任務是分析公文圖片，理解文件內容，並提取重要的日期和資訊。

你需要辨識以下資訊：

1. **送件日（submitted_at）**：申請人提交申請的日期
   - 通常出現在「復台端 X年X月X日」、「依據貴公司 X年X月X日」、「臺端於 X年X月X日申請」等語句中
   - 或是「收件日期」、「申請日期」、「受理日期」的值
   - 這是申請方送出申請的日期，不是政府回覆的日期

2. **核發日（issued_at）**：政府機關發文的日期
   - 通常在「發文日期：」後面
   - 或是審查章、核准章上蓋的日期
   - 這是政府回覆公文的發文日期

3. **掛表日（meter_date）**：太陽能電錶安裝運轉的日期
   - 通常出現在「併聯運轉日」、「派員訪查」相關內容中
   - 只有派員訪查併聯函才會有這個日期

4. **PV編號（pv_id）**：台電的案件編號
   - 格式通常是 6位數+PV+4位數，如「108114PV0784」
   - 可能出現在「受理號碼」、「本公司編號」等處

【重要規則】
- 請只分析「第一頁」的內容
- 日期可能是民國年份（如「114年11月21日」）或西元年份
- 如果某個日期找不到，請不要填寫，不要猜測
- 請在 context 欄位說明日期是從什麼語句或位置提取的`;

  const userPrompt = docTitle 
    ? `請分析這份公文圖片「${docTitle}」，提取送件日、核發日、掛表日和PV編號。`
    : `請分析這份公文圖片，提取送件日、核發日、掛表日和PV編號。`;

  const tools = [
    {
      type: "function",
      function: {
        name: "extract_document_info",
        description: "從公文中提取日期和編號資訊",
        parameters: {
          type: "object",
          properties: {
            submitted_at: {
              type: "string",
              description: "送件日（申請人提交申請的日期），格式為民國年或西元年，如「114年11月21日」或「2025-11-21」"
            },
            submitted_at_context: {
              type: "string",
              description: "送件日的上下文，說明是從什麼語句提取的"
            },
            issued_at: {
              type: "string",
              description: "核發日（發文日期），格式為民國年或西元年"
            },
            issued_at_context: {
              type: "string",
              description: "核發日的上下文，說明是從什麼語句提取的"
            },
            meter_date: {
              type: "string",
              description: "掛表日/併聯運轉日（只有派員訪查函才有）"
            },
            meter_date_context: {
              type: "string",
              description: "掛表日的上下文"
            },
            pv_id: {
              type: "string",
              description: "PV編號，格式如 108114PV0784"
            },
            pv_id_context: {
              type: "string",
              description: "PV編號的上下文"
            },
            raw_text: {
              type: "string",
              description: "OCR 辨識出的主要文字內容（前500字）"
            }
          },
          required: [],
          additionalProperties: false
        }
      }
    }
  ];

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
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          tools,
          tool_choice: { type: "function", function: { name: "extract_document_info" } },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OCR] AI error (${response.status}, attempt ${attempt}/${maxRetries}):`, errorText);
        
        if (response.status === 429) {
          throw new Error('AI 服務請求過於頻繁，請稍後再試');
        }
        if (response.status === 402) {
          throw new Error('AI 服務額度不足');
        }
        
        if ([502, 503, 504].includes(response.status) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[OCR] Transient error ${response.status}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw new Error(`AI 處理失敗: ${response.status}`);
      }

      const data = await response.json();
      
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall && toolCall.function?.arguments) {
        const result = JSON.parse(toolCall.function.arguments) as AIExtractedResult;
        console.log('[OCR] AI extracted result:', JSON.stringify(result, null, 2));
        return result;
      }
      
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        console.log('[OCR] AI returned content instead of tool call, raw text length:', content.length);
        return { raw_text: content };
      }
      
      console.log('[OCR] No valid response from AI');
      return {};
      
    } catch (error) {
      lastError = error as Error;
      
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
  
  throw lastError || new Error('AI 處理失敗');
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

    const contentType = req.headers.get('content-type') || '';
    let imageBase64: string | null = null;
    let documentId: string | null = null;
    let mimeType = 'application/pdf';
    let autoUpdate = false;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      documentId = formData.get('documentId') as string | null;
      autoUpdate = formData.get('autoUpdate') === 'true';
      const file = formData.get('file') as File | null;
      
      if (file) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
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
    }

    let docTitle: string | null = null;
    
    if (!imageBase64 && documentId) {
      console.log(`[OCR] No file provided, attempting to fetch from Drive for document: ${documentId}`);
      
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
        return new Response(
          JSON.stringify({ error: '找不到文件', details: docError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      docTitle = docData.title;
      console.log(`[OCR] Document title: ${docTitle}`);
      
      if (!docData.drive_file_id) {
        return new Response(
          JSON.stringify({ error: '此文件沒有關聯的 Google Drive 檔案' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
        
        await supabase
          .from('user_drive_tokens')
          .update({
            access_token: newToken,
            token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      }

      const driveFile = await fetchDriveFile(docData.drive_file_id, accessToken);
      if (!driveFile) {
        return new Response(
          JSON.stringify({ error: '無法從 Google Drive 取得檔案' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (driveFile.skipped) {
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

    // Step 1: AI semantic extraction
    const aiResult = await extractDatesWithAI(imageBase64, mimeType, docTitle || undefined);
    
    // Step 2: Regex fallback for missing dates
    const fullText = aiResult.raw_text || '';
    const extractedData = extractWithRegexFallback(fullText, aiResult);
    
    console.log(`[OCR] Final result: ${extractedData.dates.length} dates, PV ID: ${extractedData.pvId || 'none'}`);

    // Auto-update if requested
    if (autoUpdate && documentId && extractedData.dates.length > 0) {
      const submissionDate = extractedData.dates.find(d => d.type === 'submission')?.date;
      const issueDate = extractedData.dates.find(d => d.type === 'issue')?.date;
      const meterDate = extractedData.dates.find(d => d.type === 'meter_date')?.date;
      
      const updateData: Record<string, string> = {};
      if (submissionDate) updateData.submitted_at = submissionDate;
      if (issueDate) updateData.issued_at = issueDate;
      
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('documents')
          .update(updateData)
          .eq('id', documentId);
        
        if (updateError) {
          console.error('[OCR] Failed to auto-update document:', updateError);
        } else {
          console.log('[OCR] Auto-updated document with extracted dates');
        }
      }
      
      if (meterDate) {
        const { data: docData } = await supabase
          .from('documents')
          .select('project_id')
          .eq('id', documentId)
          .single();
        
        if (docData?.project_id) {
          await supabase
            .from('projects')
            .update({ actual_meter_date: meterDate })
            .eq('id', docData.project_id);
        }
      }
      
      if (extractedData.pvId) {
        const { data: docData } = await supabase
          .from('documents')
          .select('project_id')
          .eq('id', documentId)
          .single();
        
        if (docData?.project_id) {
          await supabase
            .from('projects')
            .update({ taipower_pv_id: extractedData.pvId })
            .eq('id', docData.project_id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        extractedDates: extractedData.dates,
        pvId: extractedData.pvId,
        pvIdContext: extractedData.pvIdContext,
        fullText: fullText,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[OCR] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : '處理失敗',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
