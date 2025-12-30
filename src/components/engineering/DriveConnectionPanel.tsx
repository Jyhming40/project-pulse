import { useState } from 'react';
import { useDriveAuth } from '@/hooks/useDriveAuth';
import { 
  FolderOpen, 
  Link,
  Unlink,
  CheckCircle2,
  Loader2,
  Copy,
  AlertCircle,
  TestTube,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function DriveConnectionPanel() {
  const { 
    isAuthorized: isDriveAuthorized, 
    isLoading: isDriveLoading, 
    authorize: authorizeDrive, 
    revoke: revokeDrive,
    testConnection,
    isAuthorizing,
    callbackUrl,
    tokenInfo,
    authError,
    clearError,
    oauthCallbackParams,
    clearOauthParams
  } = useDriveAuth();
  
  const [isRevoking, setIsRevoking] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ 
    success: boolean; 
    message?: string; 
    error?: string;
    errorStatus?: number;
    errorResponse?: any;
    files?: any[]; 
    googleEmail?: string;
    rootFolderId?: string;
    rootFolderName?: string;
    sharedDriveId?: string;
    rootFolderAccess?: boolean;
    rootFolderError?: any;
    debug?: {
      authorizedEmail?: string;
      rootFolderId?: string;
      rootFolderName?: string;
      sharedDriveId?: string;
      apiCalls?: Array<{
        endpoint: string;
        params: any;
        status: number;
        response: string;
        folderId?: string;
      }>;
    };
  } | null>(null);

  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const handleAuthorizeDrive = async () => {
    try {
      await authorizeDrive();
    } catch (err) {
      toast.error('Google Drive 授權失敗');
    }
  };

  const handleRevokeDrive = async () => {
    setIsRevoking(true);
    try {
      await revokeDrive();
      toast.success('已取消 Google Drive 授權');
      setTestResult(null);
    } catch (err) {
      toast.error('取消授權失敗');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection();
      setTestResult(result);
      if (result.success) {
        toast.success('連線測試成功！');
      } else {
        toast.error(result.error || '連線測試失敗');
      }
    } catch (err) {
      const error = err as Error;
      setTestResult({ success: false, message: error.message });
      toast.error(error.message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyCallbackUrl = () => {
    navigator.clipboard.writeText(callbackUrl);
    toast.success('已複製 Callback URL');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" /> 
            Google Drive 連結設定
          </CardTitle>
          <CardDescription>
            連結 Google Drive 帳戶以自動建立案場資料夾
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Important Notice for Shared Drive */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>重要提示：Shared Drive 權限</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>如果根資料夾位於「共用雲端硬碟（Shared Drive）」，您用來授權的 Google 帳號必須對該 Shared Drive 具備以下權限之一：</p>
              <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                <li><strong>Content Manager</strong>（內容管理員）</li>
                <li><strong>Manager</strong>（管理員）</li>
                <li><strong>Contributor</strong>（協作者）- 可建立資料夾</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                如果權限不足，建立資料夾時會出現 403 錯誤。請確認授權帳號的 Shared Drive 權限設定。
              </p>
            </AlertDescription>
          </Alert>

          {/* OAuth Callback URL Info */}
          <Alert variant="default" className="bg-muted/50">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>設定 Google OAuth</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>請將以下 Redirect URI 加入到 Google Cloud Console 的 OAuth 設定中：</p>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 bg-background px-3 py-2 rounded text-sm break-all border">
                  {callbackUrl}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyCallbackUrl}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                使用的 Scopes: {scopes.join(', ')}
              </p>
            </AlertDescription>
          </Alert>

          {/* OAuth Callback Debug */}
          {oauthCallbackParams && (
            <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>OAuth Callback 參數（除錯用）</span>
                <Button variant="ghost" size="sm" onClick={clearOauthParams} className="h-6 px-2 text-xs">
                  清除
                </Button>
              </AlertTitle>
              <AlertDescription>
                <div className="text-xs font-mono space-y-1 mt-2">
                  <p><strong>drive_auth：</strong>{oauthCallbackParams.drive_auth || '(null)'}</p>
                  <p><strong>error：</strong>{oauthCallbackParams.error || '(null)'}</p>
                  <p><strong>error_description：</strong>{oauthCallbackParams.error_description || '(null)'}</p>
                  <p><strong>state：</strong>{oauthCallbackParams.state ? '(present)' : '(null)'}</p>
                  <p><strong>scope：</strong>{oauthCallbackParams.scope || '(null)'}</p>
                  <p><strong>code：</strong>{oauthCallbackParams.code || '(null)'}</p>
                </div>
                
                {oauthCallbackParams.scope && !oauthCallbackParams.scope.includes('drive') && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>⚠️ OAuth Scope 不足</AlertTitle>
                    <AlertDescription className="text-xs space-y-2">
                      <p><strong>已授權 Scope：</strong>{oauthCallbackParams.scope}</p>
                      <p><strong>需要 Scope：</strong>https://www.googleapis.com/auth/drive</p>
                      <Separator className="my-2" />
                      <p className="font-medium">解決方法：</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>到 Google Cloud Console → APIs & Services → OAuth consent screen</li>
                        <li>點選「Edit App」→「Scopes」</li>
                        <li>新增 scope: <code className="bg-muted px-1 rounded">https://www.googleapis.com/auth/drive</code></li>
                        <li>儲存後，取消目前授權並重新點選「連結 Google Drive」</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {(authError || tokenInfo?.google_error) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>授權錯誤</AlertTitle>
              <AlertDescription>
                {authError || tokenInfo?.google_error}
                <Button 
                  variant="link" 
                  className="p-0 h-auto ml-2 text-destructive-foreground underline"
                  onClick={clearError}
                >
                  關閉
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {isDriveLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>檢查授權狀態...</span>
            </div>
          ) : isDriveAuthorized ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <div className="flex-1">
                  <p className="font-medium text-success">已連結 Google Drive</p>
                  {tokenInfo?.google_email && (
                    <p className="text-sm text-muted-foreground">
                      連結帳號: {tokenInfo.google_email}
                    </p>
                  )}
                  {tokenInfo?.updated_at && (
                    <p className="text-xs text-muted-foreground">
                      上次更新: {new Date(tokenInfo.updated_at).toLocaleString('zh-TW')}
                    </p>
                  )}
                </div>
              </div>

              {/* Token Status Display */}
              <div className="p-3 border rounded-lg bg-muted/30">
                <p className="text-sm font-medium mb-1">🗄️ Token 狀態</p>
                <div className="text-xs font-mono">
                  <p>
                    <strong>user_drive_tokens row：</strong>
                    {tokenInfo?.hasToken ? (
                      <span className="text-success ml-1">✓ 存在</span>
                    ) : (
                      <span className="text-destructive ml-1">✗ 不存在</span>
                    )}
                  </p>
                  {tokenInfo?.hasToken && tokenInfo?.google_email && (
                    <p><strong>google_email：</strong>{tokenInfo.google_email}</p>
                  )}
                </div>
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleTestConnection} 
                  disabled={isTesting || !tokenInfo?.hasToken}
                  title={!tokenInfo?.hasToken ? '未授權，未取得 token' : undefined}
                >
                  {isTesting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4 mr-2" />
                  )}
                  測試連線
                </Button>
                {!tokenInfo?.hasToken && (
                  <span className="text-xs text-destructive">未授權，未取得 token</span>
                )}
              </div>

              {/* Test Result */}
              {testResult && (
                <div className="space-y-4">
                  <Alert variant={testResult.success && testResult.rootFolderAccess ? "default" : testResult.success ? "default" : "destructive"}>
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertTitle>
                      {testResult.success 
                        ? (testResult.rootFolderAccess ? '連線成功 - Root Folder 存取正常' : '連線成功（一般存取）')
                        : '連線失敗'}
                    </AlertTitle>
                    <AlertDescription>
                      {testResult.success ? (
                        <div className="space-y-2">
                          <p>成功存取 Google Drive！</p>
                          
                          {testResult.googleEmail && (
                            <p className="text-sm">
                              <strong>授權帳號：</strong>{testResult.googleEmail}
                            </p>
                          )}
                          
                          {testResult.rootFolderId && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                              <p><strong>Root Folder ID：</strong>{testResult.rootFolderId}</p>
                              {testResult.rootFolderName && (
                                <p><strong>Root Folder 名稱：</strong>{testResult.rootFolderName}</p>
                              )}
                              {testResult.sharedDriveId && (
                                <p><strong>Shared Drive ID：</strong>{testResult.sharedDriveId}</p>
                              )}
                              <p>
                                <strong>Root Folder 存取：</strong>
                                {testResult.rootFolderAccess ? (
                                  <span className="text-success ml-1">✓ 可存取</span>
                                ) : (
                                  <span className="text-destructive ml-1">✗ 無法存取</span>
                                )}
                              </p>
                              {testResult.rootFolderError && (
                                <div className="text-destructive text-xs mt-1">
                                  <p className="font-medium">錯誤詳情：</p>
                                  <pre className="mt-1 p-2 bg-destructive/10 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                                    {typeof testResult.rootFolderError === 'object' 
                                      ? JSON.stringify(testResult.rootFolderError, null, 2) 
                                      : testResult.rootFolderError}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}

                          {testResult.rootFolderId && !testResult.rootFolderAccess && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Root Folder 無法存取</AlertTitle>
                              <AlertDescription className="text-xs">
                                <p>授權帳號 <strong>{testResult.googleEmail}</strong> 無法存取指定的 Root Folder。</p>
                                <p className="mt-1">可能原因：</p>
                                <ul className="list-disc list-inside">
                                  <li>該帳號未被加入 Shared Drive</li>
                                  <li>該帳號權限不足（需要 Content Manager 或以上）</li>
                                  <li>Root Folder ID 設定錯誤</li>
                                </ul>
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p>{testResult.message || testResult.error}</p>
                          {testResult.errorStatus && (
                            <p className="text-xs">HTTP 狀態碼: {testResult.errorStatus}</p>
                          )}
                          {testResult.errorResponse && (
                            <pre className="text-xs mt-2 p-2 bg-destructive/10 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                              {typeof testResult.errorResponse === 'object' 
                                ? JSON.stringify(testResult.errorResponse, null, 2) 
                                : testResult.errorResponse}
                            </pre>
                          )}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                  
                  {/* Debug Info */}
                  {testResult.debug && (
                    <div className="p-3 border rounded-lg bg-muted/30">
                      <p className="text-sm font-medium mb-2">🔍 除錯資訊</p>
                      <div className="text-xs font-mono space-y-2">
                        {testResult.debug.authorizedEmail && (
                          <p><strong>授權帳號：</strong>{testResult.debug.authorizedEmail}</p>
                        )}
                        {testResult.debug.rootFolderId && (
                          <p><strong>Root Folder ID：</strong>{testResult.debug.rootFolderId}</p>
                        )}
                        {testResult.debug.rootFolderName && (
                          <p><strong>Root Folder 名稱：</strong>{testResult.debug.rootFolderName}</p>
                        )}
                        {testResult.debug.sharedDriveId && (
                          <p><strong>Shared Drive ID：</strong>{testResult.debug.sharedDriveId}</p>
                        )}
                        
                        {testResult.debug.apiCalls && testResult.debug.apiCalls.length > 0 && (
                          <div className="mt-2 space-y-2">
                            <p className="font-medium">API 呼叫紀錄：</p>
                            {testResult.debug.apiCalls.map((call, index) => (
                              <div key={index} className="p-2 bg-background rounded border">
                                <p><strong>#{index + 1}</strong> {call.endpoint}</p>
                                <p><strong>參數：</strong>{JSON.stringify(call.params)}</p>
                                <p><strong>狀態：</strong><span className={call.status >= 200 && call.status < 300 ? 'text-success' : 'text-destructive'}>{call.status}</span></p>
                                {call.folderId && <p><strong>資料夾 ID：</strong>{call.folderId}</p>}
                                <p className="mt-1"><strong>回應：</strong></p>
                                <pre className="p-1 bg-muted rounded overflow-auto max-h-32 whitespace-pre-wrap">
                                  {(() => {
                                    try {
                                      return JSON.stringify(JSON.parse(call.response), null, 2);
                                    } catch {
                                      return call.response;
                                    }
                                  })()}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">取消授權</p>
                  <p className="text-sm text-muted-foreground">
                    取消後將無法自動建立 Drive 資料夾
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                      <Unlink className="w-4 h-4 mr-2" />
                      取消授權
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>確定要取消 Google Drive 授權？</AlertDialogTitle>
                      <AlertDialogDescription>
                        取消授權後，您將無法自動建立案場資料夾。已建立的資料夾不會受到影響。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleRevokeDrive}
                        disabled={isRevoking}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isRevoking ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            處理中...
                          </>
                        ) : (
                          '確定取消授權'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                <Link className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">尚未連結 Google Drive</p>
                  <p className="text-sm text-muted-foreground">
                    連結後，系統將自動為每個案場建立專屬資料夾
                  </p>
                </div>
              </div>
              <Button onClick={handleAuthorizeDrive} disabled={isAuthorizing}>
                {isAuthorizing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    授權中...
                  </>
                ) : (
                  <>
                    <Link className="w-4 h-4 mr-2" />
                    連結 Google Drive
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
