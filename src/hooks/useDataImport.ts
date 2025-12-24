import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';
import type { ImportRowResult, ImportResult } from '@/components/ImportConstraintsInfo';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type InvestorInsert = Database['public']['Tables']['investors']['Insert'];
type InvestorContactInsert = Database['public']['Tables']['investor_contacts']['Insert'];
type InvestorPaymentMethodInsert = Database['public']['Tables']['investor_payment_methods']['Insert'];
type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
type ProjectStatus = Database['public']['Enums']['project_status'];
type DocType = Database['public']['Enums']['doc_type'];
type DocStatus = Database['public']['Enums']['doc_status'];
type PaymentMethodType = Database['public']['Enums']['payment_method_type'];
type ContactRoleTag = Database['public']['Enums']['contact_role_tag'];

export type ImportStrategy = 'skip' | 'update' | 'insert_only';

export interface ImportPreview<T> {
  data: T[];
  errors: { row: number; message: string }[];
  duplicates: { row: number; existingId: string; code: string }[];
}

// Extended types for import mapping
type ProjectInsertWithInvestor = ProjectInsert & { investor_name?: string; _rowIndex?: number };
type DocumentInsertWithProject = DocumentInsert & { project_code?: string; project_name?: string; owner_name?: string; _rowIndex?: number };
type InvestorContactInsertWithCode = InvestorContactInsert & { investor_code?: string; investor_name?: string; _rowIndex?: number };
type InvestorPaymentMethodInsertWithCode = InvestorPaymentMethodInsert & { investor_code?: string; investor_name?: string; _rowIndex?: number };
type InvestorInsertWithRow = InvestorInsert & { _rowIndex?: number };

// Column mappings
const projectColumnMap: Record<string, keyof ProjectInsertWithInvestor> = {
  '案場編號': 'project_code',
  '案場名稱': 'project_name',
  '投資方': 'investor_name',
  '狀態': 'status',
  '容量(kWp)': 'capacity_kwp',
  '饋線代號': 'feeder_code',
  '縣市': 'city',
  '鄉鎮區': 'district',
  '地址': 'address',
  '座標': 'coordinates',
  '地主': 'land_owner',
  '地主聯絡方式': 'land_owner_contact',
  '聯絡人': 'contact_person',
  '聯絡電話': 'contact_phone',
  '年度': 'fiscal_year',
  '備註': 'note',
};

const investorColumnMap: Record<string, keyof InvestorInsertWithRow> = {
  '投資方編號': 'investor_code',
  '公司名稱': 'company_name',
  '投資方類型': 'investor_type',
  '負責人': 'owner_name',
  '負責人職稱': 'owner_title',
  '統一編號': 'tax_id',
  '聯絡人': 'contact_person',
  '電話': 'phone',
  'Email': 'email',
  '地址': 'address',
  '備註': 'note',
};

const investorContactColumnMap: Record<string, keyof InvestorContactInsertWithCode> = {
  '投資方編號': 'investor_code',
  '投資方名稱': 'investor_name',
  '聯絡人姓名': 'contact_name',
  '職稱': 'title',
  '部門': 'department',
  '電話': 'phone',
  '手機': 'mobile',
  'Email': 'email',
  'LINE ID': 'line_id',
  '角色標籤': 'role_tags',
  '主要聯絡人': 'is_primary',
  '啟用': 'is_active',
  '備註': 'note',
};

const investorPaymentMethodColumnMap: Record<string, keyof InvestorPaymentMethodInsertWithCode> = {
  '投資方編號': 'investor_code',
  '投資方名稱': 'investor_name',
  '付款方式': 'method_type',
  '銀行名稱': 'bank_name',
  '銀行代碼': 'bank_code',
  '分行名稱': 'branch_name',
  '戶名': 'account_name',
  '帳號': 'account_number',
  '預設': 'is_default',
  '備註': 'note',
};

const documentColumnMap: Record<string, keyof DocumentInsertWithProject> = {
  '案場編號': 'project_code',
  '案場名稱': 'project_name',
  '文件類型': 'doc_type',
  '狀態': 'doc_status',
  '送件日': 'submitted_at',
  '核發日': 'issued_at',
  '到期日': 'due_at',
  '負責人': 'owner_name',
  '備註': 'note',
};

function parseFile(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Use cellDates: true to auto-convert Excel date serial numbers
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // Use raw: false and dateNF to ensure dates are formatted consistently
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
        resolve(jsonData as Record<string, any>[]);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('檔案讀取失敗'));
    reader.readAsBinaryString(file);
  });
}

