import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDriveAuth } from '@/hooks/useDriveAuth';
import { 
  Settings as SettingsIcon, 
  Users, 
  Database, 
  Shield, 
  FolderOpen, 
  Link, 
  Unlink, 
  CheckCircle2,
  Loader2,
  Copy,
  AlertCircle,
  TestTube,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import type { Database as DB } from '@/integrations/supabase/types';

type AppRole = DB['public']['Enums']['app_role'];

export default function Settings() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
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
    clearError
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
    rootFolderAccess?: boolean;
    rootFolderError?: any;
    debug?: {
      authorizedEmail?: string;
      rootFolderId?: string;
      apiCalls?: Array<{
        endpoint: string;
        params: any;
        status: number;
        response: string;
        folderId?: string;
      }>;
    };
  } | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, user_roles(role)');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', userId);
      if (deleteError) throw deleteError;
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('角色已更新');
    },
  });

  const seedDataMutation = useMutation({
    mutationFn: async () => {
      const { data: inv1 } = await supabase.from('investors').insert({
        investor_code: 'INV-001', company_name: '永沛投資股份有限公司',
        tax_id: '12345678', contact_person: '王大明', phone: '02-1234-5678',
        email: 'contact@yungpei.com', address: '台北市信義區信義路五段7號'
      }).select().single();
      
      const { data: inv2 } = await supabase.from('investors').insert({
        investor_code: 'INV-002', company_name: '明群綠能有限公司',
        tax_id: '87654321', contact_person: '李小華', phone: '04-2345-6789',
        email: 'info@mingqun.com', address: '台中市西屯區台灣大道四段1號'
      }).select().single();

      await supabase.from('projects').insert([
        { project_code: 'PRJ-2024-001', project_name: '台南永康太陽能案', investor_id: inv1?.id,
          status: '同意備案', capacity_kwp: 499.5, city: '台南市', district: '永康區',
          address: '永康區中正路100號', feeder_code: 'TN-001' },
        { project_code: 'PRJ-2024-002', project_name: '高雄鳳山屋頂案', investor_id: inv1?.id,
          status: '工程施工', capacity_kwp: 299.8, city: '高雄市', district: '鳳山區',
          address: '鳳山區五甲路200號', feeder_code: 'KH-002' },
        { project_code: 'PRJ-2024-003', project_name: '台中大肚地面案', investor_id: inv2?.id,
          status: '台電審查', capacity_kwp: 999.0, city: '台中市', district: '大肚區',
          address: '大肚區沙田路一段50號', feeder_code: 'TC-001' },
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['investors'] });
      toast.success('範例資料已建立');
    },
  });

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

  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">系統設定</h1>
        <p className="text-muted-foreground mt-1">管理個人設定與系統配置</p>
      </div>

      {/* Google Drive Authorization Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" /> 
            Google Drive 連結
          </CardTitle>
        <CardDescription>
            連結您的 Google Drive 帳戶以自動建立案場資料夾
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

              {/* Test Connection */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleTestConnection} 
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4 mr-2" />
                  )}
                  測試連線
                </Button>
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
                          
                          {/* OAuth Account Info */}
                          {testResult.googleEmail && (
                            <p className="text-sm">
                              <strong>授權帳號：</strong>{testResult.googleEmail}
                            </p>
                          )}
                          
                          {/* Root Folder Status */}
                          {testResult.rootFolderId && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                              <p><strong>Root Folder ID：</strong>{testResult.rootFolderId}</p>
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

                          {/* Warning if root folder not accessible */}
                          {testResult.rootFolderId && !testResult.rootFolderAccess && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Root Folder 存取失敗</AlertTitle>
                              <AlertDescription>
                                授權帳號 ({testResult.googleEmail}) 無法存取設定的 Root Folder。
                                請確認該帳號對 Shared Drive 具有 Content Manager 或以上權限。
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          {testResult.files && testResult.files.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium">找到的檔案/資料夾：</p>
                              <ul className="text-sm list-disc list-inside">
                                {testResult.files.slice(0, 5).map((file: any) => (
                                  <li key={file.id}>{file.name}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p>{testResult.message || testResult.error}</p>
                          {testResult.googleEmail && (
                            <p className="text-sm">授權帳號：{testResult.googleEmail}</p>
                          )}
                          {testResult.errorStatus && (
                            <p className="text-sm"><strong>HTTP Status:</strong> {testResult.errorStatus}</p>
                          )}
                          {testResult.errorResponse && (
                            <div className="mt-2">
                              <p className="text-sm font-medium">錯誤回應 (完整 JSON)：</p>
                              <pre className="mt-1 p-2 bg-destructive/10 rounded text-xs overflow-auto max-h-60 whitespace-pre-wrap">
                                {typeof testResult.errorResponse === 'object' 
                                  ? JSON.stringify(testResult.errorResponse, null, 2) 
                                  : testResult.errorResponse}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>

                  {/* Debug Info Section */}
                  {testResult.debug && (
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <p className="text-sm font-medium mb-2">🔍 Debug 資訊（供除錯用）</p>
                      <div className="space-y-2 text-xs">
                        <p><strong>授權帳號 (google_email)：</strong>{testResult.debug.authorizedEmail || '(未知)'}</p>
                        <p><strong>Root Folder ID (env)：</strong>{testResult.debug.rootFolderId || '(未設定)'}</p>
                        
                        {testResult.debug.apiCalls && testResult.debug.apiCalls.length > 0 && (
                          <div className="mt-3">
                            <p className="font-medium mb-1">API 呼叫紀錄：</p>
                            {testResult.debug.apiCalls.map((call, idx) => (
                              <div key={idx} className="mt-2 p-2 bg-background rounded border">
                                <p><strong>#{idx + 1} Endpoint：</strong>{call.endpoint}</p>
                                {call.folderId && <p><strong>Folder ID：</strong>{call.folderId}</p>}
                                <p><strong>HTTP Status：</strong>{call.status}</p>
                                <p><strong>參數：</strong></p>
                                <pre className="p-1 bg-muted rounded overflow-auto whitespace-pre-wrap">
                                  {JSON.stringify(call.params, null, 2)}
                                </pre>
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
                    連結後可在新增案場時自動建立 Drive 資料夾
                  </p>
                </div>
              </div>

              {/* Debug Info - Always Show */}
              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="text-sm font-medium mb-2">🔧 目前環境資訊（除錯用）</p>
                <div className="space-y-1 text-xs font-mono">
                  <p><strong>目前登入 User ID：</strong>{user?.id || '(未登入)'}</p>
                  <p><strong>目前登入 Email：</strong>{user?.email || '(未登入)'}</p>
                  <p><strong>google_email (DB)：</strong>{tokenInfo?.google_email || '(尚未授權)'}</p>
                  <p><strong>Callback URL：</strong>{callbackUrl}</p>
                  <p className="text-muted-foreground mt-2">
                    * GOOGLE_DRIVE_ROOT_FOLDER_ID 為後端 secret，需透過測試連線查看
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

      {/* Admin-only sections */}
      {isAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> 使用者管理</CardTitle>
              <CardDescription>管理系統使用者角色</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.full_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{(u.user_roles as any)?.[0]?.role || 'viewer'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          defaultValue={(u.user_roles as any)?.[0]?.role || 'viewer'}
                          onValueChange={(role) => updateRoleMutation.mutate({ userId: u.id, role: role as AppRole })}
                          disabled={u.id === user?.id}
                        >
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">管理員</SelectItem>
                            <SelectItem value="staff">員工</SelectItem>
                            <SelectItem value="viewer">檢視者</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> 資料管理</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => seedDataMutation.mutate()} disabled={seedDataMutation.isPending}>
                匯入範例資料
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
