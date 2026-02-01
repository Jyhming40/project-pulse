import { ReactNode, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import GlobalAIAssistant from '@/components/GlobalAIAssistant';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsRead } from '@/hooks/useAppSettings';
import { usePermissions, MODULES } from '@/hooks/usePermissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  LayoutDashboard, 
  Building2, 
  LogOut,
  Zap,
  ChevronLeft,
  ChevronDown,
  HardHat,
  Trash2,
  AlertTriangle,
  Activity,
  UserCog,
  Settings2,
  Link2,
  Copy,
  Briefcase,
  FileText,
  TrendingUp,
  Lock,
  Command
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface LayoutProps {
  children: ReactNode;
}

// ==========================================
// 1. 營運中心（Hub）- 系統主入口
// ==========================================
const hubItems = [
  { to: '/hub', icon: Command, label: '營運指揮中心', module: null },
  { to: '/', icon: LayoutDashboard, label: 'KPI 儀表板', module: null },
];

// ==========================================
// 2. 五大模組入口
// ==========================================
const moduleItems = [
  { to: '/modules/sales', icon: Briefcase, label: '接案與報價', module: MODULES.PROJECTS },
  { to: '/modules/execution', icon: HardHat, label: '工程與行政', module: MODULES.PROJECTS },
  { to: '/modules/governance', icon: FileText, label: '文件治理', module: MODULES.DOCUMENTS },
  { to: '/modules/finance', icon: TrendingUp, label: '財務與投資', module: MODULES.INVESTORS },
  { to: '/modules/risk', icon: AlertTriangle, label: '風險與爭議', module: MODULES.PROJECTS },
];

// ==========================================
// 3. 案場快速入口
// ==========================================
const projectItems = [
  { to: '/projects', icon: Building2, label: '案場列表', module: MODULES.PROJECTS },
];

// ==========================================
// 4. 系統設定 (Admin only)
// ==========================================
const systemSettingsItems = [
  { to: '/users', icon: UserCog, label: '使用者與角色', adminOnly: true },
  { to: '/permissions', icon: Lock, label: '權限設定', adminOnly: true },
  { to: '/settings', icon: Settings2, label: '系統設定', adminOnly: true },
  { to: '/integrations', icon: Link2, label: '外部整合', adminOnly: true },
];

// ==========================================
// 5. 系統治理中心 (Admin only)
// ==========================================
const systemGovernanceItems = [
  { to: '/engineering', icon: Activity, label: '系統狀態' },
  { to: '/duplicate-scanner', icon: Copy, label: '重複案件掃描' },
  { to: '/recycle-bin', icon: Trash2, label: '回收區' },
];

export default function Layout({ children }: LayoutProps) {
  const { user, signOut, isAdmin, role } = useAuth();
  const { canView } = usePermissions();
  const { settings } = useAppSettingsRead();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  
  // Auto-expand section if current route is within it
  const isInModules = moduleItems.some(item => 
    location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  );
  const isInSettings = systemSettingsItems.some(item => 
    location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  );
  const isInGovernance = systemGovernanceItems.some(item => 
    location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  );

  // 展開狀態 - 預設展開當前所在分類
  const [modulesOpen, setModulesOpen] = useState(isInModules);
  const [settingsOpen, setSettingsOpen] = useState(isInSettings);
  const [governanceOpen, setGovernanceOpen] = useState(isInGovernance);

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

  // 檢查模組是否可見
  const isModuleVisible = (item: { module?: string | null; adminOnly?: boolean }) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.module && !canView(item.module as any)) return false;
    return true;
  };

  // 檢查分類是否有任何可見項目
  const hasVisibleItems = (items: Array<{ module?: string | null; adminOnly?: boolean }>) => {
    return items.some(item => isModuleVisible(item));
  };

  const renderNavItem = (item: { to: string; icon: React.ElementType; label: string; module?: string | null; adminOnly?: boolean }) => {
    if (!isModuleVisible(item)) return null;

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
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span className="animate-fade-in">{item.label}</span>}
      </NavLink>
    );
  };

  const renderCollapsibleSection = (
    title: string,
    items: Array<{ to: string; icon: React.ElementType; label: string; module?: string | null; adminOnly?: boolean }>,
    icon: React.ElementType,
    open: boolean,
    setOpen: (open: boolean) => void,
    isInSection: boolean,
    isWarning?: boolean
  ) => {
    if (!hasVisibleItems(items)) return null;

    if (collapsed) {
      // Collapsed mode: show items directly with separator
      return (
        <>
          <div className="my-3 border-t border-sidebar-border" />
          {items.map(renderNavItem)}
        </>
      );
    }

    // Expanded mode: show as collapsible group
    return (
      <Collapsible
        open={open || isInSection}
        onOpenChange={setOpen}
        className="mt-2"
      >
        <CollapsibleTrigger className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-xs font-medium uppercase tracking-wider hover:text-sidebar-foreground transition-colors",
          isWarning 
            ? "text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400"
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
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}>
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

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* 1. 營運中心入口 */}
          {!collapsed && (
            <div className="px-3 py-2">
              <span className="text-xs font-medium text-sidebar-muted uppercase tracking-wider">營運中心</span>
            </div>
          )}
          {hubItems.map(renderNavItem)}

          {/* 2. 五大作戰模組 */}
          {renderCollapsibleSection(
            '作戰模組',
            moduleItems,
            Command,
            modulesOpen,
            setModulesOpen,
            isInModules
          )}

          {/* 3. 案場快速入口 */}
          {!collapsed && hasVisibleItems(projectItems) && (
            <>
              <div className="my-3 border-t border-sidebar-border" />
              <div className="px-3 py-2">
                <span className="text-xs font-medium text-sidebar-muted uppercase tracking-wider">快速存取</span>
              </div>
            </>
          )}
          {collapsed && hasVisibleItems(projectItems) && (
            <div className="my-3 border-t border-sidebar-border" />
          )}
          {projectItems.map(renderNavItem)}

          {/* 4. 系統設定 (Admin only) */}
          {isAdmin && renderCollapsibleSection(
            '系統設定',
            systemSettingsItems,
            Settings2,
            settingsOpen,
            setSettingsOpen,
            isInSettings
          )}

          {/* 5. 系統治理中心 (Admin only, high-risk) */}
          {isAdmin && renderCollapsibleSection(
            '系統治理中心',
            systemGovernanceItems,
            AlertTriangle,
            governanceOpen,
            setGovernanceOpen,
            isInGovernance,
            true // isWarning
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

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-accent transition-colors"
        >
          <ChevronLeft className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            collapsed && "rotate-180"
          )} />
        </button>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        collapsed ? "ml-16" : "ml-64"
      )}>
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Global AI Assistant */}
      <GlobalAIAssistant />
    </div>
  );
}
