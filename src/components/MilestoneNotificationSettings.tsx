import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Mail, Plus, X, Users, Building2, UserCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ProgressMilestone } from '@/hooks/useProgressManagement';

interface NotificationSettings {
  enabled: boolean;
  recipient_types: string[];
  custom_emails: string[];
}

interface MilestoneNotificationSettingsProps {
  milestones: ProgressMilestone[];
}

export default function MilestoneNotificationSettings({ milestones }: MilestoneNotificationSettingsProps) {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState('');

  // Fetch notification settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['milestone-notification-settings'],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/milestone_notification_settings`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch notification settings');
      return await response.json();
    },
  });

  // Get parsed settings
  const globalSettings: NotificationSettings = settings?.find((s: any) => s.setting_key === 'global')?.setting_value || {
    enabled: true,
    recipient_types: ['admins'],
    custom_emails: [],
  };

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // Check if exists
      const checkResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/milestone_notification_settings?setting_key=eq.${key}&select=id`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      const existing = await checkResponse.json();

      if (existing && existing.length > 0) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/milestone_notification_settings?id=eq.${existing[0].id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ setting_value: value }),
          }
        );
        if (!response.ok) throw new Error('Failed to update settings');
      } else {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/milestone_notification_settings`,
          {
            method: 'POST',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ setting_key: key, setting_value: value }),
          }
        );
        if (!response.ok) throw new Error('Failed to create settings');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestone-notification-settings'] });
      toast.success('通知設定已更新');
    },
    onError: (error: Error) => {
      toast.error('更新失敗: ' + error.message);
    },
  });

  // Update milestone notification settings
  const updateMilestoneNotification = useMutation({
    mutationFn: async ({ milestoneId, notifyOnComplete, notifyRecipients }: { 
      milestoneId: string; 
      notifyOnComplete?: boolean;
      notifyRecipients?: string[];
    }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const updates: any = {};
      if (notifyOnComplete !== undefined) updates.notify_on_complete = notifyOnComplete;
      if (notifyRecipients !== undefined) updates.notify_recipients = notifyRecipients;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/progress_milestones?id=eq.${milestoneId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        }
      );
      if (!response.ok) throw new Error('Failed to update milestone');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-milestones'] });
      toast.success('里程碑通知設定已更新');
    },
    onError: (error: Error) => {
      toast.error('更新失敗: ' + error.message);
    },
  });

  const handleToggleEnabled = (enabled: boolean) => {
    updateSettings.mutate({
      key: 'global',
      value: { ...globalSettings, enabled },
    });
  };

  const handleToggleRecipientType = (type: string) => {
    const types = globalSettings.recipient_types || [];
    const newTypes = types.includes(type)
      ? types.filter(t => t !== type)
      : [...types, type];
    updateSettings.mutate({
      key: 'global',
      value: { ...globalSettings, recipient_types: newTypes },
    });
  };

  const handleAddEmail = () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('請輸入有效的 Email');
      return;
    }
    const emails = globalSettings.custom_emails || [];
    if (emails.includes(newEmail)) {
      toast.error('此 Email 已存在');
      return;
    }
    updateSettings.mutate({
      key: 'global',
      value: { ...globalSettings, custom_emails: [...emails, newEmail] },
    });
    setNewEmail('');
  };

  const handleRemoveEmail = (email: string) => {
    const emails = globalSettings.custom_emails || [];
    updateSettings.mutate({
      key: 'global',
      value: { ...globalSettings, custom_emails: emails.filter(e => e !== email) },
    });
  };

  const handleToggleMilestoneNotification = (milestone: ProgressMilestone) => {
    updateMilestoneNotification.mutate({
      milestoneId: milestone.id,
      notifyOnComplete: !(milestone as any).notify_on_complete,
    });
  };

  const recipientTypes = [
    { key: 'admins', label: '系統管理員', icon: Users, description: '所有管理員帳號' },
    { key: 'project_creator', label: '專案建立者', icon: UserCircle, description: '建立該專案的人員' },
    { key: 'investor_contacts', label: '投資方聯絡人', icon: Building2, description: '專案所屬投資方的主要聯絡人' },
  ];

  // Filter active milestones and sort by type
  const adminMilestones = milestones.filter(m => m.milestone_type === 'admin' && m.is_active);
  const engineeringMilestones = milestones.filter(m => m.milestone_type === 'engineering' && m.is_active);

  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">載入中...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          里程碑通知設定
        </CardTitle>
        <CardDescription>
          設定里程碑完成時的 Email 通知
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Enable Switch */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">啟用里程碑通知</Label>
            <p className="text-sm text-muted-foreground">
              當里程碑完成時發送 Email 通知給相關人員
            </p>
          </div>
          <Switch
            checked={globalSettings.enabled}
            onCheckedChange={handleToggleEnabled}
          />
        </div>

        {globalSettings.enabled && (
          <>
            <Separator />

            {/* Recipient Types */}
            <div className="space-y-4">
              <Label className="text-base">通知對象類型</Label>
              <div className="grid gap-3">
                {recipientTypes.map(type => (
                  <div
                    key={type.key}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                    onClick={() => handleToggleRecipientType(type.key)}
                  >
                    <Checkbox
                      checked={globalSettings.recipient_types?.includes(type.key)}
                      onCheckedChange={() => handleToggleRecipientType(type.key)}
                    />
                    <type.icon className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{type.label}</p>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Custom Emails */}
            <div className="space-y-4">
              <Label className="text-base">自訂收件人</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="輸入 Email 地址"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                />
                <Button onClick={handleAddEmail} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {(globalSettings.custom_emails?.length || 0) > 0 && (
                <div className="flex flex-wrap gap-2">
                  {globalSettings.custom_emails?.map(email => (
                    <Badge key={email} variant="secondary" className="pl-3">
                      <Mail className="w-3 h-3 mr-1" />
                      {email}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-destructive/20"
                        onClick={() => handleRemoveEmail(email)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Milestone Selection */}
            <div className="space-y-4">
              <div>
                <Label className="text-base">需通知的里程碑</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  選擇哪些里程碑完成時需要發送通知
                </p>
              </div>

              {/* Admin Milestones */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">行政里程碑</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {adminMilestones.map(milestone => (
                    <div
                      key={milestone.id}
                      className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${
                        (milestone as any).notify_on_complete
                          ? 'bg-primary/10 border-primary/50'
                          : 'hover:bg-accent'
                      }`}
                      onClick={() => handleToggleMilestoneNotification(milestone)}
                    >
                      <Checkbox
                        checked={(milestone as any).notify_on_complete || false}
                        onCheckedChange={() => handleToggleMilestoneNotification(milestone)}
                      />
                      <span className="text-sm truncate">{milestone.milestone_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Engineering Milestones */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">工程里程碑</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {engineeringMilestones.map(milestone => (
                    <div
                      key={milestone.id}
                      className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${
                        (milestone as any).notify_on_complete
                          ? 'bg-primary/10 border-primary/50'
                          : 'hover:bg-accent'
                      }`}
                      onClick={() => handleToggleMilestoneNotification(milestone)}
                    >
                      <Checkbox
                        checked={(milestone as any).notify_on_complete || false}
                        onCheckedChange={() => handleToggleMilestoneNotification(milestone)}
                      />
                      <span className="text-sm truncate">{milestone.milestone_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
