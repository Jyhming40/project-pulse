import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Partner } from './usePartners';

export interface ConstructionAssignment {
  id: string;
  project_id: string;
  construction_work_type: string;
  partner_id: string | null;
  assignment_status: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  note: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  partners?: Partner;
}

export interface CreateAssignmentInput {
  project_id: string;
  construction_work_type: string;
  partner_id?: string;
  assignment_status?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  note?: string;
}

export interface UpdateAssignmentInput extends Partial<Omit<CreateAssignmentInput, 'project_id'>> {}

export function useConstructionAssignments(projectId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch assignments for a project (exclude soft deleted)
  const { data: assignments = [], isLoading, error } = useQuery({
    queryKey: ['construction-assignments', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_construction_assignments')
        .select('*, partners(*)')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ConstructionAssignment[];
    },
    enabled: !!projectId,
  });

  // Create assignment
  const createMutation = useMutation({
    mutationFn: async (input: CreateAssignmentInput) => {
      const { data, error } = await supabase
        .from('project_construction_assignments')
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select('*, partners(*)')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-assignments', projectId] });
      toast.success('工班指派已新增');
    },
    onError: (error: Error) => {
      toast.error('新增失敗', { description: error.message });
    },
  });

  // Update assignment
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: UpdateAssignmentInput & { id: string }) => {
      const { data, error } = await supabase
        .from('project_construction_assignments')
        .update(input)
        .eq('id', id)
        .select('*, partners(*)')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-assignments', projectId] });
      toast.success('工班指派已更新');
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  // Delete assignment (kept for backwards compatibility, should use soft delete)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_construction_assignments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-assignments', projectId] });
      toast.success('工班指派已刪除');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗', { description: error.message });
    },
  });

  return {
    assignments,
    isLoading,
    error,
    createAssignment: createMutation.mutateAsync,
    updateAssignment: updateMutation.mutateAsync,
    deleteAssignment: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
