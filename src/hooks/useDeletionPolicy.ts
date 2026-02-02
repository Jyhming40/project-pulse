import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Types
export type DeletionMode = 'soft_delete' | 'archive' | 'hard_delete' | 'disable_only';
export type AuditAction = 'DELETE' | 'RESTORE' | 'PURGE' | 'ARCHIVE' | 'UNARCHIVE' | 'CREATE' | 'UPDATE';

export interface DeletionPolicy {
  id: string;
  policy_type: 'global' | 'table';
  table_name: string | null;
  soft_delete_enabled: boolean;
  retention_days: number;
  auto_purge_enabled: boolean;
  require_delete_reason: boolean;
  require_purge_confirmation: boolean;
  deletion_mode: DeletionMode;
  roles_can_delete: string[];
  roles_can_restore: string[];
  roles_can_purge: string[];
  roles_can_archive: string[];
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  actor_user_id: string | null;
  reason: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  actor?: {
    full_name: string | null;
    email: string | null;
  };
}

// Table display name mapping - used by IntegrityCheckPanel and DeletionPolicyPanel
export const tableDisplayNames: Record<string, string> = {
  // Core business
  projects: '案場',
  documents: '文件',
  document_files: '文件檔案',
  document_tags: '文件標籤',
  document_tag_assignments: '文件標籤關聯',
  document_type_config: '文件類型設定',
  // Investors
  investors: '投資人',
  investor_contacts: '投資人聯絡人',
  investor_payment_methods: '付款方式',
  investor_year_counters: '業務單位年度計數器',
  // Partners
  partners: '外包夥伴',
  partner_contacts: '夥伴聯絡人',
  // Project related
  project_construction_assignments: '工程指派',
  project_status_history: '案場狀態歷程',
  construction_status_history: '施工狀態歷程',
  project_milestones: '案場里程碑',
  project_custom_fields: '專案自訂欄位',
  project_custom_field_values: '專案自訂欄位值',
  project_field_config: '專案欄位設定',
  project_issues: '專案問題',
  project_stages: '專案流程階段',
  project_payments: '專案付款',
  project_quotes: '專案報價',
  // Progress & milestones
  progress_milestones: '進度里程碑定義',
  progress_settings: '進度設定',
  payment_milestones: '付款里程碑',
  milestone_notification_settings: '里程碑通知設定',
  milestone_notification_logs: '里程碑通知紀錄',
  // Governance
  departments: '部門',
  process_stages: '流程階段',
  stage_responsibilities: '階段責任設定',
  // Quote system
  quote_modules: '報價模組',
  quote_inverters: '報價變流器',
  quote_line_items: '報價細項',
  quote_financial_projections: '報價財務預測',
  quote_engineering_items: '報價工程項目',
  quote_engineering_presets: '工程項目預設',
  quote_engineering_templates: '工程項目範本',
  quote_schedules: '報價時程',
  // Duplicate management
  duplicate_ignore_pairs: '重複忽略配對',
  duplicate_reviews: '重複審核記錄',
  // System config
  system_options: '系統選項',
  system_tariff_rates: '躉購費率設定',
  deletion_policies: '刪除政策',
  app_settings: '系統設定',
  ai_settings: 'AI 設定',
  company_bank_accounts: '公司銀行帳戶',
  // User & permissions
  profiles: '使用者資料',
  user_roles: '使用者角色',
  user_security: '使用者安全設定',
  user_preferences: '使用者偏好設定',
  user_drive_tokens: 'Drive 憑證',
  user_milestone_order: '使用者里程碑順序',
  user_events: '使用者行為事件',
  module_permissions: '模組權限',
  // Audit
  audit_logs: '稽核日誌',
};

// Tables that support soft delete (only tables with is_deleted column)
export const softDeleteTables = [
  'projects',
  'documents', 
  'document_files',
  'partners',
  'partner_contacts',
  'investors',
  'investor_contacts',
  'investor_payment_methods',
  'project_construction_assignments',
] as const;

