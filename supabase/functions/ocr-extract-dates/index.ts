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
  // Western date: YYYY年MM月DD日
  /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g,
  // Western date: YYYY/MM/DD or YYYY-MM-DD
  /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,
  // ROC date: XXX/MM/DD (ROC year format)
  /(\d{2,3})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,
];

// Keywords that indicate submission date (送件日)
const SUBMISSION_KEYWORDS = [
  '送件日', '申請日', '收件日', '收文日', '申請日期', '送件日期',
  '受理日', '受理日期', '來函', '收件編號', '收文號'
];

// Keywords that indicate issue date (核發日)
const ISSUE_KEYWORDS = [
  '核發日', '發文日', '發照日', '發給日', '函覆日', '核准日',
  '同意日', '發文日期', '核發日期', '核定日', '生效日'
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
    } else if (patternIndex === 1 || patternIndex === 2) {
      // Western date
      year = parseInt(match[1]);
      month = parseInt(match[2]);
      day = parseInt(match[3]);
    } else {
      // ROC date without 民國 (assume if year < 200, it's ROC)
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

function extractDatesFromText(text: string): ExtractedDate[] {
  const results: ExtractedDate[] = [];
  const processedDates = new Set<string>();

  DATE_PATTERNS.forEach((pattern, patternIndex) => {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const date = parseDate(match, patternIndex);
      if (!date || processedDates.has(date)) continue;
      
      processedDates.add(date);

      // Get surrounding context (100 chars before and after)
      const start = Math.max(0, match.index - 100);
      const end = Math.min(text.length, match.index + match[0].length + 100);
      const context = text.slice(start, end).replace(/\s+/g, ' ');

      // Determine date type based on nearby keywords
      let type: 'submission' | 'issue' | 'unknown' = 'unknown';
      let confidence = 0.5;

      const nearbyText = text.slice(Math.max(0, match.index - 50), match.index + match[0].length + 50);
      
      for (const keyword of SUBMISSION_KEYWORDS) {
        if (nearbyText.includes(keyword)) {
          type = 'submission';
          confidence = 0.9;
          break;
        }
      }

      if (type === 'unknown') {
        for (const keyword of ISSUE_KEYWORDS) {
          if (nearbyText.includes(keyword)) {
            type = 'issue';
            confidence = 0.9;
            break;
          }
        }
      }

      results.push({ type, date, context, confidence });
    }
  });

  // Sort by confidence (highest first)
  return results.sort((a, b) => b.confidence - a.confidence);
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
    const visionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');

    if (!visionApiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Vision API Key 未設定' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      documentId = formData.get('documentId') as string | null;
      const file = formData.get('file') as File | null;
      
      if (file) {
        const buffer = await file.arrayBuffer();
        imageBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        mimeType = file.type || 'application/pdf';
      }
    } else {
      const body = await req.json();
      documentId = body.documentId;
      imageBase64 = body.imageBase64;
      mimeType = body.mimeType || 'application/pdf';
    }

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: '缺少檔案資料' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ocr-extract-dates] Processing document, type: ${mimeType}, documentId: ${documentId}`);

    // Call Google Cloud Vision API for OCR
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          }],
        }),
      }
    );

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('[ocr-extract-dates] Vision API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'OCR 處理失敗', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const visionResult = await visionResponse.json();
    const textAnnotations = visionResult.responses?.[0]?.textAnnotations;
    const fullText = textAnnotations?.[0]?.description || '';

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

    console.log(`[ocr-extract-dates] OCR text length: ${fullText.length} chars`);

    // Extract dates from OCR text
    const extractedDates = extractDatesFromText(fullText);
    console.log(`[ocr-extract-dates] Extracted ${extractedDates.length} dates`);

    // If documentId provided, optionally update the document
    let updatedFields: Record<string, string> = {};
    if (documentId && extractedDates.length > 0) {
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
          console.error('[ocr-extract-dates] Update error:', updateError);
        } else {
          console.log('[ocr-extract-dates] Document updated:', updatedFields);
        }
      }
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
    console.error('[ocr-extract-dates] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