// Parse various date formats including YYYY/M/D, YYYY-MM-DD, Excel serial numbers
function parseDate(value: any): string | null {
  if (!value || value === '' || value === null || value === undefined) return null;
  
  // If it's already a Date object
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }
  
  const strValue = String(value).trim();
  if (!strValue) return null;
  
  // Try Excel serial number (number like 43831)
  const numValue = Number(strValue);
  if (!isNaN(numValue) && numValue > 1000 && numValue < 100000) {
    // Excel serial date: days since 1899-12-30
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // Try YYYY/M/D or YYYY-M-D format
  const slashMatch = strValue.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (slashMatch) {
    const [, year, month, day] = slashMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // Try D/M/YYYY format
  const dmyMatch = strValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // Try ISO format or other formats
  const date = new Date(strValue);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

function mapRowToProject(row: Record<string, any>, rowIndex: number): Partial<ProjectInsertWithInvestor> {
  const mapped: Partial<ProjectInsertWithInvestor> = { _rowIndex: rowIndex };
  Object.entries(row).forEach(([key, value]) => {
    const mappedKey = projectColumnMap[key.trim()];
    if (mappedKey && value !== '' && value !== null && value !== undefined) {
      if (mappedKey === 'capacity_kwp' || mappedKey === 'fiscal_year') {
        const num = Number(value);
        if (!isNaN(num)) (mapped as any)[mappedKey] = num;
      } else {
        (mapped as any)[mappedKey] = String(value).trim();
      }
    }
  });
  return mapped;
}

function mapRowToInvestor(row: Record<string, any>, rowIndex: number): Partial<InvestorInsertWithRow> {
  const mapped: Partial<InvestorInsertWithRow> = { _rowIndex: rowIndex };
  Object.entries(row).forEach(([key, value]) => {
    const mappedKey = investorColumnMap[key.trim()];
    if (mappedKey && value !== '' && value !== null && value !== undefined) {
      (mapped as any)[mappedKey] = String(value).trim();
    }
  });
  return mapped;
}

function mapRowToInvestorContact(row: Record<string, any>, rowIndex: number): Partial<InvestorContactInsertWithCode> {
  const mapped: Partial<InvestorContactInsertWithCode> = { _rowIndex: rowIndex };
  Object.entries(row).forEach(([key, value]) => {
    const mappedKey = investorContactColumnMap[key.trim()];
    if (mappedKey && value !== '' && value !== null && value !== undefined) {
      if (mappedKey === 'role_tags') {
        const tags = String(value).split(',').map(t => t.trim()).filter(Boolean);
        (mapped as any)[mappedKey] = tags as ContactRoleTag[];
      } else if (mappedKey === 'is_primary' || mappedKey === 'is_active') {
        (mapped as any)[mappedKey] = value === '是' || value === 'true' || value === true;
      } else {
        (mapped as any)[mappedKey] = String(value).trim();
      }
    }
  });
  return mapped;
}

function mapRowToInvestorPaymentMethod(row: Record<string, any>, rowIndex: number): Partial<InvestorPaymentMethodInsertWithCode> {
  const mapped: Partial<InvestorPaymentMethodInsertWithCode> = { _rowIndex: rowIndex };
  Object.entries(row).forEach(([key, value]) => {
    const mappedKey = investorPaymentMethodColumnMap[key.trim()];
    if (mappedKey && value !== '' && value !== null && value !== undefined) {
      if (mappedKey === 'is_default') {
        (mapped as any)[mappedKey] = value === '是' || value === 'true' || value === true;
      } else {
        (mapped as any)[mappedKey] = String(value).trim();
      }
    }
  });
  return mapped;
}

function mapRowToDocument(row: Record<string, any>, rowIndex: number): Partial<DocumentInsertWithProject> {
  const mapped: Partial<DocumentInsertWithProject> = { _rowIndex: rowIndex };
  Object.entries(row).forEach(([key, value]) => {
    const mappedKey = documentColumnMap[key.trim()];
    if (mappedKey && value !== '' && value !== null && value !== undefined) {
      if (mappedKey === 'submitted_at' || mappedKey === 'issued_at' || mappedKey === 'due_at') {
        const parsedDate = parseDate(value);
        if (parsedDate) {
          (mapped as any)[mappedKey] = parsedDate;
        }
      } else {
        (mapped as any)[mappedKey] = String(value).trim();
      }
    }
  });
  return mapped;
}

function validateProject(data: Partial<ProjectInsertWithInvestor>, rowIndex: number, validStatuses: string[]): string | null {
  if (!data.project_code) return `第 ${rowIndex} 行：缺少案場編號`;
  if (!data.project_name) return `第 ${rowIndex} 行：缺少案場名稱`;
  if (data.status && validStatuses.length > 0 && !validStatuses.includes(data.status as string)) {
    return `第 ${rowIndex} 行：無效的狀態「${data.status}」`;
  }
  return null;
}

function validateInvestor(data: Partial<InvestorInsertWithRow>, rowIndex: number): string | null {
  if (!data.investor_code) return `第 ${rowIndex} 行：缺少投資方編號`;
  if (!data.company_name) return `第 ${rowIndex} 行：缺少公司名稱`;
  return null;
}

function validateInvestorContact(data: Partial<InvestorContactInsertWithCode>, rowIndex: number): string | null {
  if (!data.investor_code) return `第 ${rowIndex} 行：缺少投資方編號`;
  if (!data.contact_name) return `第 ${rowIndex} 行：缺少聯絡人姓名`;
  return null;
}

function validateInvestorPaymentMethod(data: Partial<InvestorPaymentMethodInsertWithCode>, rowIndex: number, validMethodTypes: string[]): string | null {
  if (!data.investor_code) return `第 ${rowIndex} 行：缺少投資方編號`;
  if (!data.method_type) return `第 ${rowIndex} 行：缺少付款方式`;
  if (validMethodTypes.length > 0 && !validMethodTypes.includes(data.method_type as string)) {
    return `第 ${rowIndex} 行：無效的付款方式「${data.method_type}」`;
  }
  return null;
}

function validateDocument(data: Partial<DocumentInsertWithProject>, rowIndex: number, validDocTypes: string[], validDocStatuses: string[]): string | null {
  if (!data.project_code) return `第 ${rowIndex} 行：缺少案場編號`;
  if (!data.doc_type) return `第 ${rowIndex} 行：缺少文件類型`;
  if (data.doc_type && validDocTypes.length > 0 && !validDocTypes.includes(data.doc_type as string)) {
    return `第 ${rowIndex} 行：無效的文件類型「${data.doc_type}」`;
  }
  if (data.doc_status && validDocStatuses.length > 0 && !validDocStatuses.includes(data.doc_status as string)) {
    return `第 ${rowIndex} 行：無效的狀態「${data.doc_status}」`;
  }
  return null;
}

// Parse Postgres error to get meaningful error info
function parsePostgresError(error: any, row: number, code: string): ImportRowResult {
  const errorMessage = error?.message || error?.toString() || '未知錯誤';
  const errorCode = error?.code;
  
  // Unique constraint violation
  if (errorCode === '23505' || errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
    const match = errorMessage.match(/Key \(([^)]+)\)/);
    const field = match ? match[1] : undefined;
    return {
      row,
      status: 'error',
      code,
      message: `唯一鍵衝突：${field || '資料已存在'}`,
      errorType: 'unique_constraint',
      field,
    };
  }
  
  // Foreign key violation
  if (errorCode === '23503' || errorMessage.includes('foreign key') || errorMessage.includes('violates foreign key')) {
    const match = errorMessage.match(/Key \(([^)]+)\)/);
    const field = match ? match[1] : undefined;
    return {
      row,
      status: 'error',
      code,
      message: `外鍵關聯錯誤：參照的資料不存在`,
      errorType: 'foreign_key',
      field,
    };
  }
  
  // Data type error
  if (errorCode === '22P02' || errorMessage.includes('invalid input syntax')) {
    return {
      row,
      status: 'error',
      code,
      message: `資料格式錯誤：${errorMessage}`,
      errorType: 'data_type',
    };
  }
  
  // Not null violation
  if (errorCode === '23502' || errorMessage.includes('null value') || errorMessage.includes('not-null constraint')) {
    const match = errorMessage.match(/column "([^"]+)"/);
    const field = match ? match[1] : undefined;
    return {
      row,
      status: 'error',
      code,
      message: `必填欄位遺漏：${field || '未知欄位'}`,
      errorType: 'validation',
      field,
    };
  }
  
  return {
    row,
    status: 'error',
    code,
    message: errorMessage,
    errorType: 'unknown',
  };
}

