import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useChangePassword, usePasswordPolicy } from '@/hooks/usePasswordPolicy';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KeyRound, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { mustChangePassword, expirationInfo, isLoading: policyLoading } = usePasswordPolicy();
  const changePasswordMutation = useChangePassword();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const isForced = location.state?.forced || mustChangePassword;

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Redirect if not forced and password change not required
  useEffect(() => {
    if (!authLoading && !policyLoading && !isForced && !mustChangePassword) {
      // User accessed this page directly but doesn't need to change password
      navigate('/', { replace: true });
    }
  }, [authLoading, policyLoading, isForced, mustChangePassword, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('密碼至少需要 6 個字元');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return;
    }

    try {
      await changePasswordMutation.mutateAsync(newPassword);
      toast.success('密碼已更新');
      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '密碼更新失敗';
      setError(message);
      toast.error(message);
    }
  };

  if (authLoading || policyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>變更密碼</CardTitle>
          <CardDescription>
            {expirationInfo.isExpired 
              ? '您的密碼已過期，請設定新密碼'
              : mustChangePassword 
                ? '為了帳號安全，請設定新密碼'
                : '請設定您的新密碼'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isForced && (
            <Alert className="mb-6" variant="default">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {expirationInfo.isExpired 
                  ? '您的密碼已過期，必須更新密碼後才能繼續使用系統。'
                  : '系統要求您變更密碼，完成後才能繼續使用其他功能。'}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">新密碼</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="至少 6 個字元"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">確認新密碼</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="再次輸入新密碼"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  更新中...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  更新密碼
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p className="font-medium mb-1">密碼安全提示：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>使用至少 6 個字元</li>
              <li>建議混合大小寫字母、數字和符號</li>
              <li>避免使用容易猜測的密碼</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
