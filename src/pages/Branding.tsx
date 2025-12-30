import { useAuth } from '@/contexts/AuthContext';
import { Palette } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import BrandingSettings from '@/components/BrandingSettings';

export default function Branding() {
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
        <h1 className="text-2xl font-display font-bold">公司設定</h1>
        <p className="text-muted-foreground mt-1">設定系統名稱、Logo 與公司基本資訊</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            品牌與公司資訊
          </CardTitle>
          <CardDescription>
            自訂系統外觀與公司識別
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandingSettings />
        </CardContent>
      </Card>
    </div>
  );
}
