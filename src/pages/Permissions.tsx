import { useAuth } from '@/contexts/AuthContext';
import { Shield } from 'lucide-react';
import PermissionManagement from '@/components/PermissionManagement';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Permissions() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">您沒有權限查看此頁面</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Shield className="w-6 h-6" />
          權限與模組可見性
        </h1>
        <p className="text-muted-foreground mt-1">
          設定各角色對模組的存取權限，支援個別使用者覆蓋設定
        </p>
      </div>

      <Alert>
        <Shield className="w-4 h-4" />
        <AlertDescription>
          此頁面專門管理「角色 × 模組」的權限矩陣。如需新增或編輯使用者帳號，請前往「使用者與角色」頁面。
        </AlertDescription>
      </Alert>

      <PermissionManagement />
    </div>
  );
}
