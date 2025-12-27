import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export interface PartnerImportRow {
  name: string;
  partner_type?: string;
  tax_id?: string;
  address?: string;
  note?: string;
  // Legacy fields that will be migrated to contacts
  contact_person?: string;
  contact_phone?: string;
  email?: string;
  // Contact fields (if importing contacts separately)
  contact_name?: string;
  contact_role?: string;
}

export interface ImportPreviewItem {
  rowIndex: number;
  data: PartnerImportRow;
  status: 'insert' | 'update' | 'skip' | 'error';
  existingId?: string;
  error?: string;
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  errorList: { row: number; message: string }[];
}

type ImportMode = 'insert' | 'upsert';

export function usePartnersImport() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewItem[]>([]);

  const parseFile = useCallback(async (file: File): Promise<PartnerImportRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

          // Map column headers to our fields
          const columnMap: Record<string, keyof PartnerImportRow> = {
            '名稱': 'name',
            '公司名稱': 'name',
            '廠商名稱': 'name',
            '類型': 'partner_type',
            '類別': 'partner_type',
            '產業': 'partner_type', // Map 產業 to partner_type for now
            '統編': 'tax_id',
            '統一編號': 'tax_id',
            '地址': 'address',
            '備註': 'note',
            '描述': 'note',
            '聯絡人': 'contact_person',
            '聯絡人姓名': 'contact_name',
            '電話': 'contact_phone',
            '聯絡電話': 'contact_phone',
            'Email': 'email',
            'email': 'email',
            'EMAIL': 'email',
            '角色': 'contact_role',
            '職稱': 'contact_role',
          };

          const rows: PartnerImportRow[] = jsonData.map((row) => {
          const mapped: PartnerImportRow = { name: '' };
          for (const [key, value] of Object.entries(row)) {
            const mappedKey = columnMap[key];
            if (mappedKey && value != null) {
              (mapped as unknown as Record<string, unknown>)[mappedKey] = String(value).trim();
            }
          }
          return mapped;
          });

          resolve(rows.filter((r) => r.name));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('檔案讀取失敗'));
      reader.readAsBinaryString(file);
    });
  }, []);

  const previewImport = useCallback(async (file: File): Promise<ImportPreviewItem[]> => {
    setIsProcessing(true);
    try {
      const rows = await parseFile(file);

      // Fetch existing partners for duplicate detection
      const { data: existingPartners, error } = await supabase
        .from('partners')
        .select('id, name, tax_id');
      if (error) throw error;

      const nameToId = new Map<string, string>();
      const taxIdToId = new Map<string, string>();
      existingPartners?.forEach((p) => {
        nameToId.set(p.name.toLowerCase(), p.id);
        if (p.tax_id) taxIdToId.set(p.tax_id, p.id);
      });

      const previewItems: ImportPreviewItem[] = rows.map((data, index) => {
        // Check for duplicate by tax_id first, then by name
        let existingId: string | undefined;
        if (data.tax_id) {
          existingId = taxIdToId.get(data.tax_id);
        }
        if (!existingId) {
          existingId = nameToId.get(data.name.toLowerCase());
        }

        // Validation
        if (!data.name) {
          return {
            rowIndex: index + 2, // Excel row (1-indexed, header is row 1)
            data,
            status: 'error' as const,
            error: '名稱為必填欄位',
          };
        }

        return {
          rowIndex: index + 2,
          data,
          status: existingId ? 'update' : 'insert',
          existingId,
        };
      });

      setPreview(previewItems);
      return previewItems;
    } finally {
      setIsProcessing(false);
    }
  }, [parseFile]);

  const executeImport = useCallback(async (
    items: ImportPreviewItem[],
    mode: ImportMode = 'upsert'
  ): Promise<ImportResult> => {
    setIsProcessing(true);
    const result: ImportResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorList: [],
    };

    try {
      for (const item of items) {
        if (item.status === 'error') {
          result.errors++;
          result.errorList.push({ row: item.rowIndex, message: item.error || '驗證錯誤' });
          continue;
        }

        const { data } = item;
        const partnerData = {
          name: data.name,
          partner_type: data.partner_type || null,
          tax_id: data.tax_id || null,
          address: data.address || null,
          note: data.note || null,
          // Keep legacy contact fields for backward compatibility
          contact_person: data.contact_person || data.contact_name || null,
          contact_phone: data.contact_phone || null,
          email: data.email || null,
        };

        if (item.existingId) {
          if (mode === 'insert') {
            // Skip existing in insert-only mode
            result.skipped++;
            continue;
          }

          // Update existing partner
          const { error } = await supabase
            .from('partners')
            .update(partnerData)
            .eq('id', item.existingId);

          if (error) {
            result.errors++;
            result.errorList.push({ row: item.rowIndex, message: error.message });
          } else {
            result.updated++;

            // Also create a contact if contact info is provided
            if (data.contact_person || data.contact_name) {
              await createContactIfNotExists(item.existingId, data);
            }
          }
        } else {
          // Insert new partner
          const { data: newPartner, error } = await supabase
            .from('partners')
            .insert({
              ...partnerData,
              created_by: user?.id,
            })
            .select('id')
            .single();

          if (error) {
            result.errors++;
            result.errorList.push({ row: item.rowIndex, message: error.message });
          } else {
            result.inserted++;

            // Create contact for new partner
            if (data.contact_person || data.contact_name) {
              await createContactIfNotExists(newPartner.id, data);
            }
          }
        }
      }

      if (result.errors === 0) {
        toast.success(`匯入完成：新增 ${result.inserted} 筆，更新 ${result.updated} 筆`);
      } else {
        toast.warning(`匯入完成，但有 ${result.errors} 筆錯誤`);
      }

      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  const createContactIfNotExists = async (partnerId: string, data: PartnerImportRow) => {
    const contactName = data.contact_person || data.contact_name;
    if (!contactName) return;

    // Check if contact already exists
    const { data: existing } = await supabase
      .from('partner_contacts')
      .select('id')
      .eq('partner_id', partnerId)
      .eq('contact_name', contactName)
      .maybeSingle();

    if (existing) return;

    // Create new contact
    await supabase.from('partner_contacts').insert({
      partner_id: partnerId,
      contact_name: contactName,
      role: data.contact_role || null,
      phone: data.contact_phone || null,
      email: data.email || null,
      is_primary: true,
    });
  };

  const clearPreview = useCallback(() => {
    setPreview([]);
  }, []);

  const downloadTemplate = useCallback(() => {
    const template = [
      {
        '名稱': '範例公司',
        '類型': '電力工程',
        '統編': '12345678',
        '地址': '台北市中正區...',
        '聯絡人': '王小明',
        '電話': '02-12345678',
        'Email': 'example@email.com',
        '備註': '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '外包夥伴');
    XLSX.writeFile(wb, '外包夥伴匯入範本.xlsx');
  }, []);

  return {
    isProcessing,
    preview,
    previewImport,
    executeImport,
    clearPreview,
    downloadTemplate,
  };
}