export function useDataImport() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [projectPreview, setProjectPreview] = useState<ImportPreview<Partial<ProjectInsertWithInvestor>> | null>(null);
  const [investorPreview, setInvestorPreview] = useState<ImportPreview<Partial<InvestorInsertWithRow>> | null>(null);
  const [investorContactPreview, setInvestorContactPreview] = useState<ImportPreview<Partial<InvestorContactInsertWithCode>> | null>(null);
  const [investorPaymentMethodPreview, setInvestorPaymentMethodPreview] = useState<ImportPreview<Partial<InvestorPaymentMethodInsertWithCode>> | null>(null);
  const [documentPreview, setDocumentPreview] = useState<ImportPreview<Partial<DocumentInsertWithProject>> | null>(null);

  const previewProjects = useCallback(async (file: File): Promise<ImportPreview<Partial<ProjectInsertWithInvestor>>> => {
    setIsProcessing(true);
    try {
      const rawData = await parseFile(file);
      if (rawData.length === 0) throw new Error('檔案中沒有資料');

      const { data: statusOptions } = await supabase.from('system_options').select('value').eq('category', 'project_status').eq('is_active', true);
      const validStatuses = statusOptions?.map(opt => opt.value) || [];

      const { data: investors } = await supabase.from('investors').select('id, company_name');
      const investorMap = new Map(investors?.map(inv => [inv.company_name, inv.id]) || []);

      const mappedData: Partial<ProjectInsertWithInvestor>[] = [];
      const errors: { row: number; message: string }[] = [];

      rawData.forEach((row, index) => {
        const rowIndex = index + 2; // Excel row (1-indexed, plus header)
        const mapped = mapRowToProject(row, rowIndex);
        const error = validateProject(mapped, rowIndex, validStatuses);
        if (error) {
          errors.push({ row: rowIndex, message: error });
        } else {
          if (mapped.investor_name) {
            const investorId = investorMap.get(mapped.investor_name);
            if (investorId) {
              mapped.investor_id = investorId;
            } else {
              errors.push({ row: rowIndex, message: `第 ${rowIndex} 行：找不到投資方「${mapped.investor_name}」` });
              return;
            }
          }
          mappedData.push(mapped);
        }
      });

      const codes = mappedData.map(d => d.project_code).filter(Boolean) as string[];
      const { data: existingProjects } = await supabase.from('projects').select('id, project_code').in('project_code', codes);

      const duplicates = (existingProjects || []).map(existing => {
        const dataIndex = mappedData.findIndex(d => d.project_code === existing.project_code);
        const rowIndex = mappedData[dataIndex]?._rowIndex || dataIndex + 2;
        return { row: rowIndex, existingId: existing.id, code: existing.project_code };
      });

      const preview = { data: mappedData, errors, duplicates };
      setProjectPreview(preview);
      return preview;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const previewInvestors = useCallback(async (file: File): Promise<ImportPreview<Partial<InvestorInsertWithRow>>> => {
    setIsProcessing(true);
    try {
      const rawData = await parseFile(file);
      if (rawData.length === 0) throw new Error('檔案中沒有資料');

      const mappedData: Partial<InvestorInsertWithRow>[] = [];
      const errors: { row: number; message: string }[] = [];

      rawData.forEach((row, index) => {
        const rowIndex = index + 2;
        const mapped = mapRowToInvestor(row, rowIndex);
        const error = validateInvestor(mapped, rowIndex);
        if (error) {
          errors.push({ row: rowIndex, message: error });
        } else {
          mappedData.push(mapped);
        }
      });

      const codes = mappedData.map(d => d.investor_code).filter(Boolean) as string[];
      const { data: existingInvestors } = await supabase.from('investors').select('id, investor_code').in('investor_code', codes);

      const duplicates = (existingInvestors || []).map(existing => {
        const dataIndex = mappedData.findIndex(d => d.investor_code?.toUpperCase() === existing.investor_code.toUpperCase());
        const rowIndex = mappedData[dataIndex]?._rowIndex || dataIndex + 2;
        return { row: rowIndex, existingId: existing.id, code: existing.investor_code };
      });

      const preview = { data: mappedData, errors, duplicates };
      setInvestorPreview(preview);
      return preview;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const previewInvestorContacts = useCallback(async (file: File): Promise<ImportPreview<Partial<InvestorContactInsertWithCode>>> => {
    setIsProcessing(true);
    try {
      const rawData = await parseFile(file);
      if (rawData.length === 0) throw new Error('檔案中沒有資料');

      const { data: investors } = await supabase.from('investors').select('id, investor_code');
      const investorMap = new Map(investors?.map(inv => [inv.investor_code, inv.id]) || []);

      const mappedData: Partial<InvestorContactInsertWithCode>[] = [];
      const errors: { row: number; message: string }[] = [];

      rawData.forEach((row, index) => {
        const rowIndex = index + 2;
        const mapped = mapRowToInvestorContact(row, rowIndex);
        const error = validateInvestorContact(mapped, rowIndex);
        if (error) {
          errors.push({ row: rowIndex, message: error });
        } else {
          if (mapped.investor_code) {
            const investorId = investorMap.get(mapped.investor_code.toUpperCase());
            if (investorId) {
              mapped.investor_id = investorId;
            } else {
              errors.push({ row: rowIndex, message: `第 ${rowIndex} 行：找不到投資方編號「${mapped.investor_code}」` });
              return;
            }
          }
          mappedData.push(mapped);
        }
      });

      const duplicates: { row: number; existingId: string; code: string }[] = [];
      for (let i = 0; i < mappedData.length; i++) {
        const d = mappedData[i];
        if (d.investor_id && d.contact_name) {
          const { data: existing } = await supabase
            .from('investor_contacts')
            .select('id')
            .eq('investor_id', d.investor_id)
            .eq('contact_name', d.contact_name)
            .maybeSingle();
          if (existing) {
            duplicates.push({ row: d._rowIndex || i + 2, existingId: existing.id, code: `${d.investor_code}-${d.contact_name}` });
          }
        }
      }

      const preview = { data: mappedData, errors, duplicates };
      setInvestorContactPreview(preview);
      return preview;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const previewInvestorPaymentMethods = useCallback(async (file: File): Promise<ImportPreview<Partial<InvestorPaymentMethodInsertWithCode>>> => {
    setIsProcessing(true);
    try {
      const rawData = await parseFile(file);
      if (rawData.length === 0) throw new Error('檔案中沒有資料');

      const validMethodTypes = ['銀行轉帳', '支票', '現金', '信用卡', '其他'];

      const { data: investors } = await supabase.from('investors').select('id, investor_code');
      const investorMap = new Map(investors?.map(inv => [inv.investor_code, inv.id]) || []);

      const mappedData: Partial<InvestorPaymentMethodInsertWithCode>[] = [];
      const errors: { row: number; message: string }[] = [];

      rawData.forEach((row, index) => {
        const rowIndex = index + 2;
        const mapped = mapRowToInvestorPaymentMethod(row, rowIndex);
        const error = validateInvestorPaymentMethod(mapped, rowIndex, validMethodTypes);
        if (error) {
          errors.push({ row: rowIndex, message: error });
        } else {
          if (mapped.investor_code) {
            const investorId = investorMap.get(mapped.investor_code.toUpperCase());
            if (investorId) {
              mapped.investor_id = investorId;
            } else {
              errors.push({ row: rowIndex, message: `第 ${rowIndex} 行：找不到投資方編號「${mapped.investor_code}」` });
              return;
            }
          }
          mappedData.push(mapped);
        }
      });

      const duplicates: { row: number; existingId: string; code: string }[] = [];
      for (let i = 0; i < mappedData.length; i++) {
        const d = mappedData[i];
        if (d.investor_id && d.method_type) {
          let query = supabase
            .from('investor_payment_methods')
            .select('id')
            .eq('investor_id', d.investor_id)
            .eq('method_type', d.method_type as PaymentMethodType);
          if (d.account_number) {
            query = query.eq('account_number', d.account_number);
          }
          const { data: existing } = await query.maybeSingle();
          if (existing) {
            duplicates.push({ row: d._rowIndex || i + 2, existingId: existing.id, code: `${d.investor_code}-${d.method_type}` });
          }
        }
      }

      const preview = { data: mappedData, errors, duplicates };
      setInvestorPaymentMethodPreview(preview);
      return preview;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const previewDocuments = useCallback(async (file: File): Promise<ImportPreview<Partial<DocumentInsertWithProject>>> => {
    setIsProcessing(true);
    try {
      const rawData = await parseFile(file);
      if (rawData.length === 0) throw new Error('檔案中沒有資料');

      // Fetch all required data in parallel for performance
      const [docTypeResult, docStatusResult, projectsResult, existingDocsResult] = await Promise.all([
        supabase.from('system_options').select('value').eq('category', 'doc_type').eq('is_active', true),
        supabase.from('system_options').select('value').eq('category', 'doc_status').eq('is_active', true),
        supabase.from('projects').select('id, project_code'),
        supabase.from('documents').select('id, project_id, doc_type'),
      ]);
      
      const validDocTypes = docTypeResult.data?.map(opt => opt.value) || [];
      const validDocStatuses = docStatusResult.data?.map(opt => opt.value) || [];
      const projectMap = new Map(projectsResult.data?.map(p => [p.project_code, p.id]) || []);
      
      // Build a map of existing documents: "project_id-doc_type" -> document id
      const existingDocsMap = new Map<string, string>();
      existingDocsResult.data?.forEach(doc => {
        const key = `${doc.project_id}-${doc.doc_type}`;
        existingDocsMap.set(key, doc.id);
      });

      const mappedData: Partial<DocumentInsertWithProject>[] = [];
      const errors: { row: number; message: string }[] = [];

      rawData.forEach((row, index) => {
        const rowIndex = index + 2;
        const mapped = mapRowToDocument(row, rowIndex);
        
        // Skip validation if validDocTypes is empty (no options defined yet)
        const error = validateDocument(mapped, rowIndex, validDocTypes, validDocStatuses);
        if (error) {
          errors.push({ row: rowIndex, message: error });
        } else {
          if (mapped.project_code) {
            const projectId = projectMap.get(mapped.project_code);
            if (projectId) {
              mapped.project_id = projectId;
            } else {
              errors.push({ row: rowIndex, message: `第 ${rowIndex} 行：找不到案場「${mapped.project_code}」` });
              return;
            }
          }
          mappedData.push(mapped);
        }
      });

      // Find duplicates using the pre-built map (no more row-by-row queries)
      const duplicates: { row: number; existingId: string; code: string }[] = [];
      mappedData.forEach((d, i) => {
        if (d.project_id && d.doc_type) {
          const key = `${d.project_id}-${d.doc_type}`;
          const existingId = existingDocsMap.get(key);
          if (existingId) {
            duplicates.push({ 
              row: d._rowIndex || i + 2, 
              existingId, 
              code: `${d.project_code}-${d.doc_type}` 
            });
          }
        }
      });

      const preview = { data: mappedData, errors, duplicates };
      setDocumentPreview(preview);
      return preview;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Generic import function with row-by-row processing
  const importProjects = useCallback(async (
    data: Partial<ProjectInsertWithInvestor>[],
    strategy: ImportStrategy,
    duplicates: { row: number; existingId: string; code: string }[]
  ): Promise<ImportResult> => {
    setIsProcessing(true);
    const rowResults: ImportRowResult[] = [];
    let inserted = 0, updated = 0, skipped = 0, errors = 0;

    try {
      const duplicateCodes = new Set(duplicates.map(d => d.code));

      for (const record of data) {
        const rowIndex = record._rowIndex || 0;
        const code = record.project_code || '';
        const isDuplicate = duplicateCodes.has(code);

        // Handle based on strategy
        if (isDuplicate) {
          if (strategy === 'insert_only') {
            rowResults.push({
              row: rowIndex,
              status: 'error',
              code,
              message: '唯一鍵衝突：案場編號已存在',
              errorType: 'unique_constraint',
              field: 'project_code',
            });
            errors++;
            continue;
          } else if (strategy === 'skip') {
            rowResults.push({ row: rowIndex, status: 'skipped', code, message: '略過：資料已存在' });
            skipped++;
            continue;
          } else if (strategy === 'update') {
            const existing = duplicates.find(d => d.code === code);
            if (existing) {
              try {
                const { investor_name, _rowIndex, ...dbRecord } = record;
                const { error } = await supabase.from('projects').update(dbRecord).eq('id', existing.existingId);
                if (error) throw error;
                rowResults.push({ row: rowIndex, status: 'success', code, message: '更新成功' });
                updated++;
              } catch (err) {
                const result = parsePostgresError(err, rowIndex, code);
                rowResults.push(result);
                errors++;
              }
            }
            continue;
          }
        }

        // Insert new record
        try {
          const { investor_name, _rowIndex, ...dbRecord } = record;
          const { error } = await supabase.from('projects').insert({
            ...dbRecord,
            created_by: user?.id,
            status: (dbRecord.status as ProjectStatus) || '開發中',
          } as ProjectInsert);
          if (error) throw error;
          rowResults.push({ row: rowIndex, status: 'success', code, message: '新增成功' });
          inserted++;
        } catch (err) {
          const result = parsePostgresError(err, rowIndex, code);
          rowResults.push(result);
          errors++;
        }
      }

      setProjectPreview(null);
      return { inserted, updated, skipped, errors, rowResults };
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const importInvestors = useCallback(async (
    data: Partial<InvestorInsertWithRow>[],
    strategy: ImportStrategy,
    duplicates: { row: number; existingId: string; code: string }[]
  ): Promise<ImportResult> => {
    setIsProcessing(true);
    const rowResults: ImportRowResult[] = [];
    let inserted = 0, updated = 0, skipped = 0, errors = 0;

    try {
      const duplicateCodes = new Set(duplicates.map(d => d.code.toUpperCase()));

      for (const record of data) {
        const rowIndex = record._rowIndex || 0;
        const code = record.investor_code || '';
        const isDuplicate = duplicateCodes.has(code.toUpperCase());

        if (isDuplicate) {
          if (strategy === 'insert_only') {
            rowResults.push({
              row: rowIndex,
              status: 'error',
              code,
              message: '唯一鍵衝突：投資方編號已存在',
              errorType: 'unique_constraint',
              field: 'investor_code',
            });
            errors++;
            continue;
          } else if (strategy === 'skip') {
            rowResults.push({ row: rowIndex, status: 'skipped', code, message: '略過：資料已存在' });
            skipped++;
            continue;
          } else if (strategy === 'update') {
            const existing = duplicates.find(d => d.code.toUpperCase() === code.toUpperCase());
            if (existing) {
              try {
                const { _rowIndex, ...dbRecord } = record;
                const { error } = await supabase.from('investors').update(dbRecord).eq('id', existing.existingId);
                if (error) throw error;
                rowResults.push({ row: rowIndex, status: 'success', code, message: '更新成功' });
                updated++;
              } catch (err) {
                const result = parsePostgresError(err, rowIndex, code);
                rowResults.push(result);
                errors++;
              }
            }
            continue;
          }
        }

        try {
          const { _rowIndex, ...dbRecord } = record;
          const { error } = await supabase.from('investors').insert({
            ...dbRecord,
            created_by: user?.id,
          } as InvestorInsert);
          if (error) throw error;
          rowResults.push({ row: rowIndex, status: 'success', code, message: '新增成功' });
          inserted++;
        } catch (err) {
          const result = parsePostgresError(err, rowIndex, code);
          rowResults.push(result);
          errors++;
        }
      }

      setInvestorPreview(null);
      return { inserted, updated, skipped, errors, rowResults };
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const importInvestorContacts = useCallback(async (
    data: Partial<InvestorContactInsertWithCode>[],
    strategy: ImportStrategy,
    duplicates: { row: number; existingId: string; code: string }[]
  ): Promise<ImportResult> => {
    setIsProcessing(true);
    const rowResults: ImportRowResult[] = [];
    let inserted = 0, updated = 0, skipped = 0, errors = 0;

    try {
      const duplicateCodes = new Set(duplicates.map(d => d.code));

      for (const record of data) {
        const rowIndex = record._rowIndex || 0;
        const code = `${record.investor_code}-${record.contact_name}`;
        const isDuplicate = duplicateCodes.has(code);

        if (isDuplicate) {
          if (strategy === 'insert_only') {
            rowResults.push({
              row: rowIndex,
              status: 'error',
              code,
              message: '唯一鍵衝突：此投資方已有同名聯絡人',
              errorType: 'unique_constraint',
              field: 'investor_id, contact_name',
            });
            errors++;
            continue;
          } else if (strategy === 'skip') {
            rowResults.push({ row: rowIndex, status: 'skipped', code, message: '略過：資料已存在' });
            skipped++;
            continue;
          } else if (strategy === 'update') {
            const existing = duplicates.find(d => d.code === code);
            if (existing) {
              try {
                const { investor_code, investor_name, _rowIndex, ...dbRecord } = record;
                const { error } = await supabase.from('investor_contacts').update(dbRecord).eq('id', existing.existingId);
                if (error) throw error;
                rowResults.push({ row: rowIndex, status: 'success', code, message: '更新成功' });
                updated++;
              } catch (err) {
                const result = parsePostgresError(err, rowIndex, code);
                rowResults.push(result);
                errors++;
              }
            }
            continue;
          }
        }

        try {
          const { investor_code, investor_name, _rowIndex, ...dbRecord } = record;
          const { error } = await supabase.from('investor_contacts').insert({
            ...dbRecord,
            created_by: user?.id,
          } as InvestorContactInsert);
          if (error) throw error;
          rowResults.push({ row: rowIndex, status: 'success', code, message: '新增成功' });
          inserted++;
        } catch (err) {
          const result = parsePostgresError(err, rowIndex, code);
          rowResults.push(result);
          errors++;
        }
      }

      setInvestorContactPreview(null);
      return { inserted, updated, skipped, errors, rowResults };
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const importInvestorPaymentMethods = useCallback(async (
    data: Partial<InvestorPaymentMethodInsertWithCode>[],
    strategy: ImportStrategy,
    duplicates: { row: number; existingId: string; code: string }[]
  ): Promise<ImportResult> => {
    setIsProcessing(true);
    const rowResults: ImportRowResult[] = [];
    let inserted = 0, updated = 0, skipped = 0, errors = 0;

    try {
      const duplicateCodes = new Set(duplicates.map(d => d.code));

      for (const record of data) {
        const rowIndex = record._rowIndex || 0;
        const code = `${record.investor_code}-${record.method_type}`;
        const isDuplicate = duplicateCodes.has(code);

        if (isDuplicate) {
          if (strategy === 'insert_only') {
            rowResults.push({
              row: rowIndex,
              status: 'error',
              code,
              message: '唯一鍵衝突：此投資方已有相同付款方式',
              errorType: 'unique_constraint',
              field: 'investor_id, method_type, account_number',
            });
            errors++;
            continue;
          } else if (strategy === 'skip') {
            rowResults.push({ row: rowIndex, status: 'skipped', code, message: '略過：資料已存在' });
            skipped++;
            continue;
          } else if (strategy === 'update') {
            const existing = duplicates.find(d => d.code === code);
            if (existing) {
              try {
                const { investor_code, investor_name, _rowIndex, ...dbRecord } = record;
                const { error } = await supabase.from('investor_payment_methods').update(dbRecord).eq('id', existing.existingId);
                if (error) throw error;
                rowResults.push({ row: rowIndex, status: 'success', code, message: '更新成功' });
                updated++;
              } catch (err) {
                const result = parsePostgresError(err, rowIndex, code);
                rowResults.push(result);
                errors++;
              }
            }
            continue;
          }
        }

        try {
          const { investor_code, investor_name, _rowIndex, ...dbRecord } = record;
          const { error } = await supabase.from('investor_payment_methods').insert({
            ...dbRecord,
            created_by: user?.id,
          } as InvestorPaymentMethodInsert);
          if (error) throw error;
          rowResults.push({ row: rowIndex, status: 'success', code, message: '新增成功' });
          inserted++;
        } catch (err) {
          const result = parsePostgresError(err, rowIndex, code);
          rowResults.push(result);
          errors++;
        }
      }

      setInvestorPaymentMethodPreview(null);
      return { inserted, updated, skipped, errors, rowResults };
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const importDocuments = useCallback(async (
    data: Partial<DocumentInsertWithProject>[],
    strategy: ImportStrategy,
    duplicates: { row: number; existingId: string; code: string }[]
  ): Promise<ImportResult> => {
    setIsProcessing(true);
    const rowResults: ImportRowResult[] = [];
    let inserted = 0, updated = 0, skipped = 0, errors = 0;

    try {
      const duplicateCodes = new Set(duplicates.map(d => d.code));
      const duplicateMap = new Map(duplicates.map(d => [d.code, d]));
      
      // Separate records into: to insert, to update, to skip, to error
      const toInsert: { record: Partial<DocumentInsertWithProject>; rowIndex: number; code: string }[] = [];
      const toUpdate: { record: Partial<DocumentInsertWithProject>; rowIndex: number; code: string; existingId: string }[] = [];

      for (const record of data) {
        const rowIndex = record._rowIndex || 0;
        const code = `${record.project_code}-${record.doc_type}`;
        const isDuplicate = duplicateCodes.has(code);

        if (isDuplicate) {
          if (strategy === 'insert_only') {
            rowResults.push({
              row: rowIndex,
              status: 'error',
              code,
              message: '唯一鍵衝突：此案場已有相同類型文件',
              errorType: 'unique_constraint',
              field: 'project_id, doc_type',
            });
            errors++;
          } else if (strategy === 'skip') {
            rowResults.push({ row: rowIndex, status: 'skipped', code, message: '略過：資料已存在' });
            skipped++;
          } else if (strategy === 'update') {
            const existing = duplicateMap.get(code);
            if (existing) {
              toUpdate.push({ record, rowIndex, code, existingId: existing.existingId });
            }
          }
        } else {
          toInsert.push({ record, rowIndex, code });
        }
      }

      // Batch insert new records (in chunks of 100 to avoid payload limits)
      const BATCH_SIZE = 100;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const insertRecords = batch.map(({ record }) => {
          const { project_code, project_name, owner_name, _rowIndex, ...dbRecord } = record;
          return {
            ...dbRecord,
            created_by: user?.id,
            doc_status: (dbRecord.doc_status as DocStatus) || '未開始',
          } as DocumentInsert;
        });

        try {
          const { error } = await supabase.from('documents').insert(insertRecords);
          if (error) {
            // If batch fails, try individual inserts to identify specific failures
            for (const item of batch) {
              const { record, rowIndex, code } = item;
              try {
                const { project_code, project_name, owner_name, _rowIndex, ...dbRecord } = record;
                const { error: singleError } = await supabase.from('documents').insert({
                  ...dbRecord,
                  created_by: user?.id,
                  doc_status: (dbRecord.doc_status as DocStatus) || '未開始',
                } as DocumentInsert);
                if (singleError) throw singleError;
                rowResults.push({ row: rowIndex, status: 'success', code, message: '新增成功' });
                inserted++;
              } catch (err) {
                const result = parsePostgresError(err, rowIndex, code);
                rowResults.push(result);
                errors++;
              }
            }
          } else {
            // All in batch succeeded
            for (const item of batch) {
              rowResults.push({ row: item.rowIndex, status: 'success', code: item.code, message: '新增成功' });
              inserted++;
            }
          }
        } catch (err) {
          // Handle unexpected errors
          for (const item of batch) {
            const result = parsePostgresError(err, item.rowIndex, item.code);
            rowResults.push(result);
            errors++;
          }
        }
      }

      // Process updates (still one by one as each needs different ID)
      for (const { record, rowIndex, code, existingId } of toUpdate) {
        try {
          const { project_code, project_name, owner_name, _rowIndex, ...dbRecord } = record;
          const { error } = await supabase.from('documents').update(dbRecord).eq('id', existingId);
          if (error) throw error;
          rowResults.push({ row: rowIndex, status: 'success', code, message: '更新成功' });
          updated++;
        } catch (err) {
          const result = parsePostgresError(err, rowIndex, code);
          rowResults.push(result);
          errors++;
        }
      }

      setDocumentPreview(null);
      return { inserted, updated, skipped, errors, rowResults };
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const clearPreview = useCallback(() => {
    setProjectPreview(null);
    setInvestorPreview(null);
    setInvestorContactPreview(null);
    setInvestorPaymentMethodPreview(null);
    setDocumentPreview(null);
  }, []);

  const clearInvestorContactPreview = useCallback(() => {
    setInvestorContactPreview(null);
  }, []);

  const clearInvestorPaymentMethodPreview = useCallback(() => {
    setInvestorPaymentMethodPreview(null);
  }, []);

  return {
    isProcessing,
    projectPreview,
    investorPreview,
    investorContactPreview,
    investorPaymentMethodPreview,
    documentPreview,
    previewProjects,
    previewInvestors,
    previewInvestorContacts,
    previewInvestorPaymentMethods,
    previewDocuments,
    importProjects,
    importInvestors,
    importInvestorContacts,
    importInvestorPaymentMethods,
    importDocuments,
    clearPreview,
    clearInvestorContactPreview,
    clearInvestorPaymentMethodPreview,
  };
}

export type { ImportResult, ImportRowResult };
