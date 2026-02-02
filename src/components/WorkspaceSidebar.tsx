import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, Command, LogOut, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsRead } from '@/hooks/useAppSettings';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';
import { 
  WORKSPACE_REGISTRY, 
  COMMON_NAV_ITEMS, 
  getWorkspaceById,
  WorkspaceNavItem,
} from '@/config/moduleRegistry';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  LayoutDashboard, 
  Settings2, 
  UserCog, 
  Lock, 
  Link2, 
  Activity, 
  Copy, 
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useState, ReactNode } from 'react';
import { toast } from 'sonner';

interface WorkspaceSidebarProps {
  collapsed: boolean;
}

// Admin-only items
const adminSettingsItems = [
  { to: '/users', icon: UserCog, label: '使用者與角色' },
  { to: '/permissions', icon: Lock, label: '權限設定' },
  { to: '/settings', icon: Settings2, label: '系統設定' },
  { to: '/integrations', icon: Link2, label: '外部整合' },
];

const adminGovernanceItems = [
  { to: '/engineering', icon: Activity, label: '系統狀態' },
  { to: '/duplicate-scanner', icon: Copy, label: '重複案件掃描' },
  { to: '/recycle-bin', icon: Trash2, label: '回收區' },
];

export default function WorkspaceSidebar({ collapsed }: WorkspaceSidebarProps) {
  const { user, signOut, isAdmin, role } = useAuth();
  const { settings } = useAppSettingsRead();
  const { currentWorkspace } = useWorkspace();
  const { canView } = usePermissions();
  const location = useLocation();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [governanceOpen, setGovernanceOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success('已登出');
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'admin': return '管理員';
      case 'staff': return '員工';
      case 'viewer': return '檢視者';
      default: return '';
    }
  };

  const systemNameMain = settings?.company_name_zh || '明群環能';
  const systemNameSub = settings?.system_name_zh?.replace(systemNameMain, '').trim() || '管理系統';

  // Get current workspace definition
  const workspaceDef = currentWorkspace ? getWorkspaceById(currentWorkspace) : null;

  // Render nav item
  const renderNavItem = (item: WorkspaceNavItem) => {
    const isActive = location.pathname === item.to || 
      (item.to !== '/' && item.to !== '/hub' && location.pathname.startsWith(item.to));
    
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={cn(
          "sidebar-link",
          isActive && "sidebar-link-active"
        )}
        title={collapsed ? item.label : undefined}
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span className="animate-fade-in">{item.label}</span>}
      </NavLink>
    );
  };

  // Render collapsible section
  const renderCollapsibleSection = (
    title: string,
    items: WorkspaceNavItem[],
    open: boolean,
    setOpen: (open: boolean) => void,
    isWarning?: boolean
  ) => {
    if (collapsed) {
      return (
        <>
          <div className="my-3 border-t border-sidebar-border" />
          {items.map(renderNavItem)}
        </>
      );
    }

    const isInSection = items.some(item => 
      location.pathname === item.to || location.pathname.startsWith(item.to + '/')
    );

    return (
      <Collapsible
        open={open || isInSection}
        onOpenChange={setOpen}
        className="mt-2"
      >
        <CollapsibleTrigger className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-xs font-medium uppercase tracking-wider hover:text-sidebar-foreground transition-colors",
          isWarning 
            ? "text-amber-600 dark:text-amber-500"
            : "text-sidebar-muted"
        )}>
          <span className="flex items-center gap-1.5">
            {isWarning && <AlertTriangle className="w-3.5 h-3.5" />}
            {title}
          </span>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform",
            (open || isInSection) && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1">
          {isWarning && (
            <div className="px-3 py-1.5 mb-1">
              <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 leading-tight">
                ⚠️ 高風險區域，請謹慎操作
              </p>
            </div>
          )}
          {items.map(renderNavItem)}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        {settings?.logo_light_url ? (
          <img 
            src={settings.logo_light_url} 
            alt="Logo" 
            className="w-9 h-9 rounded-lg object-contain flex-shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="font-display font-semibold text-sidebar-foreground text-sm">{systemNameMain}</h1>
            <p className="text-xs text-sidebar-muted">{systemNameSub}</p>
          </div>
        )}
      </div>

      {/* Workspace Switcher */}
      <div className="px-3 py-3 border-b border-sidebar-border">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Common Items */}
        {!collapsed && (
          <div className="px-3 py-2">
            <span className="text-xs font-medium text-sidebar-muted uppercase tracking-wider">快速存取</span>
          </div>
        )}
        {COMMON_NAV_ITEMS.map(renderNavItem)}

        {/* Workspace-specific items */}
        {workspaceDef && (
          <>
            <div className="my-3 border-t border-sidebar-border" />
            {!collapsed && (
              <div className="px-3 py-2 flex items-center gap-2">
                <workspaceDef.icon className={cn("w-4 h-4", workspaceDef.color)} />
                <span className="text-xs font-medium text-sidebar-muted uppercase tracking-wider">
                  {workspaceDef.label}
                </span>
              </div>
            )}
            {workspaceDef.navItems.map(renderNavItem)}
          </>
        )}

        {/* Admin Sections */}
        {isAdmin && (
          <>
            {renderCollapsibleSection(
              '系統設定',
              adminSettingsItems,
              settingsOpen,
              setSettingsOpen
            )}
            {renderCollapsibleSection(
              '系統治理',
              adminGovernanceItems,
              governanceOpen,
              setGovernanceOpen,
              true
            )}
          </>
        )}
      </nav>

      {/* Theme Toggle & User Info */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between px-3")}>
          {!collapsed && <span className="text-xs text-sidebar-muted">主題</span>}
          <ThemeToggle collapsed={collapsed} />
        </div>
        {!collapsed && (
          <div className="px-3 py-2 animate-fade-in">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.email}
            </p>
            <p className="text-xs text-sidebar-muted">{getRoleLabel()}</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="sidebar-link w-full text-left"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>登出</span>}
        </button>
      </div>
    </div>
  );
}
