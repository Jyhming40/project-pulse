import { useAuth } from '@/contexts/AuthContext';
import { Clock, Mail, LogOut, Phone, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export default function PendingApproval() {
  const { user, signOut } = useAuth();

  // Fetch app settings for contact info
  const { data: appSettings } = useQuery({
    queryKey: ['app-settings-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('company_name_zh, email, phone')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/auth';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <CardTitle className="text-2xl">帳號審核中</CardTitle>
          <CardDescription>
            您的帳號正在等待管理員審核
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Email：</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">註冊時間：</span>
              <span className="font-medium">
                {user?.created_at 
                  ? format(new Date(user.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })
                  : '-'}
              </span>
            </div>
          </div>

          {/* Info Message */}
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>審核通過後，請重新整理頁面即可開始使用系統。</p>
            <p>如有任何問題，請聯繫系統管理員。</p>
          </div>

          {/* Contact Info */}
          {appSettings && (appSettings.email || appSettings.phone) && (
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="w-4 h-4" />
                <span>聯絡資訊</span>
              </div>
              {appSettings.company_name_zh && (
                <p className="text-sm text-muted-foreground">{appSettings.company_name_zh}</p>
              )}
              {appSettings.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${appSettings.email}`} className="text-primary hover:underline">
                    {appSettings.email}
                  </a>
                </div>
              )}
              {appSettings.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${appSettings.phone}`} className="text-primary hover:underline">
                    {appSettings.phone}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Sign Out Button */}
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            登出
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
