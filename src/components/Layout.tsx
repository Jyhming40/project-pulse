import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  Menu,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '儀表板' },
  { to: '/projects', icon: Building2, label: '案場管理' },
  { to: '/investors', icon: Users, label: '投資方' },
  { to: '/investor-codes', icon: BookOpen, label: '代碼對照表' },
  { to: '/documents', icon: FileText, label: '文件管理' },
];

export default function Layout({ children }: LayoutProps) {
  const { user, signOut, isAdmin, role } = useAuth();
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

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="font-display font-semibold text-sidebar-foreground text-sm">明群環能</h1>
              <p className="text-xs text-sidebar-muted">管理系統</p>
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

        {/* User Info & Sign Out */}
        <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
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
