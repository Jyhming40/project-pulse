import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

// Types
type Project = Database['public']['Tables']['projects']['Row'];
type ProjectStatusHistory = Database['public']['Tables']['project_status_history']['Row'];
type ConstructionStatusHistory = Database['public']['Tables']['construction_status_history']['Row'];
type Document = Database['public']['Tables']['documents']['Row'];
type DocumentFile = Database['public']['Tables']['document_files']['Row'];
type Investor = Database['public']['Tables']['investors']['Row'];
type InvestorContact = Database['public']['Tables']['investor_contacts']['Row'];
type InvestorPaymentMethod = Database['public']['Tables']['investor_payment_methods']['Row'];
type Partner = Database['public']['Tables']['partners']['Row'];
type ProjectConstructionAssignment = Database['public']['Tables']['project_construction_assignments']['Row'];
type SystemOption = Database['public']['Tables']['system_options']['Row'];
type ModulePermission = Database['public']['Tables']['module_permissions']['Row'];

export type ImportMode = 'insert' | 'upsert' | 'skip';

export interface ExportStats {
  investors: number;
  investorContacts: number;
  investorPaymentMethods: number;
  partners: number;
  projects: number;
  statusHistory: number;
  constructionHistory: number;
  constructionAssignments: number;
  documents: number;
  documentFiles: number;
  systemOptions: number;
  modulePermissions: number;
}

export interface BackupProgress {
  current: number;
  total: number;
  phase: 'preparing' | 'exporting' | 'importing' | 'done';
  currentSheet?: string;
  exportStats?: ExportStats;
}

export interface ImportError {
  row: number;
  sheet: string;
  field?: string;
  message: string;
  errorType: 'unique_constraint' | 'foreign_key' | 'validation' | 'data_type' | 'not_found' | 'unknown';
  code?: string;
}

export interface ImportSummary {
  investors: { inserted: number; updated: number; skipped: number; errors: number };
  investorContacts: { inserted: number; updated: number; skipped: number; errors: number };
  investorPaymentMethods: { inserted: number; updated: number; skipped: number; errors: number };
  partners: { inserted: number; updated: number; skipped: number; errors: number };
  projects: { inserted: number; updated: number; skipped: number; errors: number };
  statusHistory: { inserted: number; updated: number; skipped: number; errors: number };
  constructionHistory: { inserted: number; updated: number; skipped: number; errors: number };
  constructionAssignments: { inserted: number; updated: number; skipped: number; errors: number };
  documents: { inserted: number; updated: number; skipped: number; errors: number };
  documentFiles: { inserted: number; updated: number; skipped: number; errors: number };
  systemOptions: { inserted: number; updated: number; skipped: number; errors: number };
  modulePermissions: { inserted: number; updated: number; skipped: number; errors: number };
  errorList: ImportError[];
}

// Column definitions for export
const projectColumns = [
  'id', 'project_code', 'project_name', 'site_code_display', 'investor_code', 'status',
  'capacity_kwp', 'actual_installed_capacity', 'feeder_code', 'city', 'district', 'address',
  'coordinates', 'land_owner', 'land_owner_contact', 'contact_person', 'contact_phone',
  'fiscal_year', 'intake_year', 'seq', 'approval_date', 'installation_type', 'taipower_pv_id',
  'grid_connection_type', 'power_phase_type', 'power_voltage', 'pole_status', 'construction_status',
  'drive_folder_id', 'drive_folder_url', 'folder_status', 'folder_error', 'note', 'created_at', 'updated_at'
];

const projectLabels: Record<string, string> = {
  id: 'ID', project_code: '案場編號', project_name: '案場名稱', site_code_display: '案場代碼',
  investor_code: '投資方代碼', status: '狀態', capacity_kwp: '容量(kWp)', actual_installed_capacity: '實際容量',
  feeder_code: '饋線代號', city: '縣市', district: '鄉鎮區', address: '地址', coordinates: '座標',
  land_owner: '地主', land_owner_contact: '地主聯絡方式', contact_person: '聯絡人', contact_phone: '聯絡電話',
  fiscal_year: '年度', intake_year: '收件年度', seq: '序號', approval_date: '同意備案日',
  installation_type: '裝置類型', taipower_pv_id: '台電PV編號', grid_connection_type: '併網類型',
  power_phase_type: '相別', power_voltage: '電壓', pole_status: '電桿狀態', construction_status: '施工狀態',
  drive_folder_id: 'Drive資料夾ID', drive_folder_url: 'Drive資料夾網址', folder_status: '資料夾狀態',
  folder_error: '資料夾錯誤', note: '備註', created_at: '建立時間', updated_at: '更新時間'
};

const statusHistoryColumns = ['id', 'project_code', 'status', 'changed_at', 'note'];
const statusHistoryLabels: Record<string, string> = {
  id: 'ID', project_code: '案場編號', status: '狀態', changed_at: '變更時間', note: '備註'
};

const constructionHistoryColumns = ['id', 'project_code', 'status', 'changed_at', 'note'];
const constructionHistoryLabels: Record<string, string> = {
  id: 'ID', project_code: '案場編號', status: '施工狀態', changed_at: '變更時間', note: '備註'
};

const documentColumns = ['id', 'project_code', 'doc_type', 'doc_status', 'submitted_at', 'issued_at', 'due_at', 'note', 'created_at', 'updated_at'];
const documentLabels: Record<string, string> = {
  id: 'ID', project_code: '案場編號', doc_type: '文件類型', doc_status: '狀態',
  submitted_at: '送件日', issued_at: '核發日', due_at: '到期日', note: '備註',
  created_at: '建立時間', updated_at: '更新時間'
};

const documentFileColumns = ['id', 'document_id', 'original_name', 'storage_path', 'mime_type', 'file_size', 'uploaded_at'];
const documentFileLabels: Record<string, string> = {
  id: 'ID', document_id: '文件ID', original_name: '檔案名稱', storage_path: '儲存路徑',
  mime_type: 'MIME類型', file_size: '檔案大小', uploaded_at: '上傳時間'
};

// Investor columns
const investorColumns = ['id', 'investor_code', 'company_name', 'investor_type', 'owner_name', 'owner_title', 'tax_id', 'address', 'phone', 'email', 'contact_person', 'note', 'created_at', 'updated_at'];
const investorLabels: Record<string, string> = {
  id: 'ID', investor_code: '投資方代碼', company_name: '公司名稱', investor_type: '投資方類型',
  owner_name: '負責人', owner_title: '負責人職稱', tax_id: '統一編號', address: '地址',
  phone: '電話', email: 'Email', contact_person: '聯絡人', note: '備註',
  created_at: '建立時間', updated_at: '更新時間'
};

// Investor contact columns
const investorContactColumns = ['id', 'investor_code', 'contact_name', 'title', 'department', 'phone', 'mobile', 'email', 'line_id', 'role_tags', 'is_primary', 'is_active', 'note', 'created_at', 'updated_at'];
const investorContactLabels: Record<string, string> = {
  id: 'ID', investor_code: '投資方代碼', contact_name: '聯絡人姓名', title: '職稱', department: '部門',
  phone: '電話', mobile: '手機', email: 'Email', line_id: 'Line ID', role_tags: '角色標籤',
  is_primary: '主要聯絡人', is_active: '啟用', note: '備註', created_at: '建立時間', updated_at: '更新時間'
};

// Investor payment method columns
const investorPaymentColumns = ['id', 'investor_code', 'method_type', 'bank_name', 'bank_code', 'branch_name', 'account_name', 'account_number', 'is_default', 'note', 'created_at', 'updated_at'];
const investorPaymentLabels: Record<string, string> = {
  id: 'ID', investor_code: '投資方代碼', method_type: '付款方式', bank_name: '銀行名稱',
  bank_code: '銀行代碼', branch_name: '分行名稱', account_name: '戶名', account_number: '帳號',
  is_default: '預設', note: '備註', created_at: '建立時間', updated_at: '更新時間'
};

// Partner columns
const partnerColumns = ['id', 'name', 'partner_type', 'contact_person', 'contact_phone', 'email', 'address', 'is_active', 'note', 'created_at', 'updated_at'];
const partnerLabels: Record<string, string> = {
  id: 'ID', name: '廠商名稱', partner_type: '廠商類型', contact_person: '聯絡人',
  contact_phone: '聯絡電話', email: 'Email', address: '地址', is_active: '啟用',
  note: '備註', created_at: '建立時間', updated_at: '更新時間'
};

