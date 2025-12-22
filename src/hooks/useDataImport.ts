import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type InvestorInsert = Database['public']['Tables']['investors']['Insert'];
type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
type ProjectStatus = Database['public']['Enums']['project_status'];
type DocType = Database['public']['Enums']['doc_type'];
type DocStatus = Database['public']['Enums']['doc_status'];

export type ImportStrategy = 'skip' | 'update';

export interface ImportPreview<T> {
  data: T[];
  errors: { row: number; message: string }[];
  duplicates: { row: number; existingId: string; code: string }[];
}

// Extended type to include investor_name for import mapping
type ProjectInsertWithInvestor = ProjectInsert & { investor_name?: string };

// Extended type to include project_code for import mapping
type DocumentInsertWithProject = DocumentInsert & { project_code?: string; project_name?: string; owner_name?: string };

// Column mapping from Chinese to English keys
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
  '統一編號': 'tax_id',
  '聯絡人': 'contact_person',
  '電話': 'phone',
  'Email': 'email',
  '地址': 'address',
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
        if (!isNaN(num)) {
          (mapped as any)[mappedKey] = num;
        }
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

function mapRowToDocument(row: Record<string, any>): Partial<DocumentInsertWithProject> {
  const mapped: Partial<DocumentInsertWithProject> = {};
  
  Object.entries(row).forEach(([key, value]) => {
    const mappedKey = documentColumnMap[key.trim()];
    if (mappedKey && value !== '' && value !== null && value !== undefined) {
      // Handle date fields
      if (mappedKey === 'submitted_at' || mappedKey === 'issued_at' || mappedKey === 'due_at') {
        // Try to parse as date
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

function validateProject(
  data: Partial<ProjectInsertWithInvestor>, 
  rowIndex: number,
  validStatuses: string[]
): string | null {
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

function validateDocument(
  data: Partial<DocumentInsertWithProject>, 
  rowIndex: number,
  validDocTypes: string[],
  validDocStatuses: string[]
): string | null {
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
  const [documentPreview, setDocumentPreview] = useState<ImportPreview<Partial<DocumentInsertWithProject>> | null>(null);

  const previewProjects = useCallback(async (file: File): Promise<ImportPreview<Partial<ProjectInsertWithInvestor>>> => {
    setIsProcessing(true);
    try {
      const rawData = await parseFile(file);
      
      if (rawData.length === 0) {
        throw new Error('檔案中沒有資料');
      }

      // Fetch valid statuses from system_options
      const { data: statusOptions } = await supabase
        .from('system_options')
        .select('value')
        .eq('category', 'project_status')
        .eq('is_active', true);
      
      const validStatuses = statusOptions?.map(opt => opt.value) || [];

      // Fetch investors for name-to-id mapping
      const { data: investors } = await supabase
        .from('investors')
        .select('id, company_name');
      
      const investorMap = new Map(investors?.map(inv => [inv.company_name, inv.id]) || []);

      const mappedData: Partial<ProjectInsertWithInvestor>[] = [];
      const errors: { row: number; message: string }[] = [];

      rawData.forEach((row, index) => {
        const mapped = mapRowToProject(row);
        const error = validateProject(mapped, index + 2, validStatuses); // +2 for header row and 1-based index
        if (error) {
          errors.push({ row: index + 2, message: error });
        } else {
          // Map investor_name to investor_id
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

      // Check for duplicates
      const codes = mappedData.map(d => d.project_code).filter(Boolean) as string[];
      const { data: existingProjects } = await supabase
        .from('projects')
        .select('id, project_code')
        .in('project_code', codes);

      const duplicates = (existingProjects || []).map(existing => {
        const rowIndex = mappedData.findIndex(d => d.project_code === existing.project_code);
        return {
          row: rowIndex + 2,
          existingId: existing.id,
          code: existing.project_code,
        };
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
      
      if (rawData.length === 0) {
        throw new Error('檔案中沒有資料');
      }

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

      // Check for duplicates
      const codes = mappedData.map(d => d.investor_code).filter(Boolean) as string[];
      const { data: existingInvestors } = await supabase
        .from('investors')
        .select('id, investor_code')
        .in('investor_code', codes);

      const duplicates = (existingInvestors || []).map(existing => {
        const rowIndex = mappedData.findIndex(d => d.investor_code === existing.investor_code);
        return {
          row: rowIndex + 2,
          existingId: existing.id,
          code: existing.investor_code,
        };
      });

      const preview = { data: mappedData, errors, duplicates };
      setInvestorPreview(preview);
      return preview;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const previewDocuments = useCallback(async (file: File): Promise<ImportPreview<Partial<DocumentInsertWithProject>>> => {
    setIsProcessing(true);
    try {
      const rawData = await parseFile(file);
      
      if (rawData.length === 0) {
        throw new Error('檔案中沒有資料');
      }

      // Fetch valid doc types and statuses from system_options
      const { data: docTypeOptions } = await supabase
        .from('system_options')
        .select('value')
        .eq('category', 'doc_type')
        .eq('is_active', true);
      
      const { data: docStatusOptions } = await supabase
        .from('system_options')
        .select('value')
        .eq('category', 'doc_status')
        .eq('is_active', true);
      
      const validDocTypes = docTypeOptions?.map(opt => opt.value) || [];
      const validDocStatuses = docStatusOptions?.map(opt => opt.value) || [];

      // Fetch projects for code-to-id mapping
      const { data: projects } = await supabase
        .from('projects')
        .select('id, project_code');
      
      const projectMap = new Map(projects?.map(p => [p.project_code, p.id]) || []);

      const mappedData: Partial<DocumentInsertWithProject>[] = [];
      const errors: { row: number; message: string }[] = [];

      rawData.forEach((row, index) => {
        const mapped = mapRowToDocument(row);
        const error = validateDocument(mapped, index + 2, validDocTypes, validDocStatuses);
        if (error) {
          errors.push({ row: index + 2, message: error });
        } else {
          // Map project_code to project_id
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

      // Check for duplicates - documents are unique by project_id + doc_type
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
            duplicates.push({
              row: i + 2,
              existingId: existing.id,
              code: `${d.project_code}-${d.doc_type}`,
            });
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

      let inserted = 0;
      let updated = 0;

      // Insert new records
      if (newRecords.length > 0) {
        const toInsert = newRecords.map(record => {
          // Remove investor_name before insert as it's not a DB column
          const { investor_name, ...dbRecord } = record;
          return {
            ...dbRecord,
            created_by: user?.id,
            status: (dbRecord.status as ProjectStatus) || '開發中',
          };
        }) as ProjectInsert[];

        const { error } = await supabase.from('projects').insert(toInsert);
        if (error) throw error;
        inserted = newRecords.length;
      }

      // Handle duplicates based on strategy
      if (strategy === 'update' && existingRecords.length > 0) {
        for (const record of existingRecords) {
          const existing = duplicates.find(d => d.code === record.project_code);
          if (existing) {
            // Remove investor_name before update
            const { investor_name, ...dbRecord } = record;
            const { error } = await supabase
              .from('projects')
              .update(dbRecord)
              .eq('id', existing.existingId);
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

      let inserted = 0;
      let updated = 0;

      // Insert new records
      if (newRecords.length > 0) {
        const toInsert = newRecords.map(record => ({
          ...record,
          created_by: user?.id,
        })) as InvestorInsert[];

        const { error } = await supabase.from('investors').insert(toInsert);
        if (error) throw error;
        inserted = newRecords.length;
      }

      // Handle duplicates based on strategy
      if (strategy === 'update' && existingRecords.length > 0) {
        for (const record of existingRecords) {
          const existing = duplicates.find(d => d.code === record.investor_code);
          if (existing) {
            const { error } = await supabase
              .from('investors')
              .update(record)
              .eq('id', existing.existingId);
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

      let inserted = 0;
      let updated = 0;

      // Insert new records
      if (newRecords.length > 0) {
        const toInsert = newRecords.map(record => {
          // Remove helper fields before insert
          const { project_code, project_name, owner_name, ...dbRecord } = record;
          return {
            ...dbRecord,
            created_by: user?.id,
            doc_status: (dbRecord.doc_status as DocStatus) || '未開始',
          };
        }) as DocumentInsert[];

        const { error } = await supabase.from('documents').insert(toInsert);
        if (error) throw error;
        inserted = newRecords.length;
      }

      // Handle duplicates based on strategy
      if (strategy === 'update' && existingRecords.length > 0) {
        for (const record of existingRecords) {
          const existing = duplicates.find(d => d.code === `${record.project_code}-${record.doc_type}`);
          if (existing) {
            // Remove helper fields before update
            const { project_code, project_name, owner_name, ...dbRecord } = record;
            const { error } = await supabase
              .from('documents')
              .update(dbRecord)
              .eq('id', existing.existingId);
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
    setDocumentPreview(null);
  }, []);

  return {
    isProcessing,
    projectPreview,
    investorPreview,
    documentPreview,
    previewProjects,
    previewInvestors,
    previewDocuments,
    importProjects,
    importInvestors,
    importDocuments,
    clearPreview,
  };
}
