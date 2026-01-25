import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StageResponsibility {
  id: string;
  stage_id: string;
  responsible_department_id: string;
  consulted_department_ids: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useStageResponsibilities() {
  const queryClient = useQueryClient();

  const { data: responsibilities = [], isLoading, error } = useQuery({
    queryKey: ['stage_responsibilities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_responsibilities')
        .select('*');
      
      if (error) throw error;
      return data as StageResponsibility[];
    },
  });

  const upsertResponsibility = useMutation({
    mutationFn: async (resp: Omit<StageResponsibility, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => {
      if (resp.id) {
        // Update existing
        const { data, error } = await supabase
          .from('stage_responsibilities')
          .update({
            responsible_department_id: resp.responsible_department_id,
            consulted_department_ids: resp.consulted_department_ids,
            notes: resp.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', resp.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('stage_responsibilities')
          .insert({
            stage_id: resp.stage_id,
            responsible_department_id: resp.responsible_department_id,
            consulted_department_ids: resp.consulted_department_ids,
            notes: resp.notes,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage_responsibilities'] });
      toast.success('責任設定已儲存');
    },
    onError: (error) => {
      toast.error(`儲存失敗: ${error.message}`);
    },
  });

  const deleteResponsibility = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stage_responsibilities')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage_responsibilities'] });
      toast.success('責任設定已刪除');
    },
    onError: (error) => {
      toast.error(`刪除失敗: ${error.message}`);
    },
  });

  // Helper to get responsibility for a stage
  const getResponsibilityForStage = (stageId: string) => {
    return responsibilities.find(r => r.stage_id === stageId);
  };

  return {
    responsibilities,
    isLoading,
    error,
    upsertResponsibility,
    deleteResponsibility,
    getResponsibilityForStage,
  };
}
