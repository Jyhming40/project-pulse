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

// Table display name mapping
export const tableDisplayNames: Record<string, string> = {
  projects: '案場',
  documents: '文件',
  document_files: '文件檔案',
  partners: '外包夥伴',
  partner_contacts: '夥伴聯絡人',
  investors: '投資人',
  investor_contacts: '投資人聯絡人',
  investor_payment_methods: '付款方式',
  project_construction_assignments: '工程指派',
  project_status_history: '案場狀態歷程',
  construction_status_history: '施工狀態歷程',
  system_options: '系統選項',
  deletion_policies: '刪除政策',
  audit_logs: '稽核日誌',
  module_permissions: '模組權限',
  user_preferences: '使用者偏好設定',
  profiles: '使用者資料',
  user_roles: '使用者角色',
  investor_year_counters: '投資方年度計數器',
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