// Construction assignment columns
const constructionAssignmentColumns = ['id', 'project_code', 'partner_name', 'construction_work_type', 'assignment_status', 'planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date', 'note', 'created_at', 'updated_at'];
const constructionAssignmentLabels: Record<string, string> = {
  id: 'ID', project_code: '案場編號', partner_name: '廠商名稱', construction_work_type: '工程類型',
  assignment_status: '派工狀態', planned_start_date: '預計開始日', planned_end_date: '預計結束日',
  actual_start_date: '實際開始日', actual_end_date: '實際結束日', note: '備註',
  created_at: '建立時間', updated_at: '更新時間'
};

// System options columns
const systemOptionColumns = ['id', 'category', 'value', 'label', 'sort_order', 'is_active', 'created_at', 'updated_at'];
const systemOptionLabels: Record<string, string> = {
  id: 'ID', category: '類別', value: '值', label: '顯示名稱', sort_order: '排序',
  is_active: '啟用', created_at: '建立時間', updated_at: '更新時間'
};

// Module permissions columns
const modulePermissionColumns = ['id', 'user_email', 'module_name', 'can_view', 'can_create', 'can_edit', 'can_delete', 'created_at', 'updated_at'];
const modulePermissionLabels: Record<string, string> = {
  id: 'ID', user_email: '使用者Email', module_name: '模組名稱', can_view: '可檢視',
  can_create: '可新增', can_edit: '可編輯', can_delete: '可刪除',
  created_at: '建立時間', updated_at: '更新時間'
};

function formatDate(value: any): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  const str = String(value);
  // Already YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Parse and format
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return str;
}

