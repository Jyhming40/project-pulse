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
  energyPermitId?: string; // 能源署備案編號（如 YUN-114PV0349）
  energyPermitIdContext?: string;
  // 派員訪查併聯函資料
  taipowerContractNo?: string; // 契約編號（如 08-PV-110-0205）
  taipowerContractNoContext?: string;
  meterNumber?: string; // 購售電號（如 08-01-0200-16-9）
  meterNumberContext?: string;
  pvModuleModel?: string; // 太陽光電模組型號
  inverterModel?: string; // 變流器型號
  panelWattage?: number; // 單片瓦數 (kW)
  panelCount?: number; // 模組片數
  actualInstalledCapacity?: number; // 實際裝置容量 (kWp)
  gridConnectionType?: string; // 併接方式/供電模式
  powerVoltage?: string; // 供電電壓
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
  energy_permit_id?: string; // 能源署備案編號
  energy_permit_id_context?: string;
  // 派員訪查併聯函資料
  taipower_contract_no?: string;
  taipower_contract_no_context?: string;
  meter_number?: string;
  meter_number_context?: string;
  pv_module_model?: string;
  inverter_model?: string;
  panel_wattage?: number;
  panel_count?: number;
  actual_installed_capacity?: number;
  grid_connection_type?: string;
  power_voltage?: string;
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

// 台電 PV ID patterns - 格式：6位區處代碼(純數字) + PV + 4位流水號
// 例如：120114PV0442, 108114PV0784
// ⚠️ 排除能源署備案編號格式：YUN-114PV0349（有英文前綴）
const PV_ID_PATTERNS = [
  /(?:本公司編號|受理號碼|契約編號)[：:\s]*(\d{6}PV\d{4})/i,
  /(?:公司編號[：:\s]*)(\d{6}PV\d{4})/i,
  /\b(\d{6}PV\d{4})\b/,  // 純數字開頭的 PV 編號
];

// 能源署備案編號 patterns - 格式：縣市代碼-年份PV流水號
// 例如：YUN-114PV0349, TPE-113PV0123, CHA-114PV0456
const ENERGY_PERMIT_ID_PATTERNS = [
  /(?:備案編號|案件編號|同意備案)[：:\s]*([A-Z]{2,3}-\d{3}PV\d{4})/i,
  /\b([A-Z]{2,3}-\d{3}PV\d{4})\b/,  // 英文開頭的備案編號
];

// 契約編號 patterns - 格式：區處代碼-PV-年份-流水號
// 例如：08-PV-110-0205, 09-PV-112-0134
const CONTRACT_NO_PATTERNS = [
  /契約編號[：:\s]*(\d{2}-PV-\d{3}-\d{4})/i,
  /\b(\d{2}-PV-\d{3}-\d{4})\b/,
];

// 購售電號 patterns - 格式：區處代碼-年-流水號-表序
// 例如：08-01-0200-16-9, 09-02-0345-12-5
const METER_NUMBER_PATTERNS = [
  /購售電號[：:\s]*(\d{2}-\d{2}-\d{4}-\d{1,2}-\d)/i,
  /\b(\d{2}-\d{2}-\d{4}-\d{1,2}-\d)\b/,
];

// 實際裝置容量 patterns - 提取數值（kWp）
const INSTALLED_CAPACITY_PATTERNS = [
  /(?:發電設備總裝置容量|總裝置容量|裝置容量)[：:\s]*([0-9,.]+)\s*(?:峰瓩|kWp|kW)/i,
  /([0-9,.]+)\s*(?:峰瓩|kWp)\s*[,，]\s*(?:全額躉售|餘電躉售)/i,
];

// 模組型號 patterns
const PV_MODULE_PATTERNS = [
  /太陽光電模組[：:\s]*([A-Z0-9\-]+)/i,
  /光電模組[：:\s]*([A-Z0-9\-]+)/i,
];

// 變流器型號 patterns
const INVERTER_PATTERNS = [
  /變流器[：:\s]*([A-Z0-9\-.]+)/i,
];

