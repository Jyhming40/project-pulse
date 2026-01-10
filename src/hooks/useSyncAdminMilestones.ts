import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncResult {
  success: boolean;
  sync?: {
    synced: string[];
    unsynced: string[];
    changes: { code: string; from: boolean; to: boolean }[];
  };
  progress?: {
    admin_progress: number;
    engineering_progress: number;
    overall_progress: number;
    admin_stage: string | null;
    engineering_stage: string | null;
  };
  error?: string;
}

/**
 * Hook to sync admin milestones based on document status (SSOT)
 * 
 * This hook calls the sync-admin-milestones edge function which:
 * 1. Checks each document's issued_at/submitted_at status
 * 2. Updates project_milestones accordingly
 * 3. Recalculates project progress
 * 
 * Should be called after:
 * - Document status changes (issued_at, submitted_at updates)
 * - New document creation with date fields
 * - Document deletion
 */
export function useSyncAdminMilestones() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string): Promise<SyncResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('請先登入');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-admin-milestones`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ projectId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '同步失敗');
      }

      return result;
    },
    onSuccess: (result, projectId) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-drawer', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      // Show toast if there were changes
      if (result.sync?.changes && result.sync.changes.length > 0) {
        const completed = result.sync.changes.filter(c => c.to === true).length;
        const uncompleted = result.sync.changes.filter(c => c.to === false).length;
        
        if (completed > 0 || uncompleted > 0) {
          const messages: string[] = [];
          if (completed > 0) messages.push(`${completed} 個里程碑已完成`);
          if (uncompleted > 0) messages.push(`${uncompleted} 個里程碑取消完成`);
          toast.success('里程碑已同步', { description: messages.join('、') });
        }
      }
    },
    onError: (error: Error) => {
      console.error('Sync admin milestones failed:', error);
      // Don't show error toast for sync failures - it's a background operation
    },
  });
}

/**
 * Utility function to sync milestones without React Query
 * Useful for calling from edge functions or other contexts
 */
export async function syncAdminMilestonesDirectly(projectId: string): Promise<SyncResult> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('請先登入');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-admin-milestones`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectId }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || '同步失敗');
  }

  return result;
}
