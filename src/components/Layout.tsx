import { ReactNode, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsRead } from '@/hooks/useAppSettings';
import { usePermissions, MODULES } from '@/hooks/usePermissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  FileText, 
  LogOut,
  Zap,
  ChevronLeft,
  ChevronDown,
  BookOpen,
  HardHat,
  Trash2,
  Shield,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  Activity,
  Palette,
  UserCog,
  Settings2
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

// 日常工作模組 - 對所有登入使用者可見
const dailyWorkItems = [
  { to: '/', icon: LayoutDashboard, label: '儀表板', module: null },
  { to: '/projects', icon: Building2, label: '案場管理', module: MODULES.PROJECTS },
  { to: '/documents', icon: FileText, label: '文件管理', module: MODULES.DOCUMENTS },
  { to: '/investors', icon: Users, label: '投資方 / 業主', module: MODULES.INVESTORS },
  { to: '/partners', icon: HardHat, label: '外包夥伴 / 工班', module: MODULES.PARTNERS },
];

// 管理與設定模組 - 重組為「人員」「系統」兩區塊
const managementItems = [
  // 人員管理
  { to: '/users', icon: UserCog, label: '使用者與角色', adminOnly: true },
  { to: '/permissions', icon: Shield, label: '權限設定', adminOnly: true },
  // 系統設定
  { to: '/progress-settings', icon: TrendingUp, label: '進度設定', adminOnly: true },
  { to: '/system-options', icon: Settings2, label: 'Codebook', adminOnly: true },
  { to: '/investor-codes', icon: BookOpen, label: '代碼對照表', adminOnly: true },
  { to: '/branding', icon: Palette, label: '公司設定', adminOnly: true },
];

// 系統治理中心 - 僅限管理員，含高風險操作
const systemGovernanceItems = [
  { to: '/engineering', icon: Activity, label: '系統狀態' },
  { to: '/deletion-policies', icon: Shield, label: '刪除政策' },
  { to: '/recycle-bin', icon: Trash2, label: '回收區' },
  { to: '/audit-logs', icon: ClipboardList, label: '稽核日誌' },
];

export default function Layout({ children }: LayoutProps) {
  const { user, signOut, isAdmin, role } = useAuth();
  const { canView } = usePermissions();
  const { settings } = useAppSettingsRead();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [governanceOpen, setGovernanceOpen] = useState(false);

  // Auto-expand section if current route is within it
  const isInManagement = managementItems.some(item => 
    location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  );
  const isInGovernance = systemGovernanceItems.some(item => 
    location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  );

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
    // 如果模組設定 adminOnly，則只有管理員可見
    if (item.adminOnly && !isAdmin) return false;
    // 如果有指定模組，檢查權限
    if (item.module && !canView(item.module as any)) return false;
    return true;
  };

  const renderNavItem = (item: { to: string; icon: React.ElementType; label: string; module?: string | null; adminOnly?: boolean }) => {
    // 權限檢查
    if (!isModuleVisible(item)) return null;

    const isActive = location.pathname === item.to || 
      (item.to !== '/' && location.pathname.startsWith(item.to));
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
          {/* Section: 日常工作 */}
          {!collapsed && (
            <div className="px-3 py-2">
              <span className="text-xs font-medium text-sidebar-muted uppercase tracking-wider">日常工作</span>
            </div>
          )}
          {dailyWorkItems.map(renderNavItem)}

          {/* Section: 管理與設定 (Admin only) */}
          {isAdmin && (
            <>
              {collapsed ? (
                // Collapsed mode: show items directly
                <>
                  <div className="my-3 border-t border-sidebar-border" />
                  {managementItems.map(renderNavItem)}
                </>
              ) : (
                // Expanded mode: show as collapsible group
                <Collapsible
                  open={managementOpen || isInManagement}
                  onOpenChange={setManagementOpen}
                  className="mt-4"
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-sidebar-muted uppercase tracking-wider hover:text-sidebar-foreground transition-colors">
                    <span>管理與設定</span>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform",
                      (managementOpen || isInManagement) && "rotate-180"
                    )} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1">
                    {managementItems.map(renderNavItem)}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )}

          {/* Section: 系統治理中心 (Admin only, high-risk) */}
          {isAdmin && (
            <>
              {collapsed ? (
                // Collapsed mode: show items with warning color
                <>
                  <div className="my-3 border-t border-sidebar-border" />
                  {systemGovernanceItems.map((item) => {
                    const isActive = location.pathname === item.to || 
                      location.pathname.startsWith(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={cn(
                          "sidebar-link text-amber-600 dark:text-amber-500",
                          isActive && "sidebar-link-active"
                        )}
                        title={item.label}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                      </NavLink>
                    );
                  })}
                </>
              ) : (
                // Expanded mode: show as collapsible group with warning
                <Collapsible
                  open={governanceOpen || isInGovernance}
                  onOpenChange={setGovernanceOpen}
                  className="mt-4"
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-500 uppercase tracking-wider hover:text-amber-700 dark:hover:text-amber-400 transition-colors">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      系統治理中心
                    </span>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform",
                      (governanceOpen || isInGovernance) && "rotate-180"
                    )} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1">
                    <div className="px-3 py-1.5 mb-1">
                      <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 leading-tight">
                        ⚠️ 高風險區域，請謹慎操作
                      </p>
                    </div>
                    {systemGovernanceItems.map((item) => {
                      const isActive = location.pathname === item.to || 
                        location.pathname.startsWith(item.to);
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
                          <span className="animate-fade-in">{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
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
    </div>
  );
}
