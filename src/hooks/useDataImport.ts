import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

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

export type ImportStrategy = 'skip' | 'update';

export interface ImportPreview<T> {
  data: T[];
  errors: { row: number; message: string }[];
  duplicates: { row: number; existingId: string; code: string }[];
}

// Extended types for import mapping
type ProjectInsertWithInvestor = ProjectInsert & { investor_name?: string };
type DocumentInsertWithProject = DocumentInsert & { project_code?: string; project_name?: string; owner_name?: string };
type InvestorContactInsertWithCode = InvestorContactInsert & { investor_code?: string; investor_name?: string };
type InvestorPaymentMethodInsertWithCode = InvestorPaymentMethodInsert & { investor_code?: string; investor_name?: string };

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

const investorColumnMap: Record<string, keyof InvestorInsert> = {
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
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(jsonData as Record<string, any>[]);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('檔案讀取失敗'));
    reader.readAsBinaryString(file);
  });
}

function mapRowToProject(row: Record<string, any>): Partial<ProjectInsertWithInvestor> {
  const mapped: Partial<ProjectInsertWithInvestor> = {};
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

function mapRowToInvestor(row: Record<string, any>): Partial<InvestorInsert> {
  const mapped: Partial<InvestorInsert> = {};
  Object.entries(row).forEach(([key, value]) => {
    const mappedKey = investorColumnMap[key.trim()];
    if (mappedKey && value !== '' && value !== null && value !== undefined) {
      (mapped as any)[mappedKey] = String(value).trim();
    }
  });
  return mapped;
}

function mapRowToInvestorContact(row: Record<string, any>): Partial<InvestorContactInsertWithCode> {
  const mapped: Partial<InvestorContactInsertWithCode> = {};
  Object.entries(row).forEach(([key, value]) => {
    const mappedKey = investorContactColumnMap[key.trim()];
    if (mappedKey && value !== '' && value !== null && value !== undefined) {
      if (mappedKey === 'role_tags') {
        // Parse comma-separated role tags
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

function mapRowToInvestorPaymentMethod(row: Record<string, any>): Partial<InvestorPaymentMethodInsertWithCode> {
  const mapped: Partial<InvestorPaymentMethodInsertWithCode> = {};
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

function mapRowToDocument(row: Record<string, any>): Partial<DocumentInsertWithProject> {
  const mapped: Partial<DocumentInsertWithProject> = {};
  Object.entries(row).forEach(([key, value]) => {
    const mappedKey = documentColumnMap[key.trim()];
    if (mappedKey && value !== '' && value !== null && value !== undefined) {
      if (mappedKey === 'submitted_at' || mappedKey === 'issued_at' || mappedKey === 'due_at') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          (mapped as any)[mappedKey] = date.toISOString().split('T')[0];
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

function validateInvestor(data: Partial<InvestorInsert>, rowIndex: number): string | null {
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

export function useDataImport() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [projectPreview, setProjectPreview] = useState<ImportPreview<Partial<ProjectInsertWithInvestor>> | null>(null);
  const [investorPreview, setInvestorPreview] = useState<ImportPreview<Partial<InvestorInsert>> | null>(null);
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
        const mapped = mapRowToProject(row);
        const error = validateProject(mapped, index + 2, validStatuses);
        if (error) {
          errors.push({ row: index + 2, message: error });
        } else {
          if (mapped.investor_name) {
            const investorId = investorMap.get(mapped.investor_name);
            if (investorId) {
              mapped.investor_id = investorId;
            } else {
              errors.push({ row: index + 2, message: `第 ${index + 2} 行：找不到投資方「${mapped.investor_name}」` });
              return;
            }
          }
          mappedData.push(mapped);
        }
      });

      const codes = mappedData.map(d => d.project_code).filter(Boolean) as string[];
      const { data: existingProjects } = await supabase.from('projects').select('id, project_code').in('project_code', codes);

      const duplicates = (existingProjects || []).map(existing => {
        const rowIndex = mappedData.findIndex(d => d.project_code === existing.project_code);
        return { row: rowIndex + 2, existingId: existing.id, code: existing.project_code };
      });

      const preview = { data: mappedData, errors, duplicates };
      setProjectPreview(preview);
      return preview;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const previewInvestors = useCallback(async (file: File): Promise<ImportPreview<Partial<InvestorInsert>>> => {
    setIsProcessing(true);
    try {
      const rawData = await parseFile(file);
      if (rawData.length === 0) throw new Error('檔案中沒有資料');

      const mappedData: Partial<InvestorInsert>[] = [];
      const errors: { row: number; message: string }[] = [];

      rawData.forEach((row, index) => {
        const mapped = mapRowToInvestor(row);
        const error = validateInvestor(mapped, index + 2);
        if (error) {
          errors.push({ row: index + 2, message: error });
        } else {
          mappedData.push(mapped);
        }
      });

      const codes = mappedData.map(d => d.investor_code).filter(Boolean) as string[];
      const { data: existingInvestors } = await supabase.from('investors').select('id, investor_code').in('investor_code', codes);

      const duplicates = (existingInvestors || []).map(existing => {
        const rowIndex = mappedData.findIndex(d => d.investor_code === existing.investor_code);
        return { row: rowIndex + 2, existingId: existing.id, code: existing.investor_code };
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
        const mapped = mapRowToInvestorContact(row);
        const error = validateInvestorContact(mapped, index + 2);
        if (error) {
          errors.push({ row: index + 2, message: error });
        } else {
          if (mapped.investor_code) {
            const investorId = investorMap.get(mapped.investor_code);
            if (investorId) {
              mapped.investor_id = investorId;
            } else {
              errors.push({ row: index + 2, message: `第 ${index + 2} 行：找不到投資方編號「${mapped.investor_code}」` });
              return;
            }
          }
          mappedData.push(mapped);
        }
      });

      // Check for duplicates by investor_id + contact_name
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
            duplicates.push({ row: i + 2, existingId: existing.id, code: `${d.investor_code}-${d.contact_name}` });
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
        const mapped = mapRowToInvestorPaymentMethod(row);
        const error = validateInvestorPaymentMethod(mapped, index + 2, validMethodTypes);
        if (error) {
          errors.push({ row: index + 2, message: error });
        } else {
          if (mapped.investor_code) {
            const investorId = investorMap.get(mapped.investor_code);
            if (investorId) {
              mapped.investor_id = investorId;
            } else {
              errors.push({ row: index + 2, message: `第 ${index + 2} 行：找不到投資方編號「${mapped.investor_code}」` });
              return;
            }
          }
          mappedData.push(mapped);
        }
      });

      // Check for duplicates by investor_id + method_type + account_number
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
            duplicates.push({ row: i + 2, existingId: existing.id, code: `${d.investor_code}-${d.method_type}` });
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

      const { data: docTypeOptions } = await supabase.from('system_options').select('value').eq('category', 'doc_type').eq('is_active', true);
      const { data: docStatusOptions } = await supabase.from('system_options').select('value').eq('category', 'doc_status').eq('is_active', true);
      const validDocTypes = docTypeOptions?.map(opt => opt.value) || [];
      const validDocStatuses = docStatusOptions?.map(opt => opt.value) || [];

      const { data: projects } = await supabase.from('projects').select('id, project_code');
      const projectMap = new Map(projects?.map(p => [p.project_code, p.id]) || []);

      const mappedData: Partial<DocumentInsertWithProject>[] = [];
      const errors: { row: number; message: string }[] = [];

      rawData.forEach((row, index) => {
        const mapped = mapRowToDocument(row);
        const error = validateDocument(mapped, index + 2, validDocTypes, validDocStatuses);
        if (error) {
          errors.push({ row: index + 2, message: error });
        } else {
          if (mapped.project_code) {
            const projectId = projectMap.get(mapped.project_code);
            if (projectId) {
              mapped.project_id = projectId;
            } else {
              errors.push({ row: index + 2, message: `第 ${index + 2} 行：找不到案場「${mapped.project_code}」` });
              return;
            }
          }
          mappedData.push(mapped);
        }
      });

      const duplicates: { row: number; existingId: string; code: string }[] = [];
      for (let i = 0; i < mappedData.length; i++) {
        const d = mappedData[i];
        if (d.project_id && d.doc_type) {
          const { data: existing } = await supabase
            .from('documents')
            .select('id')
            .eq('project_id', d.project_id)
            .eq('doc_type', d.doc_type as DocType)
            .maybeSingle();
          if (existing) {
            duplicates.push({ row: i + 2, existingId: existing.id, code: `${d.project_code}-${d.doc_type}` });
          }
        }
      }

      const preview = { data: mappedData, errors, duplicates };
      setDocumentPreview(preview);
      return preview;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const importProjects = useCallback(async (
    data: Partial<ProjectInsertWithInvestor>[],
    strategy: ImportStrategy,
    duplicates: { row: number; existingId: string; code: string }[]
  ): Promise<{ inserted: number; updated: number }> => {
    setIsProcessing(true);
    try {
      const duplicateCodes = new Set(duplicates.map(d => d.code));
      const newRecords = data.filter(d => !duplicateCodes.has(d.project_code!));
      const existingRecords = data.filter(d => duplicateCodes.has(d.project_code!));

      let inserted = 0, updated = 0;

      if (newRecords.length > 0) {
        const toInsert = newRecords.map(record => {
          const { investor_name, ...dbRecord } = record;
          return { ...dbRecord, created_by: user?.id, status: (dbRecord.status as ProjectStatus) || '開發中' };
        }) as ProjectInsert[];
        const { error } = await supabase.from('projects').insert(toInsert);
        if (error) throw error;
        inserted = newRecords.length;
      }

      if (strategy === 'update' && existingRecords.length > 0) {
        for (const record of existingRecords) {
          const existing = duplicates.find(d => d.code === record.project_code);
          if (existing) {
            const { investor_name, ...dbRecord } = record;
            const { error } = await supabase.from('projects').update(dbRecord).eq('id', existing.existingId);
            if (error) throw error;
            updated++;
          }
        }
      }

      setProjectPreview(null);
      return { inserted, updated };
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const importInvestors = useCallback(async (
    data: Partial<InvestorInsert>[],
    strategy: ImportStrategy,
    duplicates: { row: number; existingId: string; code: string }[]
  ): Promise<{ inserted: number; updated: number }> => {
    setIsProcessing(true);
    try {
      const duplicateCodes = new Set(duplicates.map(d => d.code));
      const newRecords = data.filter(d => !duplicateCodes.has(d.investor_code!));
      const existingRecords = data.filter(d => duplicateCodes.has(d.investor_code!));

      let inserted = 0, updated = 0;

      if (newRecords.length > 0) {
        const toInsert = newRecords.map(record => ({ ...record, created_by: user?.id })) as InvestorInsert[];
        const { error } = await supabase.from('investors').insert(toInsert);
        if (error) throw error;
        inserted = newRecords.length;
      }

      if (strategy === 'update' && existingRecords.length > 0) {
        for (const record of existingRecords) {
          const existing = duplicates.find(d => d.code === record.investor_code);
          if (existing) {
            const { error } = await supabase.from('investors').update(record).eq('id', existing.existingId);
            if (error) throw error;
            updated++;
          }
        }
      }

      setInvestorPreview(null);
      return { inserted, updated };
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const importInvestorContacts = useCallback(async (
    data: Partial<InvestorContactInsertWithCode>[],
    strategy: ImportStrategy,
    duplicates: { row: number; existingId: string; code: string }[]
  ): Promise<{ inserted: number; updated: number }> => {
    setIsProcessing(true);
    try {
      const duplicateCodes = new Set(duplicates.map(d => d.code));
      const newRecords = data.filter(d => !duplicateCodes.has(`${d.investor_code}-${d.contact_name}`));
      const existingRecords = data.filter(d => duplicateCodes.has(`${d.investor_code}-${d.contact_name}`));

      let inserted = 0, updated = 0;

      if (newRecords.length > 0) {
        const toInsert = newRecords.map(record => {
          const { investor_code, investor_name, ...dbRecord } = record;
          return { ...dbRecord, created_by: user?.id };
        }) as InvestorContactInsert[];
        const { error } = await supabase.from('investor_contacts').insert(toInsert);
        if (error) throw error;
        inserted = newRecords.length;
      }

      if (strategy === 'update' && existingRecords.length > 0) {
        for (const record of existingRecords) {
          const existing = duplicates.find(d => d.code === `${record.investor_code}-${record.contact_name}`);
          if (existing) {
            const { investor_code, investor_name, ...dbRecord } = record;
            const { error } = await supabase.from('investor_contacts').update(dbRecord).eq('id', existing.existingId);
            if (error) throw error;
            updated++;
          }
        }
      }

      setInvestorContactPreview(null);
      return { inserted, updated };
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const importInvestorPaymentMethods = useCallback(async (
    data: Partial<InvestorPaymentMethodInsertWithCode>[],
    strategy: ImportStrategy,
    duplicates: { row: number; existingId: string; code: string }[]
  ): Promise<{ inserted: number; updated: number }> => {
    setIsProcessing(true);
    try {
      const duplicateCodes = new Set(duplicates.map(d => d.code));
      const newRecords = data.filter(d => !duplicateCodes.has(`${d.investor_code}-${d.method_type}`));
      const existingRecords = data.filter(d => duplicateCodes.has(`${d.investor_code}-${d.method_type}`));

      let inserted = 0, updated = 0;

      if (newRecords.length > 0) {
        const toInsert = newRecords.map(record => {
          const { investor_code, investor_name, ...dbRecord } = record;
          return { ...dbRecord, created_by: user?.id };
        }) as InvestorPaymentMethodInsert[];
        const { error } = await supabase.from('investor_payment_methods').insert(toInsert);
        if (error) throw error;
        inserted = newRecords.length;
      }

      if (strategy === 'update' && existingRecords.length > 0) {
        for (const record of existingRecords) {
          const existing = duplicates.find(d => d.code === `${record.investor_code}-${record.method_type}`);
          if (existing) {
            const { investor_code, investor_name, ...dbRecord } = record;
            const { error } = await supabase.from('investor_payment_methods').update(dbRecord).eq('id', existing.existingId);
            if (error) throw error;
            updated++;
          }
        }
      }

      setInvestorPaymentMethodPreview(null);
      return { inserted, updated };
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const importDocuments = useCallback(async (
    data: Partial<DocumentInsertWithProject>[],
    strategy: ImportStrategy,
    duplicates: { row: number; existingId: string; code: string }[]
  ): Promise<{ inserted: number; updated: number }> => {
    setIsProcessing(true);
    try {
      const duplicateCodes = new Set(duplicates.map(d => d.code));
      const newRecords = data.filter(d => !duplicateCodes.has(`${d.project_code}-${d.doc_type}`));
      const existingRecords = data.filter(d => duplicateCodes.has(`${d.project_code}-${d.doc_type}`));

      let inserted = 0, updated = 0;

      if (newRecords.length > 0) {
        const toInsert = newRecords.map(record => {
          const { project_code, project_name, owner_name, ...dbRecord } = record;
          return { ...dbRecord, created_by: user?.id, doc_status: (dbRecord.doc_status as DocStatus) || '未開始' };
        }) as DocumentInsert[];
        const { error } = await supabase.from('documents').insert(toInsert);
        if (error) throw error;
        inserted = newRecords.length;
      }

      if (strategy === 'update' && existingRecords.length > 0) {
        for (const record of existingRecords) {
          const existing = duplicates.find(d => d.code === `${record.project_code}-${record.doc_type}`);
          if (existing) {
            const { project_code, project_name, owner_name, ...dbRecord } = record;
            const { error } = await supabase.from('documents').update(dbRecord).eq('id', existing.existingId);
            if (error) throw error;
            updated++;
          }
        }
      }

      setDocumentPreview(null);
      return { inserted, updated };
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
