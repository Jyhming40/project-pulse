import { useState } from 'react';
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
  ExternalLink,
  Info,
  Mail,
  Send,
  RefreshCw,
  TestTube
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DriveConnectionPanel } from '@/components/engineering';
import { DriveSettingsPanel } from '@/components/DriveSettingsPanel';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  { 
    name: 'RESEND_API_KEY', 
    label: 'Resend API Key',
    description: '用於發送系統通知郵件',
    category: 'Email'
  },
];

export default function Integrations() {
  const { isAdmin, loading, user } = useAuth();
  const [testEmailTo, setTestEmailTo] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [updateKeyDialog, setUpdateKeyDialog] = useState<{ open: boolean; keyName: string; keyLabel: string }>({
    open: false,
    keyName: '',
    keyLabel: ''
  });

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
  const emailKeys = API_KEYS_CONFIG.filter(k => k.category === 'Email');

  const handleSendTestEmail = async () => {
    if (!testEmailTo.trim()) {
      toast.error('請輸入測試收件人信箱');
      return;
    }

    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          to: testEmailTo,
          subject: '系統測試郵件 - 光電專案管理系統',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">📧 Email 通知測試成功！</h2>
              <p>這是一封來自光電專案管理系統的測試郵件。</p>
              <p>如果您收到這封郵件，表示 Email 通知功能已正確設定。</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #888; font-size: 12px;">
                發送時間：${new Date().toLocaleString('zh-TW')}<br/>
                發送者：${user?.email}
              </p>
            </div>
          `
        }
      });

      if (error) throw error;

      toast.success('測試郵件已發送！請檢查收件匣');
      setTestEmailTo('');
    } catch (error: any) {
      console.error('Send test email error:', error);
      toast.error(`發送失敗：${error.message || '請確認 Resend API Key 設定正確'}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleUpdateKey = (keyName: string, keyLabel: string) => {
    setUpdateKeyDialog({ open: true, keyName, keyLabel });
  };

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
            管理與第三方服務的連結設定，包含雲端儲存、OAuth 認證、Email 通知等
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
          <div className="grid gap-4 lg:grid-cols-2">
            <DriveConnectionPanel />
            <DriveSettingsPanel />
          </div>
        </section>

        <Separator />

        {/* Email Notification Service */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email 通知服務
          </h2>
          
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Resend 郵件服務
                </CardTitle>
                <CardDescription>
                  用於發送系統通知、進度更新提醒等自動郵件
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Resend API Key</p>
                    <p className="text-xs text-muted-foreground">用於郵件發送服務認證</p>
                  </div>
                  <Badge variant="outline" className="gap-1.5 text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    已設定
                  </Badge>
                </div>

                <div className="text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">使用說明：</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                    <li>目前使用 Resend 預設發送網域 (onboarding@resend.dev)</li>
                    <li>如需自訂發送網域，請至 Resend 控制台設定</li>
                    <li>系統可自動發送進度通知、案場更新提醒等</li>
                  </ul>
                </div>

                <div className="flex gap-2 pt-2">
                  <a 
                    href="https://resend.com/domains" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    網域設定
                  </a>
                  <span className="text-muted-foreground">|</span>
                  <a 
                    href="https://resend.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    API 金鑰管理
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TestTube className="w-4 h-4" />
                  發送測試郵件
                </CardTitle>
                <CardDescription>
                  驗證 Email 服務是否正確設定
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-email">收件人信箱</Label>
                  <Input
                    id="test-email"
                    type="email"
                    placeholder="test@example.com"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleSendTestEmail} 
                  disabled={isSendingTest || !testEmailTo.trim()}
                  className="w-full"
                >
                  {isSendingTest ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      發送中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      發送測試郵件
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
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
          
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Google Keys */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Google 服務金鑰</CardTitle>
                <CardDescription>
                  用於 Google Drive 整合與 OAuth 認證
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {googleKeys.map((key) => (
                    <div 
                      key={key.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                    >
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{key.label}</p>
                        <p className="text-xs text-muted-foreground">{key.description}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge variant="outline" className="gap-1.5 text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          已設定
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateKey(key.name, key.label)}
                          title="更新金鑰"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Email Keys */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Email 服務金鑰</CardTitle>
                <CardDescription>
                  用於發送系統通知與自動郵件
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {emailKeys.map((key) => (
                    <div 
                      key={key.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                    >
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{key.label}</p>
                        <p className="text-xs text-muted-foreground">{key.description}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge variant="outline" className="gap-1.5 text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          已設定
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateKey(key.name, key.label)}
                          title="更新金鑰"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Alert className="mt-4">
            <Shield className="w-4 h-4" />
            <AlertDescription className="text-xs">
              所有 API 金鑰皆以加密方式儲存於系統中，無法直接查看。點擊更新按鈕可透過安全表單更新金鑰值。
            </AlertDescription>
          </Alert>
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
                  📱 LINE Notify
                  <Badge variant="secondary" className="text-xs">規劃中</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  透過 LINE 推播重要案場進度更新
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="opacity-60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  📊 Webhook 整合
                  <Badge variant="secondary" className="text-xs">規劃中</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  自定義 Webhook 接收系統事件通知
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </div>

      {/* Update Key Dialog */}
      <Dialog open={updateKeyDialog.open} onOpenChange={(open) => setUpdateKeyDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>更新 API 金鑰</DialogTitle>
            <DialogDescription>
              您即將更新 <strong>{updateKeyDialog.keyLabel}</strong>。請透過系統管理介面安全地更新此金鑰。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-sm">
                基於安全考量，API 金鑰更新需透過 Lovable 的安全介面進行。請在聊天視窗中輸入：<br/>
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs mt-1 inline-block">
                  請幫我更新 {updateKeyDialog.keyName} 金鑰
                </code>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateKeyDialog(prev => ({ ...prev, open: false }))}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
