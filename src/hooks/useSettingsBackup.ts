import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Backup {
  timestamp: string;
  excel_file: string | null;
  json_file: string | null;
  excel_size: number;
  json_size: number;
  created_at: string;
  can_restore: boolean;
}

interface BackupSchedule {
  frequency: 'manual' | 'daily' | 'weekly';
  last_backup_at: string | null;
  max_backups: number;
}

interface BackupPreview {
  backup_info: {
    created_at: string;
    created_by: string;
    backup_type: string;
    tables: string[];
    record_counts: Record<string, number>;
  };
  tables: Array<{ name: string; count: number }>;
}

interface RestoreResult {
  success: boolean;
  message: string;
  results: Record<string, { success: boolean; count: number; error?: string }>;
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

  // Preview backup contents
  const previewBackup = async (jsonFilePath: string): Promise<BackupPreview | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('未登入');

      const response = await supabase.functions.invoke('backup-settings', {
        body: { action: 'preview-backup', file_path: jsonFilePath },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error);

      return response.data as BackupPreview;
    } catch (error: any) {
      toast.error(`預覽失敗: ${error.message}`);
      return null;
    }
  };

  // Restore backup
  const restoreBackup = useMutation({
    mutationFn: async ({ filePath, tables }: { filePath: string; tables?: string[] }): Promise<RestoreResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('未登入');

      const response = await supabase.functions.invoke('backup-settings', {
        body: { action: 'restore-backup', file_path: filePath, tables },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data as RestoreResult;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.warning(data.message);
      }
      // Invalidate all settings-related queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['settings-backups'] });
      queryClient.invalidateQueries({ queryKey: ['system-options'] });
      queryClient.invalidateQueries({ queryKey: ['document-type-config'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['process-stages'] });
      queryClient.invalidateQueries({ queryKey: ['progress-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['quote-presets'] });
    },
    onError: (error: Error) => {
      toast.error(`還原失敗: ${error.message}`);
    },
  });

  // Download backup file (Excel or JSON)
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
    previewBackup,
    restoreBackup,
    refetchBackups,
  };
}
