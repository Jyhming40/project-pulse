import { ReactNode, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettingsRead } from '@/hooks/useAppSettings';
import { useTheme } from '@/hooks/useTheme';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  FileText, 
  Settings, 
  Settings2,
  LogOut,
  Zap,
  ChevronLeft,
  BookOpen,
  HardHat,
  Trash2,
  Shield,
  ClipboardList,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '儀表板' },
  { to: '/projects', icon: Building2, label: '案場管理' },
  { to: '/investors', icon: Users, label: '投資方' },
  { to: '/partners', icon: HardHat, label: '外包夥伴' },
  { to: '/investor-codes', icon: BookOpen, label: '代碼對照表' },
  { to: '/documents', icon: FileText, label: '文件管理' },
  { to: '/recycle-bin', icon: Trash2, label: '回收區' },
];

export default function Layout({ children }: LayoutProps) {
  const { user, signOut, isAdmin, role } = useAuth();
  const { settings } = useAppSettingsRead();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

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

  // Get system name from settings or use defaults
  const systemNameMain = settings?.company_name_zh || '明群環能';
  const systemNameSub = settings?.system_name_zh?.replace(systemNameMain, '').trim() || '管理系統';

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
          {navItems.map((item) => {
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
          })}

          {isAdmin && (
            <>
              <NavLink
                to="/progress-settings"
                className={cn(
                  "sidebar-link",
                  location.pathname === '/progress-settings' && "sidebar-link-active"
                )}
              >
                <TrendingUp className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="animate-fade-in">進度設定</span>}
              </NavLink>
              <NavLink
                to="/system-options"
                className={cn(
                  "sidebar-link",
                  location.pathname === '/system-options' && "sidebar-link-active"
                )}
              >
                <Settings2 className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="animate-fade-in">選項設定</span>}
              </NavLink>
              <NavLink
                to="/deletion-policies"
                className={cn(
                  "sidebar-link",
                  location.pathname === '/deletion-policies' && "sidebar-link-active"
                )}
              >
                <Shield className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="animate-fade-in">刪除政策</span>}
              </NavLink>
              <NavLink
                to="/audit-logs"
                className={cn(
                  "sidebar-link",
                  location.pathname === '/audit-logs' && "sidebar-link-active"
                )}
              >
                <ClipboardList className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="animate-fade-in">稽核日誌</span>}
              </NavLink>
              <NavLink
                to="/settings"
                className={cn(
                  "sidebar-link",
                  location.pathname === '/settings' && "sidebar-link-active"
                )}
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="animate-fade-in">系統設定</span>}
              </NavLink>
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