function parseDate(value: any): string | null {
  if (!value || value === '' || value === null || value === undefined) return null;
  
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }
  
  const strValue = String(value).trim();
  if (!strValue) return null;
  
  // Excel serial number
  const numValue = Number(strValue);
  if (!isNaN(numValue) && numValue > 1000 && numValue < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + numValue * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  
  // YYYY/M/D or YYYY-M-D format
  const slashMatch = strValue.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (slashMatch) {
    const [, year, month, day] = slashMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  
  // ISO format
  const date = new Date(strValue);
  if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  
  return null;
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

// Fetch all records with pagination
type TableName = 'projects' | 'project_status_history' | 'construction_status_history' | 'documents' | 'document_files' | 'investors' | 'investor_contacts' | 'investor_payment_methods' | 'partners' | 'project_construction_assignments' | 'system_options' | 'module_permissions';

async function fetchAllRecords<T>(
  tableName: TableName,
  select: string = '*',
  orderBy: string = 'created_at'
): Promise<T[]> {
  const records: T[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select(select)
      .order(orderBy, { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      records.push(...(data as T[]));
      offset += pageSize;
      if (data.length < pageSize) hasMore = false;
    }
  }

  return records;
}

export function useProjectBackup() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BackupProgress>({ current: 0, total: 0, phase: 'preparing' });
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  // Export all project data to Excel with multiple sheets
  const exportFullBackup = useCallback(async () => {
    setIsProcessing(true);
    setProgress({ current: 0, total: 12, phase: 'preparing' });

    try {
      // 1. Fetch investors
      setProgress({ current: 1, total: 12, phase: 'exporting', currentSheet: '投資方' });
      const investors = await fetchAllRecords<Investor>('investors', '*', 'created_at');
      const investorIdToCode = new Map<string, string>();
      investors.forEach(i => investorIdToCode.set(i.id, i.investor_code));

      // 2. Fetch investor contacts
      setProgress({ current: 2, total: 12, phase: 'exporting', currentSheet: '投資方聯絡人' });
      const investorContacts = await fetchAllRecords<InvestorContact>('investor_contacts', '*', 'created_at');

      // 3. Fetch investor payment methods
      setProgress({ current: 3, total: 12, phase: 'exporting', currentSheet: '投資方付款方式' });
      const investorPayments = await fetchAllRecords<InvestorPaymentMethod>('investor_payment_methods', '*', 'created_at');

      // 4. Fetch partners
      setProgress({ current: 4, total: 12, phase: 'exporting', currentSheet: '廠商' });
      const partners = await fetchAllRecords<Partner>('partners', '*', 'created_at');
      const partnerIdToName = new Map<string, string>();
      partners.forEach(p => partnerIdToName.set(p.id, p.name));

      // 5. Fetch projects with investor info
      setProgress({ current: 5, total: 12, phase: 'exporting', currentSheet: '案場主表' });
      const projects = await fetchAllRecords<Project & { investors?: { investor_code: string } | null }>(
        'projects',
        '*, investors(investor_code)',
        'created_at'
      );
      const projectIdToCode = new Map<string, string>();
      projects.forEach(p => projectIdToCode.set(p.id, p.project_code));

      // 6. Fetch status history
      setProgress({ current: 6, total: 12, phase: 'exporting', currentSheet: '狀態歷程' });
      const statusHistory = await fetchAllRecords<ProjectStatusHistory>('project_status_history', '*', 'changed_at');

      // 7. Fetch construction history
      setProgress({ current: 7, total: 12, phase: 'exporting', currentSheet: '施工歷程' });
      const constructionHistory = await fetchAllRecords<ConstructionStatusHistory>('construction_status_history', '*', 'changed_at');

      // 8. Fetch construction assignments
      setProgress({ current: 8, total: 12, phase: 'exporting', currentSheet: '施工派工' });
      const constructionAssignments = await fetchAllRecords<ProjectConstructionAssignment>('project_construction_assignments', '*', 'created_at');

      // 9. Fetch documents
      setProgress({ current: 9, total: 12, phase: 'exporting', currentSheet: '文件' });
      const documents = await fetchAllRecords<Document>('documents', '*', 'created_at');

      // 10. Fetch document files
      setProgress({ current: 10, total: 12, phase: 'exporting', currentSheet: '文件附件' });
      const documentFiles = await fetchAllRecords<DocumentFile>('document_files', '*', 'uploaded_at');

      // 11. Fetch system options
      setProgress({ current: 11, total: 12, phase: 'exporting', currentSheet: '系統選項' });
      const systemOptions = await fetchAllRecords<SystemOption>('system_options', '*', 'created_at');

      // 12. Fetch module permissions with user info
      setProgress({ current: 12, total: 12, phase: 'exporting', currentSheet: '模組權限' });
      const modulePermissions = await fetchAllRecords<ModulePermission>('module_permissions', '*', 'created_at');
      
      // Build user ID to email map for permissions
      const { data: profiles } = await supabase.from('profiles').select('id, email');
      const userIdToEmail = new Map<string, string>();
      profiles?.forEach(p => userIdToEmail.set(p.id, p.email || ''));

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Helper to create sheet
      const createSheet = (data: any[], columns: string[], labels: Record<string, string>) => {
        if (data.length === 0) {
          const headers = columns.map(c => labels[c]);
          return XLSX.utils.aoa_to_sheet([headers]);
        }
        const sheet = XLSX.utils.json_to_sheet(data);
        sheet['!cols'] = columns.map(col => ({ wch: Math.max((labels[col]?.length || 10) * 2 + 5, 12) }));
        return sheet;
      };

      // 1. Investors sheet
      const investorData = investors.map(i => {
        const row: Record<string, any> = {};
        investorColumns.forEach(col => {
          row[investorLabels[col]] = (i as any)[col] ?? '';
        });
        return row;
      });
      XLSX.utils.book_append_sheet(workbook, createSheet(investorData, investorColumns, investorLabels), '投資方');

      // 2. Investor contacts sheet
      const contactData = investorContacts.map(c => {
        const row: Record<string, any> = {};
        investorContactColumns.forEach(col => {
          if (col === 'investor_code') {
            row[investorContactLabels[col]] = investorIdToCode.get(c.investor_id) || '';
          } else if (col === 'role_tags') {
            row[investorContactLabels[col]] = Array.isArray(c.role_tags) ? c.role_tags.join(', ') : '';
          } else {
            row[investorContactLabels[col]] = (c as any)[col] ?? '';
          }
        });
        return row;
      });
      XLSX.utils.book_append_sheet(workbook, createSheet(contactData, investorContactColumns, investorContactLabels), '投資方聯絡人');

      // 3. Investor payment methods sheet
      const paymentData = investorPayments.map(p => {
        const row: Record<string, any> = {};
        investorPaymentColumns.forEach(col => {
          if (col === 'investor_code') {
            row[investorPaymentLabels[col]] = investorIdToCode.get(p.investor_id) || '';
          } else {
            row[investorPaymentLabels[col]] = (p as any)[col] ?? '';
          }
        });
        return row;
      });
      XLSX.utils.book_append_sheet(workbook, createSheet(paymentData, investorPaymentColumns, investorPaymentLabels), '投資方付款方式');

      // 4. Partners sheet
      const partnerData = partners.map(p => {
        const row: Record<string, any> = {};
        partnerColumns.forEach(col => {
          row[partnerLabels[col]] = (p as any)[col] ?? '';
        });
        return row;
      });
      XLSX.utils.book_append_sheet(workbook, createSheet(partnerData, partnerColumns, partnerLabels), '廠商');

      // 5. Projects sheet
      const projectData = projects.map(p => {
        const row: Record<string, any> = {};
        projectColumns.forEach(col => {
          if (col === 'investor_code') {
            row[projectLabels[col]] = p.investors?.investor_code || '';
          } else if (col === 'approval_date') {
            row[projectLabels[col]] = formatDate((p as any)[col]);
          } else {
            row[projectLabels[col]] = (p as any)[col] ?? '';
          }
        });
        return row;
      });
      XLSX.utils.book_append_sheet(workbook, createSheet(projectData, projectColumns, projectLabels), '案場主表');

      // 6. Status history sheet
      const statusData = statusHistory.map(h => {
        const row: Record<string, any> = {};
        statusHistoryColumns.forEach(col => {
          if (col === 'project_code') {
            row[statusHistoryLabels[col]] = projectIdToCode.get(h.project_id) || '';
          } else if (col === 'changed_at') {
            row[statusHistoryLabels[col]] = formatDate(h.changed_at);
          } else {
            row[statusHistoryLabels[col]] = (h as any)[col] ?? '';
          }
        });
        return row;
      });
      XLSX.utils.book_append_sheet(workbook, createSheet(statusData, statusHistoryColumns, statusHistoryLabels), '狀態歷程');

      // 7. Construction history sheet
      const constructionData = constructionHistory.map(h => {
        const row: Record<string, any> = {};
        constructionHistoryColumns.forEach(col => {
          if (col === 'project_code') {
            row[constructionHistoryLabels[col]] = projectIdToCode.get(h.project_id) || '';
          } else if (col === 'changed_at') {
            row[constructionHistoryLabels[col]] = formatDate(h.changed_at);
          } else {
            row[constructionHistoryLabels[col]] = (h as any)[col] ?? '';
          }
        });
        return row;
      });
      XLSX.utils.book_append_sheet(workbook, createSheet(constructionData, constructionHistoryColumns, constructionHistoryLabels), '施工歷程');

      // 8. Construction assignments sheet
      const assignmentData = constructionAssignments.map(a => {
        const row: Record<string, any> = {};
        constructionAssignmentColumns.forEach(col => {
          if (col === 'project_code') {
            row[constructionAssignmentLabels[col]] = projectIdToCode.get(a.project_id) || '';
          } else if (col === 'partner_name') {
            row[constructionAssignmentLabels[col]] = a.partner_id ? partnerIdToName.get(a.partner_id) || '' : '';
          } else if (['planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date'].includes(col)) {
            row[constructionAssignmentLabels[col]] = formatDate((a as any)[col]);
          } else {
            row[constructionAssignmentLabels[col]] = (a as any)[col] ?? '';
          }
        });
        return row;
      });
      XLSX.utils.book_append_sheet(workbook, createSheet(assignmentData, constructionAssignmentColumns, constructionAssignmentLabels), '施工派工');

      // 9. Documents sheet
      const docData = documents.map(d => {
        const row: Record<string, any> = {};
        documentColumns.forEach(col => {
          if (col === 'project_code') {
            row[documentLabels[col]] = projectIdToCode.get(d.project_id) || '';
          } else if (['submitted_at', 'issued_at', 'due_at'].includes(col)) {
            row[documentLabels[col]] = formatDate((d as any)[col]);
          } else {
            row[documentLabels[col]] = (d as any)[col] ?? '';
          }
        });
        return row;
      });
      XLSX.utils.book_append_sheet(workbook, createSheet(docData, documentColumns, documentLabels), '文件');

      // 10. Document files sheet
      const fileData = documentFiles.map(f => {
        const row: Record<string, any> = {};
        documentFileColumns.forEach(col => {
          if (col === 'uploaded_at') {
            row[documentFileLabels[col]] = formatDate(f.uploaded_at);
          } else {
            row[documentFileLabels[col]] = (f as any)[col] ?? '';
          }
        });
        return row;
      });
      XLSX.utils.book_append_sheet(workbook, createSheet(fileData, documentFileColumns, documentFileLabels), '文件附件');

      // 11. System options sheet
      const optionData = systemOptions.map(o => {
        const row: Record<string, any> = {};
        systemOptionColumns.forEach(col => {
          row[systemOptionLabels[col]] = (o as any)[col] ?? '';
        });
        return row;
      });
      XLSX.utils.book_append_sheet(workbook, createSheet(optionData, systemOptionColumns, systemOptionLabels), '系統選項');

      // 12. Module permissions sheet
      const permissionData = modulePermissions.map(p => {
        const row: Record<string, any> = {};
        modulePermissionColumns.forEach(col => {
          if (col === 'user_email') {
            row[modulePermissionLabels[col]] = userIdToEmail.get(p.user_id) || '';
          } else {
            row[modulePermissionLabels[col]] = (p as any)[col] ?? '';
          }
        });
        return row;
      });
      XLSX.utils.book_append_sheet(workbook, createSheet(permissionData, modulePermissionColumns, modulePermissionLabels), '模組權限');

      // Build export stats
      const exportStats: ExportStats = {
        investors: investors.length,
        investorContacts: investorContacts.length,
        investorPaymentMethods: investorPayments.length,
        partners: partners.length,
        projects: projects.length,
        statusHistory: statusHistory.length,
        constructionHistory: constructionHistory.length,
        constructionAssignments: constructionAssignments.length,
        documents: documents.length,
        documentFiles: documentFiles.length,
        systemOptions: systemOptions.length,
        modulePermissions: modulePermissions.length,
      };

      // Download
      const timestamp = new Date().toISOString().slice(0, 10);
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadFile(blob, `案場完整備份_${timestamp}.xlsx`);

      setProgress({ current: 12, total: 12, phase: 'done', exportStats });
      toast.success('備份匯出完成', {
        description: `投資方 ${investors.length}、廠商 ${partners.length}、案場 ${projects.length}、權限 ${modulePermissions.length} 筆`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('匯出失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Download import template
  const downloadTemplate = useCallback(() => {
    const workbook = XLSX.utils.book_new();

    // Helper to create template sheet
    const createTemplateSheet = (columns: string[], labels: Record<string, string>) => {
      const headers = columns.map(col => labels[col]);
      return XLSX.utils.aoa_to_sheet([headers]);
    };

    // Add all sheets in order
    XLSX.utils.book_append_sheet(workbook, createTemplateSheet(investorColumns, investorLabels), '投資方');
    XLSX.utils.book_append_sheet(workbook, createTemplateSheet(investorContactColumns, investorContactLabels), '投資方聯絡人');
    XLSX.utils.book_append_sheet(workbook, createTemplateSheet(investorPaymentColumns, investorPaymentLabels), '投資方付款方式');
    XLSX.utils.book_append_sheet(workbook, createTemplateSheet(partnerColumns, partnerLabels), '廠商');
    XLSX.utils.book_append_sheet(workbook, createTemplateSheet(projectColumns, projectLabels), '案場主表');
    XLSX.utils.book_append_sheet(workbook, createTemplateSheet(statusHistoryColumns, statusHistoryLabels), '狀態歷程');
    XLSX.utils.book_append_sheet(workbook, createTemplateSheet(constructionHistoryColumns, constructionHistoryLabels), '施工歷程');
    XLSX.utils.book_append_sheet(workbook, createTemplateSheet(constructionAssignmentColumns, constructionAssignmentLabels), '施工派工');
    XLSX.utils.book_append_sheet(workbook, createTemplateSheet(documentColumns, documentLabels), '文件');
    XLSX.utils.book_append_sheet(workbook, createTemplateSheet(documentFileColumns, documentFileLabels), '文件附件');
    XLSX.utils.book_append_sheet(workbook, createTemplateSheet(systemOptionColumns, systemOptionLabels), '系統選項');
    XLSX.utils.book_append_sheet(workbook, createTemplateSheet(modulePermissionColumns, modulePermissionLabels), '模組權限');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadFile(blob, '案場匯入範本.xlsx');

    toast.success('範本下載成功');
  }, []);

  // Import from Excel file
  const importFullBackup = useCallback(async (file: File, mode: ImportMode) => {
    setIsProcessing(true);
    setImportSummary(null);

    const summary: ImportSummary = {
      investors: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      investorContacts: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      investorPaymentMethods: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      partners: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      projects: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      statusHistory: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      constructionHistory: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      constructionAssignments: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      documents: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      documentFiles: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      systemOptions: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      modulePermissions: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      errorList: [],
    };

    try {
      setProgress({ current: 0, total: 12, phase: 'preparing' });

      // Read Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });

      // Helper to reverse lookup column name
      const reverseLabels = (labels: Record<string, string>) => {
        const reversed: Record<string, string> = {};
        Object.entries(labels).forEach(([key, label]) => { reversed[label] = key; });
        return reversed;
      };

      // Build lookup maps - will be populated as we import
      const investorCodeToId = new Map<string, string>();
      const partnerNameToId = new Map<string, string>();
      const projectCodeToId = new Map<string, string>();
      const siteCodeToId = new Map<string, string>();

      // Fetch existing data for lookups
      const { data: existingInvestors } = await supabase.from('investors').select('id, investor_code');
      existingInvestors?.forEach(i => investorCodeToId.set(i.investor_code.toUpperCase(), i.id));

      const { data: existingPartners } = await supabase.from('partners').select('id, name');
      existingPartners?.forEach(p => partnerNameToId.set(p.name, p.id));

      const { data: existingProjects } = await supabase.from('projects').select('id, project_code, site_code_display');
      existingProjects?.forEach(p => {
        projectCodeToId.set(p.project_code, p.id);
        if (p.site_code_display) siteCodeToId.set(p.site_code_display, p.id);
      });

      // 1. Import Investors
      const investorSheetName = workbook.SheetNames.find(s => s === '投資方');
      if (investorSheetName) {
        setProgress({ current: 1, total: 11, phase: 'importing', currentSheet: '投資方' });
        const sheet = workbook.Sheets[investorSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        const reversedLabels = reverseLabels(investorLabels);

        const { data: existingData } = await supabase.from('investors').select('id, investor_code');
        const existingIds = new Set(existingData?.map(i => i.id) || []);
        const existingCodes = new Set(existingData?.map(i => i.investor_code.toUpperCase()) || []);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          try {
            const mapped: Record<string, any> = {};
            let providedId: string | null = null;
            let investorCode: string | null = null;

            Object.entries(row).forEach(([label, value]) => {
              const key = reversedLabels[label];
              if (!key || value === '' || value === null) return;
              if (key === 'id') providedId = String(value);
              else if (key === 'investor_code') {
                investorCode = String(value).toUpperCase();
                mapped[key] = investorCode;
              } else if (!['created_at', 'updated_at', 'created_by'].includes(key)) {
                mapped[key] = String(value);
              }
            });

            // Validate required fields
            if (!investorCode) {
              summary.errorList.push({ row: rowNum, sheet: '投資方', message: '缺少投資方代碼', errorType: 'validation' });
              summary.investors.errors++;
              continue;
            }
            if (!mapped.company_name) {
              summary.errorList.push({ row: rowNum, sheet: '投資方', field: 'company_name', message: '缺少公司名稱', errorType: 'validation', code: investorCode });
              summary.investors.errors++;
              continue;
            }

            // Determine existing ID
            let existingId = providedId && existingIds.has(providedId) ? providedId : null;
            if (!existingId && existingCodes.has(investorCode)) {
              const found = existingData?.find(i => i.investor_code.toUpperCase() === investorCode);
              if (found) existingId = found.id;
            }

            if (existingId) {
              if (mode === 'insert') {
                summary.errorList.push({ row: rowNum, sheet: '投資方', message: '投資方已存在（僅新增模式）', errorType: 'unique_constraint', code: investorCode });
                summary.investors.errors++;
              } else if (mode === 'skip') {
                summary.investors.skipped++;
                investorCodeToId.set(investorCode, existingId);
              } else {
                const { error } = await supabase.from('investors').update(mapped as any).eq('id', existingId);
                if (error) {
                  summary.errorList.push({ row: rowNum, sheet: '投資方', message: error.message, errorType: 'unknown', code: investorCode });
                  summary.investors.errors++;
                } else {
                  summary.investors.updated++;
                  investorCodeToId.set(investorCode, existingId);
                }
              }
            } else {
              const { data: inserted, error } = await supabase.from('investors').insert(mapped as any).select('id').single();
              if (error) {
                summary.errorList.push({ row: rowNum, sheet: '投資方', message: error.message, errorType: 'unknown', code: investorCode });
                summary.investors.errors++;
              } else if (inserted) {
                summary.investors.inserted++;
                investorCodeToId.set(investorCode, inserted.id);
              }
            }
          } catch (err) {
            summary.errorList.push({ row: rowNum, sheet: '投資方', message: err instanceof Error ? err.message : '未知錯誤', errorType: 'unknown' });
            summary.investors.errors++;
          }
        }
      }

      // 2. Import Investor Contacts
      const contactSheetName = workbook.SheetNames.find(s => s === '投資方聯絡人');
      if (contactSheetName) {
        setProgress({ current: 2, total: 11, phase: 'importing', currentSheet: '投資方聯絡人' });
        const sheet = workbook.Sheets[contactSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        const reversedLabels = reverseLabels(investorContactLabels);

        const { data: existingData } = await supabase.from('investor_contacts').select('id');
        const existingIds = new Set(existingData?.map(c => c.id) || []);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          try {
            const mapped: Record<string, any> = {};
            let providedId: string | null = null;
            let investorCode: string | null = null;

            Object.entries(row).forEach(([label, value]) => {
              const key = reversedLabels[label];
              if (!key || value === '' || value === null) return;
              if (key === 'id') providedId = String(value);
              else if (key === 'investor_code') investorCode = String(value).toUpperCase();
              else if (key === 'role_tags') {
                const tags = String(value).split(',').map(t => t.trim()).filter(t => t);
                mapped[key] = tags;
              } else if (key === 'is_primary' || key === 'is_active') {
                mapped[key] = String(value).toLowerCase() === 'true' || value === true;
              } else if (!['created_at', 'updated_at', 'created_by'].includes(key)) {
                mapped[key] = String(value);
              }
            });

            if (!investorCode) {
              summary.errorList.push({ row: rowNum, sheet: '投資方聯絡人', message: '缺少投資方代碼', errorType: 'validation' });
              summary.investorContacts.errors++;
              continue;
            }
            if (!mapped.contact_name) {
              summary.errorList.push({ row: rowNum, sheet: '投資方聯絡人', field: 'contact_name', message: '缺少聯絡人姓名', errorType: 'validation', code: investorCode });
              summary.investorContacts.errors++;
              continue;
            }

            const investorId = investorCodeToId.get(investorCode);
            if (!investorId) {
              summary.errorList.push({ row: rowNum, sheet: '投資方聯絡人', message: `找不到投資方代碼「${investorCode}」`, errorType: 'not_found', code: investorCode });
              summary.investorContacts.errors++;
              continue;
            }
            mapped.investor_id = investorId;

            const existingId = providedId && existingIds.has(providedId) ? providedId : null;

            if (existingId) {
              if (mode === 'insert') {
                summary.errorList.push({ row: rowNum, sheet: '投資方聯絡人', message: '記錄已存在（僅新增模式）', errorType: 'unique_constraint', code: investorCode });
                summary.investorContacts.errors++;
              } else if (mode === 'skip') {
                summary.investorContacts.skipped++;
              } else {
                const { error } = await supabase.from('investor_contacts').update(mapped).eq('id', existingId);
                if (error) {
                  summary.errorList.push({ row: rowNum, sheet: '投資方聯絡人', message: error.message, errorType: 'unknown', code: investorCode });
                  summary.investorContacts.errors++;
                } else {
                  summary.investorContacts.updated++;
                }
              }
            } else {
              const { error } = await supabase.from('investor_contacts').insert(mapped as any);
              if (error) {
                summary.errorList.push({ row: rowNum, sheet: '投資方聯絡人', message: error.message, errorType: 'unknown', code: investorCode });
                summary.investorContacts.errors++;
              } else {
                summary.investorContacts.inserted++;
              }
            }
          } catch (err) {
            summary.errorList.push({ row: rowNum, sheet: '投資方聯絡人', message: err instanceof Error ? err.message : '未知錯誤', errorType: 'unknown' });
            summary.investorContacts.errors++;
          }
        }
      }

      // 3. Import Investor Payment Methods
      const paymentSheetName = workbook.SheetNames.find(s => s === '投資方付款方式');
      if (paymentSheetName) {
        setProgress({ current: 3, total: 11, phase: 'importing', currentSheet: '投資方付款方式' });
        const sheet = workbook.Sheets[paymentSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        const reversedLabels = reverseLabels(investorPaymentLabels);

        const { data: existingData } = await supabase.from('investor_payment_methods').select('id');
        const existingIds = new Set(existingData?.map(p => p.id) || []);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          try {
            const mapped: Record<string, any> = {};
            let providedId: string | null = null;
            let investorCode: string | null = null;

            Object.entries(row).forEach(([label, value]) => {
              const key = reversedLabels[label];
              if (!key || value === '' || value === null) return;
              if (key === 'id') providedId = String(value);
              else if (key === 'investor_code') investorCode = String(value).toUpperCase();
              else if (key === 'is_default') {
                mapped[key] = String(value).toLowerCase() === 'true' || value === true;
              } else if (!['created_at', 'updated_at', 'created_by'].includes(key)) {
                mapped[key] = String(value);
              }
            });

            if (!investorCode) {
              summary.errorList.push({ row: rowNum, sheet: '投資方付款方式', message: '缺少投資方代碼', errorType: 'validation' });
              summary.investorPaymentMethods.errors++;
              continue;
            }
            if (!mapped.method_type) {
              summary.errorList.push({ row: rowNum, sheet: '投資方付款方式', field: 'method_type', message: '缺少付款方式', errorType: 'validation', code: investorCode });
              summary.investorPaymentMethods.errors++;
              continue;
            }

            const investorId = investorCodeToId.get(investorCode);
            if (!investorId) {
              summary.errorList.push({ row: rowNum, sheet: '投資方付款方式', message: `找不到投資方代碼「${investorCode}」`, errorType: 'not_found', code: investorCode });
              summary.investorPaymentMethods.errors++;
              continue;
            }
            mapped.investor_id = investorId;

            const existingId = providedId && existingIds.has(providedId) ? providedId : null;

            if (existingId) {
              if (mode === 'insert') {
                summary.errorList.push({ row: rowNum, sheet: '投資方付款方式', message: '記錄已存在（僅新增模式）', errorType: 'unique_constraint', code: investorCode });
                summary.investorPaymentMethods.errors++;
              } else if (mode === 'skip') {
                summary.investorPaymentMethods.skipped++;
              } else {
                const { error } = await supabase.from('investor_payment_methods').update(mapped).eq('id', existingId);
                if (error) {
                  summary.errorList.push({ row: rowNum, sheet: '投資方付款方式', message: error.message, errorType: 'unknown', code: investorCode });
                  summary.investorPaymentMethods.errors++;
                } else {
                  summary.investorPaymentMethods.updated++;
                }
              }
            } else {
              const { error } = await supabase.from('investor_payment_methods').insert(mapped as any);
              if (error) {
                summary.errorList.push({ row: rowNum, sheet: '投資方付款方式', message: error.message, errorType: 'unknown', code: investorCode });
                summary.investorPaymentMethods.errors++;
              } else {
                summary.investorPaymentMethods.inserted++;
              }
            }
          } catch (err) {
            summary.errorList.push({ row: rowNum, sheet: '投資方付款方式', message: err instanceof Error ? err.message : '未知錯誤', errorType: 'unknown' });
            summary.investorPaymentMethods.errors++;
          }
        }
      }

      // 4. Import Partners
      const partnerSheetName = workbook.SheetNames.find(s => s === '廠商');
      if (partnerSheetName) {
        setProgress({ current: 4, total: 11, phase: 'importing', currentSheet: '廠商' });
        const sheet = workbook.Sheets[partnerSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        const reversedLabels = reverseLabels(partnerLabels);

        const { data: existingData } = await supabase.from('partners').select('id, name');
        const existingIds = new Set(existingData?.map(p => p.id) || []);
        const existingNames = new Map(existingData?.map(p => [p.name, p.id]) || []);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          try {
            const mapped: Record<string, any> = {};
            let providedId: string | null = null;
            let partnerName: string | null = null;

            Object.entries(row).forEach(([label, value]) => {
              const key = reversedLabels[label];
              if (!key || value === '' || value === null) return;
              if (key === 'id') providedId = String(value);
              else if (key === 'name') {
                partnerName = String(value);
                mapped[key] = partnerName;
              } else if (key === 'is_active') {
                mapped[key] = String(value).toLowerCase() === 'true' || value === true;
              } else if (!['created_at', 'updated_at', 'created_by'].includes(key)) {
                mapped[key] = String(value);
              }
            });

            if (!partnerName) {
              summary.errorList.push({ row: rowNum, sheet: '廠商', message: '缺少廠商名稱', errorType: 'validation' });
              summary.partners.errors++;
              continue;
            }

            // Determine existing ID
            let existingId = providedId && existingIds.has(providedId) ? providedId : null;
            if (!existingId && existingNames.has(partnerName)) {
              existingId = existingNames.get(partnerName) || null;
            }

            if (existingId) {
              if (mode === 'insert') {
                summary.errorList.push({ row: rowNum, sheet: '廠商', message: '廠商已存在（僅新增模式）', errorType: 'unique_constraint', code: partnerName });
                summary.partners.errors++;
              } else if (mode === 'skip') {
                summary.partners.skipped++;
                partnerNameToId.set(partnerName, existingId);
              } else {
                const { error } = await supabase.from('partners').update(mapped as any).eq('id', existingId);
                if (error) {
                  summary.errorList.push({ row: rowNum, sheet: '廠商', message: error.message, errorType: 'unknown', code: partnerName });
                  summary.partners.errors++;
                } else {
                  summary.partners.updated++;
                  partnerNameToId.set(partnerName, existingId);
                }
              }
            } else {
              const { data: inserted, error } = await supabase.from('partners').insert(mapped as any).select('id').single();
              if (error) {
                summary.errorList.push({ row: rowNum, sheet: '廠商', message: error.message, errorType: 'unknown', code: partnerName });
                summary.partners.errors++;
              } else if (inserted) {
                summary.partners.inserted++;
                partnerNameToId.set(partnerName, inserted.id);
              }
            }
          } catch (err) {
            summary.errorList.push({ row: rowNum, sheet: '廠商', message: err instanceof Error ? err.message : '未知錯誤', errorType: 'unknown' });
            summary.partners.errors++;
          }
        }
      }

      // 5. Import Projects
      const projectSheetName = workbook.SheetNames.find(s => s.includes('案場主表'));
      if (projectSheetName) {
        setProgress({ current: 5, total: 11, phase: 'importing', currentSheet: '案場主表' });
        const sheet = workbook.Sheets[projectSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        const reversedLabels = reverseLabels(projectLabels);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          try {
            const mapped: Record<string, any> = {};
            let providedId: string | null = null;
            let projectCode: string | null = null;
            let siteCode: string | null = null;
            let investorCode: string | null = null;

            Object.entries(row).forEach(([label, value]) => {
              const key = reversedLabels[label];
              if (!key || value === '' || value === null) return;

              if (key === 'id') {
                providedId = String(value);
              } else if (key === 'investor_code') {
                investorCode = String(value).toUpperCase();
              } else if (key === 'project_code') {
                projectCode = String(value);
                mapped[key] = projectCode;
              } else if (key === 'site_code_display') {
                siteCode = String(value);
                mapped[key] = siteCode;
              } else if (key === 'approval_date') {
                const d = parseDate(value);
                if (d) mapped[key] = d;
              } else if (['capacity_kwp', 'actual_installed_capacity', 'fiscal_year', 'intake_year', 'seq'].includes(key)) {
                const num = Number(value);
                if (!isNaN(num)) mapped[key] = num;
              } else if (!['created_at', 'updated_at', 'created_by'].includes(key)) {
                mapped[key] = String(value);
              }
            });

            // Validate required fields
            if (!mapped.project_code) {
              summary.errorList.push({ row: rowNum, sheet: '案場主表', message: '缺少案場編號', errorType: 'validation' });
              summary.projects.errors++;
              continue;
            }
            if (!mapped.project_name) {
              summary.errorList.push({ row: rowNum, sheet: '案場主表', field: 'project_name', message: '缺少案場名稱', errorType: 'validation', code: mapped.project_code });
              summary.projects.errors++;
              continue;
            }

            // Resolve investor
            if (investorCode) {
              const investorId = investorCodeToId.get(investorCode);
              if (investorId) {
                mapped.investor_id = investorId;
              } else {
                summary.errorList.push({ row: rowNum, sheet: '案場主表', field: 'investor_code', message: `找不到投資方代碼「${investorCode}」`, errorType: 'not_found', code: mapped.project_code });
                summary.projects.errors++;
                continue;
              }
            }

            // Determine existing ID
            let existingId = providedId && projectCodeToId.has(providedId) ? providedId : null;
            if (!existingId && projectCode) existingId = projectCodeToId.get(projectCode) || null;
            if (!existingId && siteCode) existingId = siteCodeToId.get(siteCode) || null;

            // Execute based on mode
            if (existingId) {
              if (mode === 'insert') {
                summary.errorList.push({ row: rowNum, sheet: '案場主表', message: '案場已存在（僅新增模式）', errorType: 'unique_constraint', code: mapped.project_code as string });
                summary.projects.errors++;
              } else if (mode === 'skip') {
                summary.projects.skipped++;
              } else {
                const { error } = await supabase.from('projects').update(mapped as any).eq('id', existingId);
                if (error) {
                  summary.errorList.push({ row: rowNum, sheet: '案場主表', message: error.message, errorType: 'unknown', code: mapped.project_code as string });
                  summary.projects.errors++;
                } else {
                  summary.projects.updated++;
                  projectCodeToId.set(mapped.project_code as string, existingId);
                }
              }
            } else {
              const { data: inserted, error } = await supabase.from('projects').insert(mapped as any).select('id').single();
              if (error) {
                summary.errorList.push({ row: rowNum, sheet: '案場主表', message: error.message, errorType: 'unknown', code: mapped.project_code as string });
                summary.projects.errors++;
              } else if (inserted) {
                summary.projects.inserted++;
                projectCodeToId.set(mapped.project_code as string, inserted.id);
              }
            }
          } catch (err) {
            summary.errorList.push({ row: rowNum, sheet: '案場主表', message: err instanceof Error ? err.message : '未知錯誤', errorType: 'unknown' });
            summary.projects.errors++;
          }
        }
      }

      // 6. Import Status History
      const statusSheetName = workbook.SheetNames.find(s => s.includes('狀態歷程'));
      if (statusSheetName) {
        setProgress({ current: 6, total: 11, phase: 'importing', currentSheet: '狀態歷程' });
        const sheet = workbook.Sheets[statusSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        const reversedLabels = reverseLabels(statusHistoryLabels);

        const { data: existingHistory } = await supabase.from('project_status_history').select('id');
        const existingHistoryIds = new Set(existingHistory?.map(h => h.id) || []);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          try {
            const mapped: Record<string, any> = {};
            let providedId: string | null = null;
            let projectCode: string | null = null;

            Object.entries(row).forEach(([label, value]) => {
              const key = reversedLabels[label];
              if (!key || value === '' || value === null) return;
              if (key === 'id') providedId = String(value);
              else if (key === 'project_code') projectCode = String(value);
              else if (key === 'changed_at') {
                const d = parseDate(value);
                if (d) mapped[key] = d;
              } else mapped[key] = String(value);
            });

            if (!projectCode) {
              summary.errorList.push({ row: rowNum, sheet: '狀態歷程', message: '缺少案場編號', errorType: 'validation' });
              summary.statusHistory.errors++;
              continue;
            }

            const projectId = projectCodeToId.get(projectCode);
            if (!projectId) {
              summary.errorList.push({ row: rowNum, sheet: '狀態歷程', message: `找不到案場「${projectCode}」`, errorType: 'not_found', code: projectCode });
              summary.statusHistory.errors++;
              continue;
            }
            mapped.project_id = projectId;

            const existingId = providedId && existingHistoryIds.has(providedId) ? providedId : null;

            if (existingId) {
              if (mode === 'insert') {
                summary.errorList.push({ row: rowNum, sheet: '狀態歷程', message: '記錄已存在（僅新增模式）', errorType: 'unique_constraint', code: projectCode });
                summary.statusHistory.errors++;
              } else if (mode === 'skip') {
                summary.statusHistory.skipped++;
              } else {
                const { error } = await supabase.from('project_status_history').update(mapped).eq('id', existingId);
                if (error) {
                  summary.errorList.push({ row: rowNum, sheet: '狀態歷程', message: error.message, errorType: 'unknown', code: projectCode });
                  summary.statusHistory.errors++;
                } else {
                  summary.statusHistory.updated++;
                }
              }
            } else {
              const { error } = await supabase.from('project_status_history').insert(mapped as any);
              if (error) {
                summary.errorList.push({ row: rowNum, sheet: '狀態歷程', message: error.message, errorType: 'unknown', code: projectCode });
                summary.statusHistory.errors++;
              } else {
                summary.statusHistory.inserted++;
              }
            }
          } catch (err) {
            summary.errorList.push({ row: rowNum, sheet: '狀態歷程', message: err instanceof Error ? err.message : '未知錯誤', errorType: 'unknown' });
            summary.statusHistory.errors++;
          }
        }
      }

      // 7. Import Construction History
      const constructionSheetName = workbook.SheetNames.find(s => s.includes('施工歷程'));
      if (constructionSheetName) {
        setProgress({ current: 7, total: 11, phase: 'importing', currentSheet: '施工歷程' });
        const sheet = workbook.Sheets[constructionSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        const reversedLabels = reverseLabels(constructionHistoryLabels);

        const { data: existingHistory } = await supabase.from('construction_status_history').select('id');
        const existingHistoryIds = new Set(existingHistory?.map(h => h.id) || []);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          try {
            const mapped: Record<string, any> = {};
            let providedId: string | null = null;
            let projectCode: string | null = null;

            Object.entries(row).forEach(([label, value]) => {
              const key = reversedLabels[label];
              if (!key || value === '' || value === null) return;
              if (key === 'id') providedId = String(value);
              else if (key === 'project_code') projectCode = String(value);
              else if (key === 'changed_at') {
                const d = parseDate(value);
                if (d) mapped[key] = d;
              } else mapped[key] = String(value);
            });

            if (!projectCode) {
              summary.errorList.push({ row: rowNum, sheet: '施工歷程', message: '缺少案場編號', errorType: 'validation' });
              summary.constructionHistory.errors++;
              continue;
            }

            const projectId = projectCodeToId.get(projectCode);
            if (!projectId) {
              summary.errorList.push({ row: rowNum, sheet: '施工歷程', message: `找不到案場「${projectCode}」`, errorType: 'not_found', code: projectCode });
              summary.constructionHistory.errors++;
              continue;
            }
            mapped.project_id = projectId;

            const existingId = providedId && existingHistoryIds.has(providedId) ? providedId : null;

            if (existingId) {
              if (mode === 'insert') {
                summary.errorList.push({ row: rowNum, sheet: '施工歷程', message: '記錄已存在（僅新增模式）', errorType: 'unique_constraint', code: projectCode });
                summary.constructionHistory.errors++;
              } else if (mode === 'skip') {
                summary.constructionHistory.skipped++;
              } else {
                const { error } = await supabase.from('construction_status_history').update(mapped).eq('id', existingId);
                if (error) {
                  summary.errorList.push({ row: rowNum, sheet: '施工歷程', message: error.message, errorType: 'unknown', code: projectCode });
                  summary.constructionHistory.errors++;
                } else {
                  summary.constructionHistory.updated++;
                }
              }
            } else {
              const { error } = await supabase.from('construction_status_history').insert(mapped as any);
              if (error) {
                summary.errorList.push({ row: rowNum, sheet: '施工歷程', message: error.message, errorType: 'unknown', code: projectCode });
                summary.constructionHistory.errors++;
              } else {
                summary.constructionHistory.inserted++;
              }
            }
          } catch (err) {
            summary.errorList.push({ row: rowNum, sheet: '施工歷程', message: err instanceof Error ? err.message : '未知錯誤', errorType: 'unknown' });
            summary.constructionHistory.errors++;
          }
        }
      }

      // 8. Import Construction Assignments
      const assignmentSheetName = workbook.SheetNames.find(s => s.includes('施工派工'));
      if (assignmentSheetName) {
        setProgress({ current: 8, total: 11, phase: 'importing', currentSheet: '施工派工' });
        const sheet = workbook.Sheets[assignmentSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        const reversedLabels = reverseLabels(constructionAssignmentLabels);

        const { data: existingData } = await supabase.from('project_construction_assignments').select('id');
        const existingIds = new Set(existingData?.map(a => a.id) || []);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          try {
            const mapped: Record<string, any> = {};
            let providedId: string | null = null;
            let projectCode: string | null = null;
            let partnerName: string | null = null;

            Object.entries(row).forEach(([label, value]) => {
              const key = reversedLabels[label];
              if (!key || value === '' || value === null) return;
              if (key === 'id') providedId = String(value);
              else if (key === 'project_code') projectCode = String(value);
              else if (key === 'partner_name') partnerName = String(value);
              else if (['planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date'].includes(key)) {
                const d = parseDate(value);
                if (d) mapped[key] = d;
              } else if (!['created_at', 'updated_at', 'created_by'].includes(key)) {
                mapped[key] = String(value);
              }
            });

            if (!projectCode) {
              summary.errorList.push({ row: rowNum, sheet: '施工派工', message: '缺少案場編號', errorType: 'validation' });
              summary.constructionAssignments.errors++;
              continue;
            }
            if (!mapped.construction_work_type) {
              summary.errorList.push({ row: rowNum, sheet: '施工派工', message: '缺少工程類型', errorType: 'validation', code: projectCode });
              summary.constructionAssignments.errors++;
              continue;
            }

            const projectId = projectCodeToId.get(projectCode);
            if (!projectId) {
              summary.errorList.push({ row: rowNum, sheet: '施工派工', message: `找不到案場「${projectCode}」`, errorType: 'not_found', code: projectCode });
              summary.constructionAssignments.errors++;
              continue;
            }
            mapped.project_id = projectId;

            if (partnerName) {
              const partnerId = partnerNameToId.get(partnerName);
              if (partnerId) {
                mapped.partner_id = partnerId;
              } else {
                summary.errorList.push({ row: rowNum, sheet: '施工派工', message: `找不到廠商「${partnerName}」`, errorType: 'not_found', code: projectCode });
                summary.constructionAssignments.errors++;
                continue;
              }
            }

            const existingId = providedId && existingIds.has(providedId) ? providedId : null;

            if (existingId) {
              if (mode === 'insert') {
                summary.errorList.push({ row: rowNum, sheet: '施工派工', message: '記錄已存在（僅新增模式）', errorType: 'unique_constraint', code: projectCode });
                summary.constructionAssignments.errors++;
              } else if (mode === 'skip') {
                summary.constructionAssignments.skipped++;
              } else {
                const { error } = await supabase.from('project_construction_assignments').update(mapped).eq('id', existingId);
                if (error) {
                  summary.errorList.push({ row: rowNum, sheet: '施工派工', message: error.message, errorType: 'unknown', code: projectCode });
                  summary.constructionAssignments.errors++;
                } else {
                  summary.constructionAssignments.updated++;
                }
              }
            } else {
              const { error } = await supabase.from('project_construction_assignments').insert(mapped as any);
              if (error) {
                summary.errorList.push({ row: rowNum, sheet: '施工派工', message: error.message, errorType: 'unknown', code: projectCode });
                summary.constructionAssignments.errors++;
              } else {
                summary.constructionAssignments.inserted++;
              }
            }
          } catch (err) {
            summary.errorList.push({ row: rowNum, sheet: '施工派工', message: err instanceof Error ? err.message : '未知錯誤', errorType: 'unknown' });
            summary.constructionAssignments.errors++;
          }
        }
      }

      // 9. Import Documents
      const documentSheetName = workbook.SheetNames.find(s => s === '文件');
      if (documentSheetName) {
        setProgress({ current: 9, total: 11, phase: 'importing', currentSheet: '文件' });
        const sheet = workbook.Sheets[documentSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        const reversedLabels = reverseLabels(documentLabels);

        const { data: existingDocs } = await supabase.from('documents').select('id, project_id, doc_type');
        const existingDocIds = new Set(existingDocs?.map(d => d.id) || []);
        const docKeyToId = new Map<string, string>();
        existingDocs?.forEach(d => docKeyToId.set(`${d.project_id}-${d.doc_type}`, d.id));

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          try {
            const mapped: Record<string, any> = {};
            let providedId: string | null = null;
            let projectCode: string | null = null;

            Object.entries(row).forEach(([label, value]) => {
              const key = reversedLabels[label];
              if (!key || value === '' || value === null) return;
              if (key === 'id') providedId = String(value);
              else if (key === 'project_code') projectCode = String(value);
              else if (['submitted_at', 'issued_at', 'due_at'].includes(key)) {
                const d = parseDate(value);
                if (d) mapped[key] = d;
              } else if (!['created_at', 'updated_at', 'created_by'].includes(key)) {
                mapped[key] = String(value);
              }
            });

            if (!projectCode) {
              summary.errorList.push({ row: rowNum, sheet: '文件', message: '缺少案場編號', errorType: 'validation' });
              summary.documents.errors++;
              continue;
            }
            if (!mapped.doc_type) {
              summary.errorList.push({ row: rowNum, sheet: '文件', message: '缺少文件類型', errorType: 'validation', code: projectCode });
              summary.documents.errors++;
              continue;
            }

            const projectId = projectCodeToId.get(projectCode);
            if (!projectId) {
              summary.errorList.push({ row: rowNum, sheet: '文件', message: `找不到案場「${projectCode}」`, errorType: 'not_found', code: projectCode });
              summary.documents.errors++;
              continue;
            }
            mapped.project_id = projectId;

            // Determine existing ID
            let existingId = providedId && existingDocIds.has(providedId) ? providedId : null;
            if (!existingId) {
              existingId = docKeyToId.get(`${projectId}-${mapped.doc_type}`) || null;
            }

            if (existingId) {
              if (mode === 'insert') {
                summary.errorList.push({ row: rowNum, sheet: '文件', message: '文件已存在（僅新增模式）', errorType: 'unique_constraint', code: `${projectCode}-${mapped.doc_type}` });
                summary.documents.errors++;
              } else if (mode === 'skip') {
                summary.documents.skipped++;
              } else {
                const { error } = await supabase.from('documents').update(mapped).eq('id', existingId);
                if (error) {
                  summary.errorList.push({ row: rowNum, sheet: '文件', message: error.message, errorType: 'unknown', code: `${projectCode}-${mapped.doc_type}` });
                  summary.documents.errors++;
                } else {
                  summary.documents.updated++;
                }
              }
            } else {
              const { error } = await supabase.from('documents').insert(mapped as any);
              if (error) {
                summary.errorList.push({ row: rowNum, sheet: '文件', message: error.message, errorType: 'unknown', code: `${projectCode}-${mapped.doc_type}` });
                summary.documents.errors++;
              } else {
                summary.documents.inserted++;
              }
            }
          } catch (err) {
            summary.errorList.push({ row: rowNum, sheet: '文件', message: err instanceof Error ? err.message : '未知錯誤', errorType: 'unknown' });
            summary.documents.errors++;
          }
        }
      }

      // 10. Import Document Files (skip - informational only)
      const fileSheetName = workbook.SheetNames.find(s => s.includes('文件附件'));
      if (fileSheetName) {
        setProgress({ current: 10, total: 12, phase: 'importing', currentSheet: '文件附件' });
        summary.documentFiles.skipped = XLSX.utils.sheet_to_json(workbook.Sheets[fileSheetName]).length;
      }

      // 11. Import System Options
      const optionSheetName = workbook.SheetNames.find(s => s === '系統選項');
      if (optionSheetName) {
        setProgress({ current: 11, total: 12, phase: 'importing', currentSheet: '系統選項' });
        const sheet = workbook.Sheets[optionSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        const reversedLabels = reverseLabels(systemOptionLabels);

        const { data: existingData } = await supabase.from('system_options').select('id');
        const existingIds = new Set(existingData?.map(o => o.id) || []);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          try {
            const mapped: Record<string, any> = {};
            let providedId: string | null = null;

            Object.entries(row).forEach(([label, value]) => {
              const key = reversedLabels[label];
              if (!key || value === '' || value === null) return;
              if (key === 'id') providedId = String(value);
              else if (key === 'sort_order') {
                const num = Number(value);
                if (!isNaN(num)) mapped[key] = num;
              } else if (key === 'is_active') {
                mapped[key] = String(value).toLowerCase() === 'true' || value === true;
              } else if (!['created_at', 'updated_at', 'created_by'].includes(key)) {
                mapped[key] = String(value);
              }
            });

            if (!mapped.category || !mapped.value || !mapped.label) {
              summary.errorList.push({ row: rowNum, sheet: '系統選項', message: '缺少必填欄位（類別/值/顯示名稱）', errorType: 'validation' });
              summary.systemOptions.errors++;
              continue;
            }

            const existingId = providedId && existingIds.has(providedId) ? providedId : null;

            if (existingId) {
              if (mode === 'insert') {
                summary.errorList.push({ row: rowNum, sheet: '系統選項', message: '記錄已存在（僅新增模式）', errorType: 'unique_constraint' });
                summary.systemOptions.errors++;
              } else if (mode === 'skip') {
                summary.systemOptions.skipped++;
              } else {
                const { error } = await supabase.from('system_options').update(mapped).eq('id', existingId);
                if (error) {
                  summary.errorList.push({ row: rowNum, sheet: '系統選項', message: error.message, errorType: 'unknown' });
                  summary.systemOptions.errors++;
                } else {
                  summary.systemOptions.updated++;
                }
              }
            } else {
              const { error } = await supabase.from('system_options').insert(mapped as any);
              if (error) {
                summary.errorList.push({ row: rowNum, sheet: '系統選項', message: error.message, errorType: 'unknown' });
                summary.systemOptions.errors++;
              } else {
                summary.systemOptions.inserted++;
              }
            }
          } catch (err) {
            summary.errorList.push({ row: rowNum, sheet: '系統選項', message: err instanceof Error ? err.message : '未知錯誤', errorType: 'unknown' });
            summary.systemOptions.errors++;
          }
        }
      }

      // 12. Import Module Permissions
      const permissionSheetName = workbook.SheetNames.find(s => s === '模組權限');
      if (permissionSheetName) {
        setProgress({ current: 12, total: 12, phase: 'importing', currentSheet: '模組權限' });
        const sheet = workbook.Sheets[permissionSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });
        const reversedLabels = reverseLabels(modulePermissionLabels);

        // Build email to user ID map
        const { data: profiles } = await supabase.from('profiles').select('id, email');
        const emailToUserId = new Map<string, string>();
        profiles?.forEach(p => {
          if (p.email) emailToUserId.set(p.email.toLowerCase(), p.id);
        });

        const { data: existingData } = await supabase.from('module_permissions').select('id, user_id, module_name');
        const existingIds = new Set(existingData?.map(p => p.id) || []);
        const existingKeys = new Map<string, string>();
        existingData?.forEach(p => existingKeys.set(`${p.user_id}-${p.module_name}`, p.id));

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          try {
            const mapped: Record<string, any> = {};
            let providedId: string | null = null;
            let userEmail: string | null = null;
            let moduleName: string | null = null;

            Object.entries(row).forEach(([label, value]) => {
              const key = reversedLabels[label];
              if (!key || value === '' || value === null) return;
              if (key === 'id') providedId = String(value);
              else if (key === 'user_email') userEmail = String(value).toLowerCase();
              else if (key === 'module_name') {
                moduleName = String(value);
                mapped[key] = moduleName;
              } else if (['can_view', 'can_create', 'can_edit', 'can_delete'].includes(key)) {
                mapped[key] = String(value).toLowerCase() === 'true' || value === true;
              } else if (!['created_at', 'updated_at', 'created_by'].includes(key)) {
                mapped[key] = String(value);
              }
            });

            if (!userEmail) {
              summary.errorList.push({ row: rowNum, sheet: '模組權限', message: '缺少使用者Email', errorType: 'validation' });
              summary.modulePermissions.errors++;
              continue;
            }
            if (!moduleName) {
              summary.errorList.push({ row: rowNum, sheet: '模組權限', message: '缺少模組名稱', errorType: 'validation', code: userEmail });
              summary.modulePermissions.errors++;
              continue;
            }

            const userId = emailToUserId.get(userEmail);
            if (!userId) {
              summary.errorList.push({ row: rowNum, sheet: '模組權限', message: `找不到使用者「${userEmail}」`, errorType: 'not_found', code: userEmail });
              summary.modulePermissions.errors++;
              continue;
            }
            mapped.user_id = userId;

            // Determine existing ID by provided ID or user_id + module_name combination
            let existingId = providedId && existingIds.has(providedId) ? providedId : null;
            if (!existingId) {
              existingId = existingKeys.get(`${userId}-${moduleName}`) || null;
            }

            if (existingId) {
              if (mode === 'insert') {
                summary.errorList.push({ row: rowNum, sheet: '模組權限', message: '權限記錄已存在（僅新增模式）', errorType: 'unique_constraint', code: `${userEmail}-${moduleName}` });
                summary.modulePermissions.errors++;
              } else if (mode === 'skip') {
                summary.modulePermissions.skipped++;
              } else {
                const { error } = await supabase.from('module_permissions').update(mapped).eq('id', existingId);
                if (error) {
                  summary.errorList.push({ row: rowNum, sheet: '模組權限', message: error.message, errorType: 'unknown', code: `${userEmail}-${moduleName}` });
                  summary.modulePermissions.errors++;
                } else {
                  summary.modulePermissions.updated++;
                }
              }
            } else {
              const { error } = await supabase.from('module_permissions').insert(mapped as any);
              if (error) {
                summary.errorList.push({ row: rowNum, sheet: '模組權限', message: error.message, errorType: 'unknown', code: `${userEmail}-${moduleName}` });
                summary.modulePermissions.errors++;
              } else {
                summary.modulePermissions.inserted++;
              }
            }
          } catch (err) {
            summary.errorList.push({ row: rowNum, sheet: '模組權限', message: err instanceof Error ? err.message : '未知錯誤', errorType: 'unknown' });
            summary.modulePermissions.errors++;
          }
        }
      }

      setProgress({ current: 12, total: 12, phase: 'done' });
      setImportSummary(summary);

      const totalInserted = 
        summary.investors.inserted + summary.investorContacts.inserted + summary.investorPaymentMethods.inserted +
        summary.partners.inserted + summary.projects.inserted + summary.statusHistory.inserted + 
        summary.constructionHistory.inserted + summary.constructionAssignments.inserted + 
        summary.documents.inserted + summary.systemOptions.inserted + summary.modulePermissions.inserted;
      const totalUpdated = 
        summary.investors.updated + summary.investorContacts.updated + summary.investorPaymentMethods.updated +
        summary.partners.updated + summary.projects.updated + summary.statusHistory.updated + 
        summary.constructionHistory.updated + summary.constructionAssignments.updated + 
        summary.documents.updated + summary.systemOptions.updated + summary.modulePermissions.updated;
      const totalErrors = 
        summary.investors.errors + summary.investorContacts.errors + summary.investorPaymentMethods.errors +
        summary.partners.errors + summary.projects.errors + summary.statusHistory.errors + 
        summary.constructionHistory.errors + summary.constructionAssignments.errors + 
        summary.documents.errors + summary.systemOptions.errors + summary.modulePermissions.errors;

      if (totalErrors > 0) {
        toast.warning('匯入完成（部分失敗）', { 
          description: `新增 ${totalInserted} 筆、更新 ${totalUpdated} 筆、失敗 ${totalErrors} 筆` 
        });
      } else {
        toast.success('匯入完成', { 
          description: `新增 ${totalInserted} 筆、更新 ${totalUpdated} 筆` 
        });
      }

      return summary;
    } catch (error) {
      console.error('Import error:', error);
      toast.error('匯入失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Download error report
  const downloadErrorReport = useCallback(() => {
    if (!importSummary || importSummary.errorList.length === 0) {
      toast.info('沒有錯誤記錄');
      return;
    }

    const workbook = XLSX.utils.book_new();
    const data = importSummary.errorList.map(e => ({
      '工作表': e.sheet,
      '行號': e.row,
      '識別碼': e.code || '',
      '欄位': e.field || '',
      '錯誤類型': e.errorType,
      '錯誤訊息': e.message,
    }));
    const sheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, '錯誤清單');

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadFile(blob, `匯入錯誤報告_${timestamp}.xlsx`);

    toast.success('錯誤報告已下載');
  }, [importSummary]);

  const clearSummary = useCallback(() => {
    setImportSummary(null);
    setProgress({ current: 0, total: 0, phase: 'preparing' });
  }, []);

  return {
    isProcessing,
    progress,
    importSummary,
    exportFullBackup,
    downloadTemplate,
    importFullBackup,
    downloadErrorReport,
    clearSummary,
  };
}
