import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useLogAudit, useEffectivePolicy, type SoftDeleteTable } from './useDeletionPolicy';

interface SoftDeleteOptions {
  tableName: SoftDeleteTable;
  queryKey: string | string[];
  onSuccess?: () => void;
}

interface DeleteParams {
  id: string;
  reason?: string;
}

interface RestoreParams {
  id: string;
}

interface PurgeParams {
  id: string;
}

interface ArchiveParams {
  id: string;
  reason?: string;
}

export function useSoftDelete({ tableName, queryKey, onSuccess }: SoftDeleteOptions) {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { logAction } = useLogAudit();
  const policy = useEffectivePolicy(tableName);

  // Soft delete - sets is_deleted = true
  const softDeleteMutation = useMutation({
    mutationFn: async ({ id, reason }: DeleteParams) => {
      // Perform soft delete using raw SQL-like approach
      const updateData: Record<string, unknown> = {
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id,
        delete_reason: reason || null,
      };

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', id);

      if (error) {
        // If is_deleted column doesn't exist, fall back to hard delete with confirmation
        if (error.message.includes('is_deleted')) {
          throw new Error('刪除策略系統尚未啟用，請聯繫管理員執行資料庫遷移');
        }
        throw error;
      }

      await logAction(tableName, id, 'DELETE', reason);
    },
    onSuccess: () => {
      const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
      keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success('已移至回收區', { description: '可在回收區中復原此資料' });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error('刪除失敗', { description: error.message });
    },
  });

  // Restore from soft delete
  const restoreMutation = useMutation({
    mutationFn: async ({ id }: RestoreParams) => {
      const updateData: Record<string, unknown> = {
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        delete_reason: null,
      };

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await logAction(tableName, id, 'RESTORE');
    },
    onSuccess: () => {
      const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
      keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      toast.success('已復原', { description: '資料已成功復原' });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error('復原失敗', { description: error.message });
    },
  });

  // Permanent delete (purge)
  const purgeMutation = useMutation({
    mutationFn: async ({ id }: PurgeParams) => {
      if (!isAdmin) {
        throw new Error('只有管理員可以永久刪除');
      }

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;

      await logAction(tableName, id, 'PURGE');
    },
    onSuccess: () => {
      const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
      keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      toast.success('已永久刪除', { description: '此操作無法復原' });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error('永久刪除失敗', { description: error.message });
    },
  });

  // Archive
  const archiveMutation = useMutation({
    mutationFn: async ({ id, reason }: ArchiveParams) => {
      const updateData: Record<string, unknown> = {
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by: user?.id,
        archive_reason: reason || null,
      };

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await logAction(tableName, id, 'ARCHIVE', reason);
    },
    onSuccess: () => {
      const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
      keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success('已封存', { description: '資料已標記為唯讀' });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error('封存失敗', { description: error.message });
    },
  });

  // Unarchive
  const unarchiveMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const updateData: Record<string, unknown> = {
        is_archived: false,
        archived_at: null,
        archived_by: null,
        archive_reason: null,
      };

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await logAction(tableName, id, 'UNARCHIVE');
    },
    onSuccess: () => {
      const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
      keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success('已解除封存');
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error('解除封存失敗', { description: error.message });
    },
  });

  return {
    softDelete: softDeleteMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    purge: purgeMutation.mutateAsync,
    archive: archiveMutation.mutateAsync,
    unarchive: unarchiveMutation.mutateAsync,
    isDeleting: softDeleteMutation.isPending,
    isRestoring: restoreMutation.isPending,
    isPurging: purgeMutation.isPending,
    isArchiving: archiveMutation.isPending,
    policy,
  };
}
