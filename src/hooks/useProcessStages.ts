import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProcessStage {
  id: string;
  code: string;
  name: string;
  description: string | null;
  phase: string;
  milestone_step: number | null;
  default_sla_days: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const PHASE_OPTIONS = [
  { value: 'pre_review', label: '前置作業' },
  { value: 'review', label: '審查階段' },
  { value: 'construction', label: '施工階段' },
  { value: 'operation', label: '營運階段' },
];

export function useProcessStages() {
  const queryClient = useQueryClient();

  const { data: stages = [], isLoading, error } = useQuery({
    queryKey: ['process_stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('process_stages')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as ProcessStage[];
    },
  });

  const createStage = useMutation({
    mutationFn: async (stage: Omit<ProcessStage, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('process_stages')
        .insert(stage)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process_stages'] });
      toast.success('流程階段已新增');
    },
    onError: (error) => {
      toast.error(`新增失敗: ${error.message}`);
    },
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProcessStage> & { id: string }) => {
      const { data, error } = await supabase
        .from('process_stages')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process_stages'] });
      toast.success('流程階段已更新');
    },
    onError: (error) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('process_stages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process_stages'] });
      toast.success('流程階段已刪除');
    },
    onError: (error) => {
      toast.error(`刪除失敗: ${error.message}`);
    },
  });

  const activeStages = stages.filter(s => s.is_active);

  return {
    stages,
    activeStages,
    isLoading,
    error,
    createStage,
    updateStage,
    deleteStage,
  };
}
