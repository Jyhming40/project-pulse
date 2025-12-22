import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'] & {
  investors?: { company_name: string } | null;
};
type Investor = Database['public']['Tables']['investors']['Row'];
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
  { key: 'note', label: '備註' },
];

const investorColumns = [
  { key: 'investor_code', label: '投資方編號' },
  { key: 'company_name', label: '公司名稱' },
  { key: 'tax_id', label: '統一編號' },
  { key: 'contact_person', label: '聯絡人' },
  { key: 'phone', label: '電話' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: '地址' },
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
      formatted[col.label] = row[col.key] ?? '';
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

export function useDataExport() {
  const exportProjects = useCallback((projects: Project[], format: ExportFormat) => {
    try {
      // Transform projects to include investor_name
      const transformedProjects = projects.map(project => ({
        ...project,
        investor_name: project.investors?.company_name || '',
      }));
      
      const formattedData = formatDataForExport(transformedProjects, projectColumns);
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '案場列表');

      // Set column widths
      worksheet['!cols'] = projectColumns.map(col => ({ wch: col.label.length * 2 + 10 }));

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `案場資料_${timestamp}`;

      if (format === 'xlsx') {
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadFile(blob, `${filename}.xlsx`);
      } else {
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        downloadFile(blob, `${filename}.csv`);
      }

      toast.success(`已匯出 ${projects.length} 筆案場資料`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('匯出失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    }
  }, []);

  const exportInvestors = useCallback((investors: Investor[], format: ExportFormat) => {
    try {
      const formattedData = formatDataForExport(investors, investorColumns);
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '投資方列表');

      // Set column widths
      worksheet['!cols'] = investorColumns.map(col => ({ wch: col.label.length * 2 + 10 }));

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `投資方資料_${timestamp}`;

      if (format === 'xlsx') {
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadFile(blob, `${filename}.xlsx`);
      } else {
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        downloadFile(blob, `${filename}.csv`);
      }

      toast.success(`已匯出 ${investors.length} 筆投資方資料`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('匯出失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    }
  }, []);

  const exportDocuments = useCallback((documents: Document[], format: ExportFormat) => {
    try {
      // Transform documents to include project info
      const transformedDocuments = documents.map(doc => ({
        ...doc,
        project_code: doc.projects?.project_code || '',
        project_name: doc.projects?.project_name || '',
        owner_name: doc.profiles?.full_name || '',
      }));
      
      const formattedData = formatDataForExport(transformedDocuments, documentColumns);
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '文件列表');

      // Set column widths
      worksheet['!cols'] = documentColumns.map(col => ({ wch: col.label.length * 2 + 10 }));

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `文件資料_${timestamp}`;

      if (format === 'xlsx') {
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadFile(blob, `${filename}.xlsx`);
      } else {
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        downloadFile(blob, `${filename}.csv`);
      }

      toast.success(`已匯出 ${documents.length} 筆文件資料`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('匯出失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    }
  }, []);

  const downloadTemplate = useCallback((type: 'projects' | 'investors' | 'documents', format: ExportFormat) => {
    try {
      const columns = type === 'projects' ? projectColumns : type === 'investors' ? investorColumns : documentColumns;
      const headers: Record<string, string> = {};
      columns.forEach(col => {
        headers[col.label] = '';
      });

      const worksheet = XLSX.utils.json_to_sheet([headers]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, type === 'projects' ? '案場範本' : type === 'investors' ? '投資方範本' : '文件範本');

      // Set column widths
      worksheet['!cols'] = columns.map(col => ({ wch: col.label.length * 2 + 10 }));

      const filename = type === 'projects' ? '案場匯入範本' : type === 'investors' ? '投資方匯入範本' : '文件匯入範本';

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
    exportDocuments,
    downloadTemplate,
    projectColumns,
    investorColumns,
    documentColumns,
  };
}
