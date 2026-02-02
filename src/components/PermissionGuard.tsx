import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions, ModuleName } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PermissionGuardProps {
  children: ReactNode;
  requiredPermission?: ModuleName;
  requireAdmin?: boolean;
  fallbackPath?: string;
}

export default function PermissionGuard({ 
  children, 
  requiredPermission,
  requireAdmin = false,
  fallbackPath = '/hub'
}: PermissionGuardProps) {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { canView, isLoading: permLoading } = usePermissions();
  const location = useLocation();

  // Show loading while checking auth/permissions
  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">驗證權限中...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Require admin but user is not admin
  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <ShieldAlert className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">權限不足</h1>
          <p className="text-muted-foreground">
            此頁面需要管理員權限才能存取。
          </p>
          <Button onClick={() => window.history.back()}>
            返回上一頁
          </Button>
        </div>
      </div>
    );
  }

  // Check module permission
  if (requiredPermission && !canView(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <ShieldAlert className="h-16 w-16 text-amber-500 mx-auto" />
          <h1 className="text-2xl font-bold">無法存取</h1>
          <p className="text-muted-foreground">
            您沒有權限存取此模組。請聯繫管理員開通權限。
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => window.history.back()}>
              返回上一頁
            </Button>
            <Button onClick={() => window.location.href = fallbackPath}>
              返回營運中心
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
