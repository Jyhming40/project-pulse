import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BatchSyncResult {
  success: boolean;
  results?: {
    total: number;
    synced: number;
    failed: number;
    details: { projectId: string; projectCode: string; success: boolean; changesCount: number; error?: string }[];
  };
  error?: string;
}

/**
 * Hook to batch sync admin milestones for ALL projects
 * This is useful for initializing milestone data across all projects
 */
export function useBatchSyncMilestones() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<BatchSyncResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('請先登入');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-sync-admin-milestones`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '同步失敗');
      }

      return result;
    },
    onSuccess: (result) => {
      // Invalidate all project-related queries
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-for-comparison'] });
      queryClient.invalidateQueries({ queryKey: ['comparison-data'] });
      queryClient.invalidateQueries({ queryKey: ['project-milestones'] });

      if (result.results) {
        const { synced, failed, total } = result.results;
        const changesCount = result.results.details
          .filter(d => d.success)
          .reduce((sum, d) => sum + d.changesCount, 0);

        toast.success('批次同步完成', {
          description: `共 ${total} 個專案，成功 ${synced} 個，更新了 ${changesCount} 個里程碑`,
        });
      }
    },
    onError: (error: Error) => {
      console.error('Batch sync failed:', error);
      toast.error('批次同步失敗', { description: error.message });
    },
  });
}
