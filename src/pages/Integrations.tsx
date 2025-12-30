import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { 
  Loader2, 
  Link2, 
  FolderOpen, 
  Key, 
  Shield, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Info
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DriveConnectionPanel } from '@/components/engineering';

// 定義已設定的 secrets 清單（不顯示實際值）
const API_KEYS_CONFIG = [
  { 
    name: 'GOOGLE_CLIENT_ID', 
    label: 'Google OAuth Client ID',
    description: '用於 Google 登入與 Drive API 認證',
    category: 'Google'
  },
  { 
    name: 'GOOGLE_CLIENT_SECRET', 
    label: 'Google OAuth Client Secret',
    description: 'Google OAuth 2.0 密鑰',
    category: 'Google'
  },
  { 
    name: 'GOOGLE_SERVICE_ACCOUNT_KEY', 
    label: 'Google Service Account',
    description: '用於伺服器端 Google API 存取',
    category: 'Google'
  },
  { 
    name: 'GOOGLE_DRIVE_ROOT_FOLDER_ID', 
    label: 'Drive Root Folder ID',
    description: '專案資料夾的根目錄 ID',
    category: 'Google'
  },
];

export default function Integrations() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Group by category
  const googleKeys = API_KEYS_CONFIG.filter(k => k.category === 'Google');

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6" />
            外部整合
          </h1>
          <p className="text-muted-foreground mt-1">
            管理與第三方服務的連結設定，包含雲端儲存、OAuth 認證等
          </p>
        </div>

        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            此頁面用於管理系統與外部服務的整合。API 金鑰以加密方式儲存，僅顯示設定狀態。
          </AlertDescription>
        </Alert>

        {/* Google Drive Connection */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            雲端儲存整合
          </h2>
          <DriveConnectionPanel />
        </section>

        <Separator />

        {/* OAuth Configuration Guide */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            OAuth 設定說明
          </h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <img 
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                  alt="Google" 
                  className="w-5 h-5" 
                />
                Google OAuth 2.0
              </CardTitle>
              <CardDescription>
                用於 Google 登入與 Google Drive API 整合
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">設定步驟：</p>
                <ol className="list-decimal list-inside space-y-1.5 ml-2">
                  <li>前往 Google Cloud Console 建立專案</li>
                  <li>啟用 Google Drive API 與 OAuth 同意畫面</li>
                  <li>建立 OAuth 2.0 用戶端 ID（Web 應用程式類型）</li>
                  <li>設定授權的 JavaScript 來源與重新導向 URI</li>
                  <li>將 Client ID 與 Client Secret 填入系統設定</li>
                </ol>
              </div>
              
              <div className="flex flex-wrap gap-2 pt-2">
                <a 
                  href="https://console.cloud.google.com/apis/credentials" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Google Cloud Console
                </a>
                <span className="text-muted-foreground">|</span>
                <a 
                  href="https://developers.google.com/identity/protocols/oauth2" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  OAuth 2.0 文件
                </a>
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* API Keys Status */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Key className="w-5 h-5" />
            API 金鑰狀態
          </h2>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Google 服務金鑰</CardTitle>
              <CardDescription>
                以下金鑰用於 Google Drive 整合與 OAuth 認證
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {googleKeys.map((key) => (
                  <div 
                    key={key.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{key.label}</p>
                      <p className="text-xs text-muted-foreground">{key.description}</p>
                    </div>
                    <Badge variant="outline" className="gap-1.5 text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      已設定
                    </Badge>
                  </div>
                ))}
              </div>
              
              <Alert className="mt-4">
                <Shield className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  所有 API 金鑰皆以加密方式儲存於系統中，無法直接查看。如需更新金鑰，請聯繫系統管理員。
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </section>

        {/* Future Integrations */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
            <Link2 className="w-5 h-5" />
            其他整合（規劃中）
          </h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="opacity-60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  📧 Email 通知服務
                  <Badge variant="secondary" className="text-xs">即將推出</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  SendGrid / SMTP 整合，用於系統通知與提醒
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="opacity-60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  📱 LINE Notify
                  <Badge variant="secondary" className="text-xs">規劃中</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  透過 LINE 推播重要案場進度更新
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </div>
    </Layout>
  );
}
