import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ResolutionType = 'risk' | 'pending' | 'stuck';

export interface ActionItemResolution {
  id: string;
  project_id: string;
  resolution_type: ResolutionType;
  resolved_at: string;
  resolved_by: string | null;
  note: string | null;
  created_at: string;
  projects?: {
    project_name: string;
    project_code: string | null;
    status: string;
  };
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

export function useActionItemResolutions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all resolutions (for history tab)
  // Using 'any' type temporarily until table is created and types regenerated
  const { data: resolutions = [], isLoading } = useQuery({
    queryKey: ['action-item-resolutions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('action_item_resolutions')
        .select(`
          *,
          projects:project_id (
            project_name,
            project_code,
            status
          ),
          profiles:resolved_by (
            full_name,
            email
          )
        `)
        .order('resolved_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ActionItemResolution[];
    },
    enabled: !!user,
  });

  // Get resolved project IDs by type (for filtering active items)
  const resolvedProjectIds = (type: ResolutionType): Set<string> => {
    return new Set(
      resolutions
        .filter((r: ActionItemResolution) => r.resolution_type === type)
        .map((r: ActionItemResolution) => r.project_id)
    );
  };

  // Mark item as resolved
  const resolveMutation = useMutation({
    mutationFn: async ({
      projectId,
      type,
      note,
    }: {
      projectId: string;
      type: ResolutionType;
      note?: string;
    }) => {
      const { error } = await (supabase as any).from('action_item_resolutions').insert({
        project_id: projectId,
        resolution_type: type,
        resolved_by: user?.id,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-item-resolutions'] });
      toast.success('已標記為處理完成');
    },
    onError: (error) => {
      console.error('Error resolving action item:', error);
      toast.error('標記失敗，請稍後再試');
    },
  });

  // Delete resolution (restore to active list)
  const unresolve = useMutation({
    mutationFn: async (resolutionId: string) => {
      const { error } = await (supabase as any)
        .from('action_item_resolutions')
        .delete()
        .eq('id', resolutionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-item-resolutions'] });
      toast.success('已移回待處理清單');
    },
    onError: (error) => {
      console.error('Error unresolving action item:', error);
      toast.error('操作失敗，請稍後再試');
    },
  });

  return {
    resolutions,
    isLoading,
    resolvedProjectIds,
    resolve: resolveMutation.mutate,
    isResolving: resolveMutation.isPending,
    unresolve: unresolve.mutate,
    isUnresolving: unresolve.isPending,
  };
}
