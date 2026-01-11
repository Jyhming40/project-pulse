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

// Keywords that indicate submission date (送件日) - 更完整的關鍵字列表
const SUBMISSION_KEYWORDS = [
  // 直接標註
  '送件日', '申請日', '收件日', '收文日', '申請日期', '送件日期',
  '受理日', '受理日期', '收件編號', '收文號', '收文日期',
  // 間接標註 (申請書上會出現的)
  '申請人簽章日', '立書人簽章', '申請者', '聲明日期',
  '日 期 :', '申請 日', '收件 日',
  // 文件類型相關 - 這些文件上的日期通常是送件日
  '申請書', '聲請書', '承諾書', '切結書', '同意書申請',
  '併聯申請', '再生能源發電設備設置申請',
];

// Keywords that indicate issue date (核發日) - 更完整的關鍵字列表
const ISSUE_KEYWORDS = [
  // 直接標註
  '核發日', '發文日', '發照日', '發給日', '函覆日', '核准日',
  '同意日', '發文日期', '核發日期', '核定日', '生效日',
  '批准日', '許可日', '發證日', '簽發日', '公文日期',
  // 政府機關回函特徵
  '本府', '臺電公司', '台電公司', '經濟部', '能源署', '工業局',
  '檢送', '函復', '函覆', '准予', '同意備案', '核准備案',
  '審查意見', '審查通過', '准予備案', '核備',
  '發文字號', '受文者', '主旨:', '說明:',
];

// 文件類型推斷：根據文件名或內容判斷日期類型
const DOC_TYPE_SUBMISSION_PATTERNS = [
  /申請書/i, /承諾書/i, /切結書/i, /聲請/i, /聲明書/i,
  /同意書.*申請/i, /設備登記/i, /併聯申請/i,
];

const DOC_TYPE_ISSUE_PATTERNS = [
  /同意備案/i, /審查意見/i, /核准/i, /許可證/i, /執照/i,
  /函/i, /公文/i, /核備/i, /設備登記函/i, /電表租約/i,
  /正式躉售/i,
];

interface ExtractedDate {
  type: 'submission' | 'issue' | 'unknown';
  date: string; // ISO format YYYY-MM-DD
  context: string; // surrounding text for reference
  confidence: number;
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

function extractDatesFromText(text: string, docTitle?: string): ExtractedDate[] {
  const results: ExtractedDate[] = [];
  const processedDates = new Set<string>();

  // 先分析文件類型來輔助判斷
  let docTypeHint: 'submission' | 'issue' | 'unknown' = 'unknown';
  const textToCheck = (docTitle || '') + ' ' + text.slice(0, 500);
  
  for (const pattern of DOC_TYPE_SUBMISSION_PATTERNS) {
    if (pattern.test(textToCheck)) {
      docTypeHint = 'submission';
      console.log('[OCR] Document appears to be submission type based on patterns');
      break;
    }
  }
  
  if (docTypeHint === 'unknown') {
    for (const pattern of DOC_TYPE_ISSUE_PATTERNS) {
      if (pattern.test(textToCheck)) {
        docTypeHint = 'issue';
        console.log('[OCR] Document appears to be issue type based on patterns');
        break;
      }
    }
  }

  DATE_PATTERNS.forEach((pattern, patternIndex) => {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const date = parseDate(match, patternIndex);
      if (!date || processedDates.has(date)) continue;
      
      processedDates.add(date);

      // Get surrounding context (150 chars before and after for better analysis)
      const start = Math.max(0, match.index - 150);
      const end = Math.min(text.length, match.index + match[0].length + 150);
      const context = text.slice(start, end).replace(/\s+/g, ' ');

      // Determine date type based on nearby keywords
      let type: 'submission' | 'issue' | 'unknown' = 'unknown';
      let confidence = 0.3; // 基礎信心度較低

      // 擴大搜尋範圍
      const nearbyText = text.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100);
      const nearbyTextWide = text.slice(Math.max(0, match.index - 300), match.index + match[0].length + 50);
      
      // 檢查直接關鍵字（高信心度）
      for (const keyword of SUBMISSION_KEYWORDS) {
        if (nearbyText.includes(keyword)) {
          type = 'submission';
          confidence = 0.95;
          console.log(`[OCR] Found submission keyword "${keyword}" near date ${date}`);
          break;
        }
      }

      if (type === 'unknown') {
        for (const keyword of ISSUE_KEYWORDS) {
          if (nearbyText.includes(keyword)) {
            type = 'issue';
            confidence = 0.95;
            console.log(`[OCR] Found issue keyword "${keyword}" near date ${date}`);
            break;
          }
        }
      }

      // 如果沒找到直接關鍵字，使用更廣範圍的模糊匹配
      if (type === 'unknown') {
        // 檢查是否在申請人簽章區域（通常是送件日）
        if (nearbyTextWide.includes('申請人') || nearbyTextWide.includes('立書人') || 
            nearbyTextWide.includes('簽章') || nearbyTextWide.includes('填表日')) {
          type = 'submission';
          confidence = 0.7;
          console.log(`[OCR] Inferred submission date from signature area near ${date}`);
        }
        // 檢查是否在政府機關發文區域（通常是核發日）
        else if (nearbyTextWide.includes('發文字號') || nearbyTextWide.includes('速別') ||
                 nearbyTextWide.includes('密等') || nearbyTextWide.includes('受文者')) {
          type = 'issue';
          confidence = 0.7;
          console.log(`[OCR] Inferred issue date from official document header near ${date}`);
        }
      }

      // 如果仍然未知，使用文件類型提示
      if (type === 'unknown' && docTypeHint !== 'unknown') {
        type = docTypeHint;
        confidence = 0.5;
        console.log(`[OCR] Using document type hint "${docTypeHint}" for date ${date}`);
      }

      results.push({ type, date, context, confidence });
    }
  });

  // Sort by confidence (highest first), then by type priority (submission/issue first)
  return results.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.type !== 'unknown' && b.type === 'unknown') return -1;
    if (a.type === 'unknown' && b.type !== 'unknown') return 1;
    return 0;
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

// Fetch file content from Google Drive
async function fetchDriveFile(driveFileId: string, accessToken: string): Promise<{ content: string; mimeType: string } | null> {
  try {
    console.log(`[OCR] Attempting to fetch Drive file: ${driveFileId}`);
    
    // First get file metadata to check mime type
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
    console.log(`[OCR] Drive file metadata: ${metadata.name}, type: ${mimeType}, size: ${metadata.size || 'unknown'}`);

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
    
    // Handle large files more efficiently
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

      // Fetch file from Drive
      const driveFile = await fetchDriveFile(docData.drive_file_id, accessToken);
      if (!driveFile) {
        return new Response(
          JSON.stringify({ error: '無法從 Google Drive 取得檔案' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