// 發電設備機組序號 patterns - 提取瓦數和片數
// 例如：(#01) 0.345瓩*564片
const PANEL_SPEC_PATTERNS = [
  /(?:\(#\d+\)|#\d+)?\s*([0-9,.]+)\s*瓩\s*[*×x]\s*(\d+)\s*片/i,
  /([0-9,.]+)\s*(?:瓦|W|kW|瓩)\s*[*×x]\s*(\d+)\s*片/i,
];

// 供電電壓 patterns
const POWER_VOLTAGE_PATTERNS = [
  /(?:三相四線|三相三線|單相二線|單相三線)\s*(\d+\/\d+V|\d+V)/i,
  /(?:併接方式|供電電壓)[：:\s]*(三相四線\s*\d+\/\d+V|三相三線\s*\d+V|單相\s*\d+V)/i,
];

// 供電模式 patterns
const GRID_CONNECTION_PATTERNS = [
  /(全額躉售|餘電躉售|自發自用)/,
  /(外線併聯|內線併聯)/,
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
  
  // 4. Extract Energy Permit ID (AI first, then regex fallback)
  let energyPermitId = aiResult.energy_permit_id;
  let energyPermitIdContext = aiResult.energy_permit_id_context;
  
  if (!energyPermitId && text) {
    for (const pattern of ENERGY_PERMIT_ID_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        energyPermitId = match[1];
        const idx = text.indexOf(match[0]);
        energyPermitIdContext = text.slice(Math.max(0, idx - 20), idx + match[0].length + 20);
        console.log(`[OCR] Regex fallback found Energy Permit ID: ${energyPermitId}`);
        break;
      }
    }
  }
  
  // 5. Extract 契約編號 (AI first, then regex fallback)
  let taipowerContractNo = aiResult.taipower_contract_no;
  let taipowerContractNoContext = aiResult.taipower_contract_no_context;
  
  if (!taipowerContractNo && text) {
    for (const pattern of CONTRACT_NO_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        taipowerContractNo = match[1];
        const idx = text.indexOf(match[0]);
        taipowerContractNoContext = text.slice(Math.max(0, idx - 20), idx + match[0].length + 20);
        console.log(`[OCR] Regex fallback found Contract No: ${taipowerContractNo}`);
        break;
      }
    }
  }
  
  // 6. Extract 購售電號 (AI first, then regex fallback)
  let meterNumber = aiResult.meter_number;
  let meterNumberContext = aiResult.meter_number_context;
  
  if (!meterNumber && text) {
    for (const pattern of METER_NUMBER_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        meterNumber = match[1];
        const idx = text.indexOf(match[0]);
        meterNumberContext = text.slice(Math.max(0, idx - 20), idx + match[0].length + 20);
        console.log(`[OCR] Regex fallback found Meter Number: ${meterNumber}`);
        break;
      }
    }
  }
  
  // 7. Extract 實際裝置容量 (AI first, then regex fallback)
  let actualInstalledCapacity = aiResult.actual_installed_capacity;
  
  if (!actualInstalledCapacity && text) {
    for (const pattern of INSTALLED_CAPACITY_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        actualInstalledCapacity = parseFloat(match[1].replace(',', ''));
        console.log(`[OCR] Regex fallback found Installed Capacity: ${actualInstalledCapacity}`);
        break;
      }
    }
  }
  
  // 8. Extract 模組型號 (AI first, then regex fallback)
  let pvModuleModel = aiResult.pv_module_model;
  
  if (!pvModuleModel && text) {
    for (const pattern of PV_MODULE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        pvModuleModel = match[1];
        console.log(`[OCR] Regex fallback found PV Module Model: ${pvModuleModel}`);
        break;
      }
    }
  }
  
  // 9. Extract 變流器型號 (AI first, then regex fallback)
  let inverterModel = aiResult.inverter_model;
  
  if (!inverterModel && text) {
    for (const pattern of INVERTER_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        inverterModel = match[1];
        console.log(`[OCR] Regex fallback found Inverter Model: ${inverterModel}`);
        break;
      }
    }
  }
  
  // 10. Extract 單片瓦數和模組片數 (AI first, then regex fallback)
  let panelWattage = aiResult.panel_wattage;
  let panelCount = aiResult.panel_count;
  
  if ((!panelWattage || !panelCount) && text) {
    for (const pattern of PANEL_SPEC_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        if (!panelWattage) panelWattage = parseFloat(match[1].replace(',', ''));
        if (!panelCount) panelCount = parseInt(match[2]);
        console.log(`[OCR] Regex fallback found Panel Spec: ${panelWattage}kW x ${panelCount}`);
        break;
      }
    }
  }
  
  // 11. Extract 供電電壓 (AI first, then regex fallback)
  let powerVoltage = aiResult.power_voltage;
  
  if (!powerVoltage && text) {
    for (const pattern of POWER_VOLTAGE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        powerVoltage = match[1] || match[0];
        console.log(`[OCR] Regex fallback found Power Voltage: ${powerVoltage}`);
        break;
      }
    }
  }
  
  // 12. Extract 供電模式 (AI first, then regex fallback)
  let gridConnectionType = aiResult.grid_connection_type;
  
  if (!gridConnectionType && text) {
    const modes: string[] = [];
    for (const pattern of GRID_CONNECTION_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[1]) {
        modes.push(match[1]);
      }
    }
    if (modes.length > 0) {
      gridConnectionType = modes.join('，');
      console.log(`[OCR] Regex fallback found Grid Connection Type: ${gridConnectionType}`);
    }
  }
  
  return {
    dates: results,
    pvId,
    pvIdContext,
    energyPermitId,
    energyPermitIdContext,
    taipowerContractNo,
    taipowerContractNoContext,
    meterNumber,
    meterNumberContext,
    pvModuleModel,
    inverterModel,
    panelWattage,
    panelCount,
    actualInstalledCapacity,
    gridConnectionType,
    powerVoltage,
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

【文件類型與對應資訊】
請先判斷這是什麼類型的公文，再提取對應的資訊：

■ 審查意見書（台電發文）：
  - 可提取：送件日、核發日、台電 PV 編號
  - 台電 PV 編號格式：6位數字+PV+4位數字（如「120114PV0442」）
  - 常見位置：「本公司編號：」、「受理號碼：」、「公司編號：」

■ 同意備案（能源署發文）：
  - 可提取：送件日、核發日、能源署備案編號
  - 能源署備案編號格式：縣市代碼-年份PV流水號（如「YUN-114PV0349」、「CHA-114PV0456」）
  - 常見位置：「備案編號：」、「案件編號：」、主旨中的編號
  - ⚠️ 這不是台電 PV 編號！

■ 派員訪查函/購售電通知（台電發文）：
  - 可提取：送件日、核發日、掛表日
  - 可提取：契約編號、購售電號、實際裝置容量
  - 可提取：太陽光電模組型號、變流器型號
  - 可提取：單片瓦數、模組片數
  - 可提取：供電電壓、供電模式（全額躉售/餘電躉售）

■ 其他公文：
  - 提取所有可辨識的日期

【日期類型說明】

1. **送件日（submitted_at）**：申請人向政府提交申請的日期
   - 常見關鍵語句：
     * 「復台端 X年X月X日」- 「復」後面的日期就是送件日
     * 「復貴公司 X年X月X日」- 同上
     * 「依據貴公司 X年X月X日」
     * 「臺端於 X年X月X日申請」
     * 「收件日期：」、「申請日期：」、「受理日期：」
   - ⚠️ 注意：這不是「抄表日」或「併聯日」

2. **核發日（issued_at）**：政府機關發文的日期
   - 常見位置：
     * 「發文日期：中華民國 X年X月X日」
     * 公文右上角的日期
     * 審查章、核准章上蓋的日期（如「110.11.16」這種格式）

3. **掛表日（meter_date）**：太陽能電錶併聯運轉的日期（只有派員訪查函才有）
   - 常見關鍵語句：
     * 「併聯運轉日：」、「併聯日期：」
     * 「會同抄表日 X年X月X日為正式購售電能日」
     * 「自 X年X月X日起開始正式購售電能」

4. **台電 PV 編號（pv_id）**：只從「審查意見書」提取
   - 格式固定為：6位數字 + PV + 4位數字（純數字開頭）
     * 正確範例：「120114PV0442」、「108114PV0784」
   - 常見位置：「本公司編號：」、「受理號碼：」、「公司編號：」
   - ⚠️ 不要提取能源署備案編號（如「YUN-114PV0349」有英文開頭）

5. **能源署備案編號（energy_permit_id）**：只從「同意備案」公文提取
   - 格式固定為：縣市代碼 + 年份 + PV + 流水號（英文開頭）
     * 正確範例：「YUN-114PV0349」、「CHA-114PV0456」、「TPE-113PV0123」
   - 縣市代碼對照：YUN=雲林、CHA=彰化、TPE=台北、TPH=新北、TYC=桃園...
   - ⚠️ 這不是台電 PV 編號！

【派員訪查函/購售電通知專用欄位】

6. **契約編號（taipower_contract_no）**：台電簽約編號
   - 格式：區處代碼-PV-年份-流水號（如「08-PV-110-0205」）
   - 常見位置：主旨中「契約編號：」

7. **購售電號（meter_number）**：電錶購售電編號
   - 格式：區處代碼-年-流水號-表序（如「08-01-0200-16-9」）
   - 常見位置：「購售電號：」

8. **實際裝置容量（actual_installed_capacity）**：發電設備總裝置容量
   - 格式：數字 + 峰瓩/kWp（如「194.58峰瓩」）
   - 常見位置：「發電設備總裝置容量：」

9. **供電電壓（power_voltage）**：併接電壓
   - 常見值：「三相四線220/380V」、「三相三線11.4kV」
   - 常見位置：「併接方式：」

10. **供電模式（grid_connection_type）**：售電方式
    - 常見值：「全額躉售」、「餘電躉售」、「外線併聯」、「內線併聯」

11. **太陽光電模組型號（pv_module_model）**：模組品牌型號
    - 常見位置：「太陽光電模組：」

12. **變流器型號（inverter_model）**：變流器品牌型號
    - 常見位置：「變流器：」

13. **單片瓦數（panel_wattage）**與 **模組片數（panel_count）**
    - 常見格式：「0.345瓩*564片」
    - 常見位置：「發電設備機組序號：」

【重要規則】
- 請只分析「第一頁」的內容
- 日期可能是民國年份（如「114年11月21日」）或西元年份（如「2025-11-21」）
- 如果某個欄位在該類型文件中不適用或找不到，請不要填寫，不要猜測
- 請在 context 欄位說明是從什麼語句或位置提取的`;

  const userPrompt = docTitle 
    ? `請分析這份公文圖片「${docTitle}」，提取所有可辨識的日期和設備資訊。`
    : `請分析這份公文圖片，提取所有可辨識的日期和設備資訊。`;

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
              description: "台電 PV 編號（純數字開頭），格式固定為6位數字+PV+4位數字，如「120114PV0442」。注意：不是能源署備案編號（如 YUN-114PV0349）"
            },
            pv_id_context: {
              type: "string",
              description: "PV編號的上下文"
            },
            energy_permit_id: {
              type: "string",
              description: "能源署備案編號（英文開頭），格式為 縣市代碼-年份PV流水號，如「YUN-114PV0349」、「CHA-114PV0456」。只從同意備案公文提取"
            },
            energy_permit_id_context: {
              type: "string",
              description: "能源署備案編號的上下文"
            },
            taipower_contract_no: {
              type: "string",
              description: "契約編號，格式為 區處代碼-PV-年份-流水號，如「08-PV-110-0205」"
            },
            taipower_contract_no_context: {
              type: "string",
              description: "契約編號的上下文"
            },
            meter_number: {
              type: "string",
              description: "購售電號，格式為 區處代碼-年-流水號-表序，如「08-01-0200-16-9」"
            },
            meter_number_context: {
              type: "string",
              description: "購售電號的上下文"
            },
            actual_installed_capacity: {
              type: "number",
              description: "實際裝置容量（kWp），如 194.58"
            },
            power_voltage: {
              type: "string",
              description: "供電電壓，如「三相四線220/380V」"
            },
            grid_connection_type: {
              type: "string",
              description: "供電模式/併接方式，如「全額躉售」、「外線併聯」"
            },
            pv_module_model: {
              type: "string",
              description: "太陽光電模組型號，如「URE D2K345H7A」"
            },
            inverter_model: {
              type: "string",
              description: "變流器型號，如「Solaredge SE33.3K」"
            },
            panel_wattage: {
              type: "number",
              description: "單片瓦數（kW），如 0.345"
            },
            panel_count: {
              type: "integer",
              description: "模組片數，如 564"
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
          console.log('[OCR] Auto-updated project with PV ID:', extractedData.pvId);
        }
      }
      
      // Auto-update energy permit ID
      if (extractedData.energyPermitId) {
        const { data: docData } = await supabase
          .from('documents')
          .select('project_id')
          .eq('id', documentId)
          .single();
        
        if (docData?.project_id) {
          await supabase
            .from('projects')
            .update({ energy_permit_id: extractedData.energyPermitId })
            .eq('id', docData.project_id);
          console.log('[OCR] Auto-updated project with Energy Permit ID:', extractedData.energyPermitId);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        extractedDates: extractedData.dates,
        pvId: extractedData.pvId,
        pvIdContext: extractedData.pvIdContext,
        energyPermitId: extractedData.energyPermitId,
        energyPermitIdContext: extractedData.energyPermitIdContext,
        taipowerContractNo: extractedData.taipowerContractNo,
        taipowerContractNoContext: extractedData.taipowerContractNoContext,
        meterNumber: extractedData.meterNumber,
        meterNumberContext: extractedData.meterNumberContext,
        actualInstalledCapacity: extractedData.actualInstalledCapacity,
        powerVoltage: extractedData.powerVoltage,
        gridConnectionType: extractedData.gridConnectionType,
        pvModuleModel: extractedData.pvModuleModel,
        inverterModel: extractedData.inverterModel,
        panelWattage: extractedData.panelWattage,
        panelCount: extractedData.panelCount,
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
