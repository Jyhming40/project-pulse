import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Wrench,
  Palette
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import BrandingSettings from '@/components/BrandingSettings';
import UserManagement from '@/components/UserManagement';
import PermissionManagement from '@/components/PermissionManagement';

export default function Settings() {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">系統設定</h1>
        <p className="text-muted-foreground mt-1">管理個人設定與系統配置</p>
      </div>

      {/* Branding Settings - Admin Only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              品牌與公司資訊
            </CardTitle>
            <CardDescription>
              設定系統名稱、Logo 與公司基本資訊
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandingSettings />
          </CardContent>
        </Card>
      )}

      {/* Admin-only sections */}
      {isAdmin && (
        <>
          {/* User Management */}
          <UserManagement />

          {/* Permission Management */}
          <PermissionManagement />

          {/* Engineering Interface - Redirect to dedicated page */}
          <Card className="border-amber-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" />
                系統治理中心
              </CardTitle>
              <CardDescription>
                進階系統維護功能，包含 Google Drive 連線設定、資料庫備份與重置等
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                系統治理中心為獨立模組，包含系統狀態監控、雲端連結設定、資料完整性檢查、資料庫備份與重置等功能。
              </p>
              <Button asChild>
                <RouterLink to="/engineering">
                  <Wrench className="w-4 h-4 mr-2" />
                  進入系統治理中心
                </RouterLink>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
