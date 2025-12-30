import { useAuth } from '@/contexts/AuthContext';
import { Users as UsersIcon } from 'lucide-react';
import UserManagement from '@/components/UserManagement';

export default function Users() {
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
          <UsersIcon className="w-6 h-6" />
          使用者與角色
        </h1>
        <p className="text-muted-foreground mt-1">
          管理系統帳號：新增、編輯、停用使用者，以及指派角色
        </p>
      </div>

      <UserManagement />
    </div>
  );
}
