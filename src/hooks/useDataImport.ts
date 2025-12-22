import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type InvestorInsert = Database['public']['Tables']['investors']['Insert'];
type ProjectStatus = Database['public']['Enums']['project_status'];

export type ImportStrategy = 'skip' | 'update';

export interface ImportPreview<T> {
  data: T[];
  errors: { row: number; message: string }[];
  duplicates: { row: number; existingId: string; code: string }[];
}

// Column mapping from Chinese to English keys
const projectColumnMap: Record<string, keyof ProjectInsert> = {
  '案場編號': 'project_code',
  '案場名稱': 'project_name',
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

const validStatuses: ProjectStatus[] = [
  '開發中', '土地確認', '結構簽證', '台電送件', '台電審查',
  '能源局送件', '同意備案', '工程施工', '報竣掛表', '設備登記',
  '運維中', '暫停', '取消'
];

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

function mapRowToProject(row: Record<string, any>): Partial<ProjectInsert> {
  const mapped: Partial<ProjectInsert> = {};
  
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

function validateProject(data: Partial<ProjectInsert>, rowIndex: number): string | null {
  if (!data.project_code) return `第 ${rowIndex} 行：缺少案場編號`;
  if (!data.project_name) return `第 ${rowIndex} 行：缺少案場名稱`;
  if (data.status && !validStatuses.includes(data.status as ProjectStatus)) {
    return `第 ${rowIndex} 行：無效的狀態「${data.status}」`;
  }
  return null;
}

function validateInvestor(data: Partial<InvestorInsert>, rowIndex: number): string | null {
  if (!data.investor_code) return `第 ${rowIndex} 行：缺少投資方編號`;
  if (!data.company_name) return `第 ${rowIndex} 行：缺少公司名稱`;
  return null;
}

export function useDataImport() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [projectPreview, setProjectPreview] = useState<ImportPreview<Partial<ProjectInsert>> | null>(null);
  const [investorPreview, setInvestorPreview] = useState<ImportPreview<Partial<InvestorInsert>> | null>(null);

  const previewProjects = useCallback(async (file: File): Promise<ImportPreview<Partial<ProjectInsert>>> => {
    setIsProcessing(true);
    try {
      const rawData = await parseFile(file);
      
      if (rawData.length === 0) {
        throw new Error('檔案中沒有資料');
      }

      const mappedData: Partial<ProjectInsert>[] = [];
      const errors: { row: number; message: string }[] = [];

      rawData.forEach((row, index) => {
        const mapped = mapRowToProject(row);
        const error = validateProject(mapped, index + 2); // +2 for header row and 1-based index
        if (error) {
          errors.push({ row: index + 2, message: error });
        } else {
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

  const importProjects = useCallback(async (
    data: Partial<ProjectInsert>[],
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
        const toInsert = newRecords.map(record => ({
          ...record,
          created_by: user?.id,
          status: (record.status as ProjectStatus) || '開發中',
        })) as ProjectInsert[];

        const { error } = await supabase.from('projects').insert(toInsert);
        if (error) throw error;
        inserted = newRecords.length;
      }

      // Handle duplicates based on strategy
      if (strategy === 'update' && existingRecords.length > 0) {
        for (const record of existingRecords) {
          const existing = duplicates.find(d => d.code === record.project_code);
          if (existing) {
            const { error } = await supabase
              .from('projects')
              .update(record)
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

  const clearPreview = useCallback(() => {
    setProjectPreview(null);
    setInvestorPreview(null);
  }, []);

  return {
    isProcessing,
    projectPreview,
    investorPreview,
    previewProjects,
    previewInvestors,
    importProjects,
    importInvestors,
    clearPreview,
  };
}
