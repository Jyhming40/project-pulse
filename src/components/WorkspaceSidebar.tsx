import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Zap, Menu, X } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

  const getRoleBadgeClass = () => {
    switch (role) {
      case 'admin': return 'bg-primary/20 text-primary';
      case 'staff': return 'bg-blue-500/20 text-blue-400';
      case 'viewer': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const systemNameMain = settings?.company_name_zh || '明群環能';
  const systemNameSub = settings?.system_name_zh?.replace(systemNameMain, '').trim() || '管理系統';

  // Get current workspace definition
  const workspaceDef = currentWorkspace ? getWorkspaceById(currentWorkspace) : null;

  // Render nav item with tooltip when collapsed
  const renderNavItem = (item: WorkspaceNavItem) => {
    const isActive = location.pathname === item.to || 
      (item.to !== '/' && item.to !== '/hub' && location.pathname.startsWith(item.to));
    
    const navContent = (
      <NavLink
        key={item.to}
        to={item.to}
        className={cn(
          "sidebar-link group/item",
          isActive && "sidebar-link-active"
        )}
      >
        <item.icon className={cn(
          "w-5 h-5 flex-shrink-0 transition-transform duration-200",
          !collapsed && "group-hover/item:scale-110"
        )} />
        {!collapsed && (
          <span className="animate-fade-in truncate">{item.label}</span>
        )}
      </NavLink>
    );

    if (collapsed) {
      return (
        <TooltipProvider key={item.to} delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              {navContent}
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {item.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return navContent;
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
          <div className="my-3 border-t border-sidebar-border/50" />
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
          "flex items-center justify-between w-full px-3 py-2 text-xs font-medium uppercase tracking-wider hover:text-sidebar-foreground transition-colors rounded-lg",
          isWarning 
            ? "text-amber-500/80 hover:bg-amber-500/10"
            : "text-sidebar-muted hover:bg-sidebar-accent/50"
        )}>
          <span className="flex items-center gap-1.5">
            {isWarning && <AlertTriangle className="w-3.5 h-3.5" />}
            {title}
          </span>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform duration-200",
            (open || isInSection) && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 pt-1">
          {isWarning && (
            <div className="px-3 py-1.5 mb-1">
              <p className="text-[10px] text-amber-500/60 leading-tight">
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
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border/50",
        collapsed && "justify-center"
      )}>
        {settings?.logo_light_url ? (
          <img 
            src={settings.logo_light_url} 
            alt="Logo" 
            className={cn(
              "rounded-lg object-contain flex-shrink-0 transition-all duration-300",
              collapsed ? "w-8 h-8" : "w-10 h-10"
            )}
          />
        ) : (
          <div className={cn(
            "rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 flex items-center justify-center flex-shrink-0 shadow-lg shadow-sidebar-primary/20 transition-all duration-300",
            collapsed ? "w-8 h-8" : "w-10 h-10"
          )}>
            <Zap className={cn(
              "text-sidebar-primary-foreground transition-all",
              collapsed ? "w-4 h-4" : "w-5 h-5"
            )} />
          </div>
        )}
        {!collapsed && (
          <div className="animate-fade-in min-w-0">
            <h1 className="font-display font-semibold text-sidebar-foreground text-sm truncate">{systemNameMain}</h1>
            <p className="text-xs text-sidebar-muted truncate">{systemNameSub}</p>
          </div>
        )}
      </div>

      {/* Workspace Switcher */}
      <div className={cn(
        "border-b border-sidebar-border/50 transition-all",
        collapsed ? "px-2 py-3" : "px-3 py-3"
      )}>
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent">
        {/* Common Items */}
        {!collapsed && (
          <div className="px-3 py-2">
            <span className="text-[10px] font-semibold text-sidebar-muted/70 uppercase tracking-widest">快速存取</span>
          </div>
        )}
        {COMMON_NAV_ITEMS.map(renderNavItem)}

        {/* Workspace-specific items */}
        {workspaceDef && (
          <>
            <div className="my-3 border-t border-sidebar-border/50" />
            {!collapsed && (
              <div className="px-3 py-2 flex items-center gap-2">
                <div className={cn(
                  "p-1 rounded-md",
                  workspaceDef.id === 'sales' && "bg-blue-500/20",
                  workspaceDef.id === 'execution' && "bg-amber-500/20",
                  workspaceDef.id === 'governance' && "bg-emerald-500/20",
                  workspaceDef.id === 'finance' && "bg-violet-500/20",
                  workspaceDef.id === 'risk' && "bg-rose-500/20",
                )}>
                  <workspaceDef.icon className={cn("w-3.5 h-3.5", workspaceDef.color)} />
                </div>
                <span className="text-[10px] font-semibold text-sidebar-muted/70 uppercase tracking-widest">
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
      <div className="px-3 py-4 border-t border-sidebar-border/50 space-y-3">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between px-3")}>
          {!collapsed && <span className="text-xs text-sidebar-muted">主題</span>}
          <ThemeToggle collapsed={collapsed} />
        </div>
        
        {!collapsed && (
          <div className="px-3 py-3 rounded-xl bg-sidebar-accent/30 animate-fade-in">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-sidebar-foreground truncate flex-1">
                {user?.email?.split('@')[0]}
              </p>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                getRoleBadgeClass()
              )}>
                {getRoleLabel()}
              </span>
            </div>
            <p className="text-xs text-sidebar-muted mt-0.5 truncate">{user?.email}</p>
          </div>
        )}
        
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className={cn(
                  "sidebar-link w-full text-left hover:bg-rose-500/10 hover:text-rose-400 transition-colors",
                  collapsed && "justify-center"
                )}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>登出</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">登出</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
