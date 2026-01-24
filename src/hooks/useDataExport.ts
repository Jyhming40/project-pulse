import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'] & {
  investors?: { company_name: string } | null;
};
type Investor = Database['public']['Tables']['investors']['Row'];
type InvestorContact = Database['public']['Tables']['investor_contacts']['Row'] & {
  investors?: { investor_code: string; company_name: string } | null;
};
type InvestorPaymentMethod = Database['public']['Tables']['investor_payment_methods']['Row'] & {
  investors?: { investor_code: string; company_name: string } | null;
};
type Document = Database['public']['Tables']['documents']['Row'] & {
  projects?: { project_name: string; project_code: string } | null;
  profiles?: { full_name: string } | null;
};

type ExportFormat = 'xlsx' | 'csv';

// Column definitions for export
const projectColumns = [
  { key: 'project_code', label: '案場編號' },
  { key: 'project_name', label: '案場名稱' },
  { key: 'investor_name', label: '投資方' },
  { key: 'status', label: '狀態' },
  { key: 'capacity_kwp', label: '容量(kWp)' },
  { key: 'feeder_code', label: '饋線代號' },
  { key: 'city', label: '縣市' },
  { key: 'district', label: '鄉鎮區' },
  { key: 'address', label: '地址' },
  { key: 'coordinates', label: '座標' },
  { key: 'land_owner', label: '地主' },
  { key: 'land_owner_contact', label: '地主聯絡方式' },
  { key: 'contact_person', label: '聯絡人' },
  { key: 'contact_phone', label: '聯絡電話' },
  { key: 'fiscal_year', label: '年度' },
  { key: 'initial_survey_date', label: '初步現勘日期' },
  { key: 'structural_cert_date', label: '結構技師簽證日期' },
  { key: 'electrical_cert_date', label: '電機技師簽證日期' },
  { key: 'construction_start_date', label: '材料進場日期' },
  { key: 'note', label: '備註' },
];

const investorColumns = [
  { key: 'investor_code', label: '投資方編號' },
  { key: 'company_name', label: '公司名稱' },
  { key: 'investor_type', label: '投資方類型' },
  { key: 'owner_name', label: '負責人' },
  { key: 'owner_title', label: '負責人職稱' },
  { key: 'tax_id', label: '統一編號' },
  { key: 'contact_person', label: '聯絡人' },
  { key: 'phone', label: '電話' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: '地址' },
  { key: 'note', label: '備註' },
];

const investorContactColumns = [
  { key: 'investor_code', label: '投資方編號' },
  { key: 'investor_name', label: '投資方名稱' },
  { key: 'contact_name', label: '聯絡人姓名' },
  { key: 'title', label: '職稱' },
  { key: 'department', label: '部門' },
  { key: 'phone', label: '電話' },
  { key: 'mobile', label: '手機' },
  { key: 'email', label: 'Email' },
  { key: 'line_id', label: 'LINE ID' },
  { key: 'role_tags', label: '角色標籤' },
  { key: 'is_primary', label: '主要聯絡人' },
  { key: 'is_active', label: '啟用' },
  { key: 'note', label: '備註' },
];

const investorPaymentMethodColumns = [
  { key: 'investor_code', label: '投資方編號' },
  { key: 'investor_name', label: '投資方名稱' },
  { key: 'method_type', label: '付款方式' },
  { key: 'bank_name', label: '銀行名稱' },
  { key: 'bank_code', label: '銀行代碼' },
  { key: 'branch_name', label: '分行名稱' },
  { key: 'account_name', label: '戶名' },
  { key: 'account_number', label: '帳號' },
  { key: 'is_default', label: '預設' },
  { key: 'note', label: '備註' },
];

const documentColumns = [
  { key: 'project_code', label: '案場編號' },
  { key: 'project_name', label: '案場名稱' },
  { key: 'doc_type', label: '文件類型' },
  { key: 'doc_status', label: '狀態' },
  { key: 'submitted_at', label: '送件日' },
  { key: 'issued_at', label: '核發日' },
  { key: 'due_at', label: '到期日' },
  { key: 'owner_name', label: '負責人' },
  { key: 'note', label: '備註' },
];

function formatDataForExport<T extends Record<string, any>>(
  data: T[],
  columns: { key: string; label: string }[]
): Record<string, any>[] {
  return data.map(row => {
    const formatted: Record<string, any> = {};
    columns.forEach(col => {
      let value = row[col.key];
      // Handle arrays (like role_tags)
      if (Array.isArray(value)) {
        value = value.join(', ');
      }
      // Handle booleans
      if (typeof value === 'boolean') {
        value = value ? '是' : '否';
      }
      formatted[col.label] = value ?? '';
    });
    return formatted;
  });
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportData(
  data: Record<string, any>[],
  columns: { key: string; label: string }[],
  sheetName: string,
  filename: string,
  format: ExportFormat
) {
  const formattedData = formatDataForExport(data, columns);
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  worksheet['!cols'] = columns.map(col => ({ wch: col.label.length * 2 + 10 }));

  const timestamp = new Date().toISOString().slice(0, 10);
  const fullFilename = `${filename}_${timestamp}`;

  if (format === 'xlsx') {
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadFile(blob, `${fullFilename}.xlsx`);
  } else {
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `${fullFilename}.csv`);
  }
}

