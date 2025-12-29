import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Module names that can have permissions
export const MODULES = {
  PROJECTS: 'projects',
  INVESTORS: 'investors',
  PARTNERS: 'partners',
  DOCUMENTS: 'documents',
  SYSTEM_OPTIONS: 'system_options',
  DELETION_POLICIES: 'deletion_policies',
  AUDIT_LOGS: 'audit_logs',
  RECYCLE_BIN: 'recycle_bin',
  SETTINGS: 'settings',
  ENGINEERING: 'engineering',
} as const;

export type ModuleName = typeof MODULES[keyof typeof MODULES];

export const MODULE_LABELS: Record<ModuleName, string> = {
  [MODULES.PROJECTS]: '專案管理',
  [MODULES.INVESTORS]: '投資人管理',
  [MODULES.PARTNERS]: '協力商管理',
  [MODULES.DOCUMENTS]: '文件管理',
  [MODULES.SYSTEM_OPTIONS]: '系統選項',
  [MODULES.DELETION_POLICIES]: '刪除策略',
  [MODULES.AUDIT_LOGS]: '稽核日誌',
  [MODULES.RECYCLE_BIN]: '資源回收桶',
  [MODULES.SETTINGS]: '系統設定',
  [MODULES.ENGINEERING]: '工程介面',
};

export interface ModulePermission {
  module_name: ModuleName;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface PermissionMap {
  [key: string]: ModulePermission;
}

// Default permissions based on role
const getDefaultPermissions = (role: string, module: ModuleName): ModulePermission => {
  const base = {
    module_name: module,
    can_view: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
  };

  switch (role) {
    case 'admin':
      return { ...base, can_view: true, can_create: true, can_edit: true, can_delete: true };
    case 'staff':
      // Staff can view and edit most modules, but not delete or access admin-only modules
      const adminOnlyModules: ModuleName[] = [
        MODULES.SYSTEM_OPTIONS,
        MODULES.DELETION_POLICIES,
        MODULES.SETTINGS,
        MODULES.ENGINEERING,
      ];
      if (adminOnlyModules.includes(module)) {
        return { ...base, can_view: module === MODULES.AUDIT_LOGS };
      }
      return { ...base, can_view: true, can_create: true, can_edit: true, can_delete: false };
    case 'viewer':
      // Viewer can only view non-admin modules
      const viewerRestrictedModules: ModuleName[] = [
        MODULES.SYSTEM_OPTIONS,
        MODULES.DELETION_POLICIES,
        MODULES.SETTINGS,
        MODULES.ENGINEERING,
      ];
      if (viewerRestrictedModules.includes(module)) {
        return base;
      }
      return { ...base, can_view: true };
    default:
      return base;
  }
};

export function usePermissions() {
  const { user, role, isAdmin, isStaff, isViewer } = useAuth();

  const { data: customPermissions, isLoading } = useQuery({
    queryKey: ['module-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await (supabase
        .from('module_permissions' as any)
        .select('*')
        .eq('user_id', user.id) as any);
      
      if (error) {
        console.error('Error fetching permissions:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Build permission map with custom overrides
  const getPermissions = (module: ModuleName): ModulePermission => {
    // Admin always has full access
    if (isAdmin) {
      return {
        module_name: module,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true,
      };
    }

    // Check for custom permission override
    const customPerm = customPermissions?.find(
      (p: any) => p.module_name === module
    );

    if (customPerm) {
      return {
        module_name: module,
        can_view: customPerm.can_view,
        can_create: customPerm.can_create,
        can_edit: customPerm.can_edit,
        can_delete: customPerm.can_delete,
      };
    }

    // Fall back to role-based defaults
    return getDefaultPermissions(role || 'viewer', module);
  };

  const canView = (module: ModuleName): boolean => getPermissions(module).can_view;
  const canCreate = (module: ModuleName): boolean => getPermissions(module).can_create;
  const canEdit = (module: ModuleName): boolean => getPermissions(module).can_edit;
  const canDelete = (module: ModuleName): boolean => getPermissions(module).can_delete;

  // Check if user has any permission for a module
  const hasAnyPermission = (module: ModuleName): boolean => {
    const perms = getPermissions(module);
    return perms.can_view || perms.can_create || perms.can_edit || perms.can_delete;
  };

  return {
    isLoading,
    getPermissions,
    canView,
    canCreate,
    canEdit,
    canDelete,
    hasAnyPermission,
    isAdmin,
    isStaff,
    isViewer,
  };
}

// Helper component for conditional rendering based on permissions
export function useModuleAccess(module: ModuleName) {
  const { canView, canCreate, canEdit, canDelete, isLoading } = usePermissions();
  
  return {
    isLoading,
    canView: canView(module),
    canCreate: canCreate(module),
    canEdit: canEdit(module),
    canDelete: canDelete(module),
  };
}
