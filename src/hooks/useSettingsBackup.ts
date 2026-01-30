import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Backup {
  name: string;
  size: number;
  created_at: string;
}

interface BackupSchedule {
  frequency: 'manual' | 'daily' | 'weekly';
  last_backup_at: string | null;
  max_backups: number;
}

export function useSettingsBackup() {
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch backup list
  const { data: backups = [], isLoading: isLoadingBackups, refetch: refetchBackups } = useQuery({
    queryKey: ['settings-backups'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('未登入');

      const response = await supabase.functions.invoke('backup-settings', {
        body: { action: 'list-backups' },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error);

      return response.data.backups as Backup[];
    },
  });

  // Fetch schedule
  const { data: schedule, isLoading: isLoadingSchedule } = useQuery({
    queryKey: ['backup-schedule'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('未登入');

      const response = await supabase.functions.invoke('backup-settings', {
        body: { action: 'get-schedule' },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data.schedule as BackupSchedule;
    },
  });

  // Create backup
  const createBackup = useMutation({
    mutationFn: async (backupType: 'manual' | 'scheduled' = 'manual') => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('未登入');

      const response = await supabase.functions.invoke('backup-settings', {
        body: { action: 'create-backup', backup_type: backupType },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`備份成功！共 ${data.total_records} 筆設定資料`);
      queryClient.invalidateQueries({ queryKey: ['settings-backups'] });
    },
    onError: (error: Error) => {
      toast.error(`備份失敗: ${error.message}`);
    },
  });

  // Delete backup
  const deleteBackup = useMutation({
    mutationFn: async (filePath: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('未登入');

      const response = await supabase.functions.invoke('backup-settings', {
        body: { action: 'delete-backup', file_path: filePath },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: () => {
      toast.success('備份已刪除');
      queryClient.invalidateQueries({ queryKey: ['settings-backups'] });
    },
    onError: (error: Error) => {
      toast.error(`刪除失敗: ${error.message}`);
    },
  });

  // Update schedule
  const updateSchedule = useMutation({
    mutationFn: async (frequency: 'manual' | 'daily' | 'weekly') => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('未登入');

      const response = await supabase.functions.invoke('backup-settings', {
        body: { action: 'update-schedule', frequency },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: () => {
      toast.success('備份排程已更新');
      queryClient.invalidateQueries({ queryKey: ['backup-schedule'] });
    },
    onError: (error: Error) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  // Download backup file
  const downloadBackup = async (fileName: string) => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('settings-backups')
        .download(fileName);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('下載成功');
    } catch (error: any) {
      toast.error(`下載失敗: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    backups,
    schedule,
    isLoadingBackups,
    isLoadingSchedule,
    isDownloading,
    createBackup,
    deleteBackup,
    updateSchedule,
    downloadBackup,
    refetchBackups,
  };
}