export function useDataExport() {
  const exportProjects = useCallback((projects: Project[], format: ExportFormat) => {
    try {
      const transformedProjects = projects.map(project => ({
        ...project,
        investor_name: project.investors?.company_name || '',
      }));
      exportData(transformedProjects, projectColumns, '案場列表', '案場資料', format);
      toast.success(`已匯出 ${projects.length} 筆案場資料`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('匯出失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    }
  }, []);

  const exportInvestors = useCallback((investors: Investor[], format: ExportFormat) => {
    try {
      exportData(investors, investorColumns, '投資方列表', '投資方資料', format);
      toast.success(`已匯出 ${investors.length} 筆投資方資料`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('匯出失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    }
  }, []);

  const exportInvestorContacts = useCallback((contacts: InvestorContact[], format: ExportFormat) => {
    try {
      const transformedContacts = contacts.map(contact => ({
        ...contact,
        investor_code: contact.investors?.investor_code || '',
        investor_name: contact.investors?.company_name || '',
      }));
      exportData(transformedContacts, investorContactColumns, '聯絡人列表', '投資方聯絡人', format);
      toast.success(`已匯出 ${contacts.length} 筆聯絡人資料`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('匯出失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    }
  }, []);

  const exportInvestorPaymentMethods = useCallback((methods: InvestorPaymentMethod[], format: ExportFormat) => {
    try {
      const transformedMethods = methods.map(method => ({
        ...method,
        investor_code: method.investors?.investor_code || '',
        investor_name: method.investors?.company_name || '',
      }));
      exportData(transformedMethods, investorPaymentMethodColumns, '支付方式列表', '投資方支付方式', format);
      toast.success(`已匯出 ${methods.length} 筆支付方式資料`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('匯出失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    }
  }, []);

  const exportDocuments = useCallback((documents: Document[], format: ExportFormat) => {
    try {
      const transformedDocuments = documents.map(doc => ({
        ...doc,
        project_code: doc.projects?.project_code || '',
        project_name: doc.projects?.project_name || '',
        owner_name: doc.profiles?.full_name || '',
      }));
      exportData(transformedDocuments, documentColumns, '文件列表', '文件資料', format);
      toast.success(`已匯出 ${documents.length} 筆文件資料`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('匯出失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    }
  }, []);

  const downloadTemplate = useCallback((
    type: 'projects' | 'investors' | 'investor_contacts' | 'investor_payment_methods' | 'documents', 
    format: ExportFormat
  ) => {
    try {
      let columns: { key: string; label: string }[];
      let sheetName: string;
      let filename: string;

      switch (type) {
        case 'projects':
          columns = projectColumns;
          sheetName = '案場範本';
          filename = '案場匯入範本';
          break;
        case 'investors':
          columns = investorColumns;
          sheetName = '投資方範本';
          filename = '投資方匯入範本';
          break;
        case 'investor_contacts':
          columns = investorContactColumns;
          sheetName = '聯絡人範本';
          filename = '投資方聯絡人匯入範本';
          break;
        case 'investor_payment_methods':
          columns = investorPaymentMethodColumns;
          sheetName = '支付方式範本';
          filename = '投資方支付方式匯入範本';
          break;
        default:
          columns = documentColumns;
          sheetName = '文件範本';
          filename = '文件匯入範本';
      }

      const headers: Record<string, string> = {};
      columns.forEach(col => {
        headers[col.label] = '';
      });

      const worksheet = XLSX.utils.json_to_sheet([headers]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      worksheet['!cols'] = columns.map(col => ({ wch: col.label.length * 2 + 10 }));

      if (format === 'xlsx') {
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadFile(blob, `${filename}.xlsx`);
      } else {
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        downloadFile(blob, `${filename}.csv`);
      }

      toast.success('範本下載成功');
    } catch (error) {
      console.error('Template download error:', error);
      toast.error('範本下載失敗');
    }
  }, []);

  return {
    exportProjects,
    exportInvestors,
    exportInvestorContacts,
    exportInvestorPaymentMethods,
    exportDocuments,
    downloadTemplate,
    projectColumns,
    investorColumns,
    investorContactColumns,
    investorPaymentMethodColumns,
    documentColumns,
  };
}