// Tables that support archive
export const archivableTables = [
  'projects',
  'documents',
  'partners',
  'investors',
] as const;

export type SoftDeleteTable = typeof softDeleteTables[number];

// Default policy values (used when database tables don't exist yet)
const defaultGlobalPolicy: Omit<DeletionPolicy, 'id' | 'created_at' | 'updated_at'> = {
  policy_type: 'global',
  table_name: null,
  soft_delete_enabled: true,
  retention_days: 30,
  auto_purge_enabled: false,
  require_delete_reason: true,
  require_purge_confirmation: true,
  deletion_mode: 'soft_delete',
  roles_can_delete: ['admin', 'staff'],
  roles_can_restore: ['admin', 'staff'],
  roles_can_purge: ['admin'],
  roles_can_archive: ['admin', 'staff'],
};

// Hook: Get effective deletion policy for a table
export function useEffectivePolicy(tableName: string) {
  const { data: policy } = useQuery({
    queryKey: ['deletion-policy', tableName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deletion_policies')
        .select('*')
        .eq('table_name', tableName)
        .maybeSingle();
      
      if (error || !data) {
        // Return default policy if not found
        return {
          softDeleteEnabled: true,
          retentionDays: 30,
          autoPurgeEnabled: false,
          requireDeleteReason: true,
          requirePurgeConfirmation: true,
          deletionMode: 'soft_delete' as DeletionMode,
          rolesCanDelete: ['admin', 'staff'],
          rolesCanRestore: ['admin', 'staff'],
          rolesCanPurge: ['admin'],
          rolesCanArchive: ['admin', 'staff'],
        };
      }
      
      return {
        softDeleteEnabled: data.deletion_mode === 'soft_delete',
        retentionDays: data.retention_days || 30,
        autoPurgeEnabled: data.allow_auto_purge || false,
        requireDeleteReason: data.require_reason || false,
        requirePurgeConfirmation: data.require_confirmation || true,
        deletionMode: data.deletion_mode as DeletionMode,
        rolesCanDelete: ['admin', 'staff'],
        rolesCanRestore: ['admin', 'staff'],
        rolesCanPurge: ['admin'],
        rolesCanArchive: ['admin', 'staff'],
      };
    },
    staleTime: 60000,
  });

  return policy || {
    softDeleteEnabled: true,
    retentionDays: 30,
    autoPurgeEnabled: false,
    requireDeleteReason: true,
    requirePurgeConfirmation: true,
    deletionMode: 'soft_delete' as DeletionMode,
    rolesCanDelete: ['admin', 'staff'],
    rolesCanRestore: ['admin', 'staff'],
    rolesCanPurge: ['admin'],
    rolesCanArchive: ['admin', 'staff'],
  };
}

// Hook: Log audit action
export function useLogAudit() {
  const logAction = async (
    tableName: string,
    recordId: string,
    action: AuditAction,
    reason?: string,
    _oldData?: Record<string, unknown>,
    _newData?: Record<string, unknown>
  ) => {
    try {
      // Use direct insert instead of RPC to avoid type issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('audit_logs')
        .insert({
          table_name: tableName,
          record_id: recordId,
          action: action,
          reason: reason || null,
        });
    } catch (error) {
      console.warn('[Audit] Failed to log action:', error);
    }
  };

  return { logAction };
}

// Hook: Check if deletion policy system is available
export function useDeletionPolicyStatus() {
  const { data: isAvailable = false, isLoading } = useQuery({
    queryKey: ['deletion-policy-status'],
    queryFn: async () => {
      try {
        const { error } = await supabase
          .from('deletion_policies')
          .select('id')
          .limit(1);
        
        return !error;
      } catch {
        return false;
      }
    },
    staleTime: 60000,
  });

  return { isAvailable, isLoading };
}
