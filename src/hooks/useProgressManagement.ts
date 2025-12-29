import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProgressMilestone {
  id: string;
  milestone_type: 'admin' | 'engineering';
  milestone_code: string;
  milestone_name: string;
  weight: number;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  description: string | null;
  stage_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressSettings {
  id: string;
  setting_key: string;
  setting_value: {
    admin_weight?: number;
    engineering_weight?: number;
    allow_skip?: boolean;
    require_sequence?: boolean;
  };
  description: string | null;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  milestone_code: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  note: string | null;
}

export function useProgressMilestones(type?: 'admin' | 'engineering') {
  return useQuery({
    queryKey: ['progress-milestones', type],
    queryFn: async () => {
      let query = supabase
        .from('progress_milestones')
        .select('*')
        .order('sort_order');
      
      if (type) {
        query = query.eq('milestone_type', type);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ProgressMilestone[];
    },
  });
}

export function useProgressSettings() {
  return useQuery({
    queryKey: ['progress-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_settings')
        .select('*');
      if (error) throw error;
      return data as ProgressSettings[];
    },
  });
}

export function useProjectMilestones(projectId: string) {
  return useQuery({
    queryKey: ['project-milestones', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', projectId);
      if (error) throw error;
      return data as ProjectMilestone[];
    },
    enabled: !!projectId,
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (milestone: Partial<ProgressMilestone> & { id: string }) => {
      const { data, error } = await supabase
        .from('progress_milestones')
        .update(milestone)
        .eq('id', milestone.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-milestones'] });
      toast({ title: '里程碑已更新' });
    },
    onError: (error: Error) => {
      toast({ title: '更新失敗', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateProgressSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from('progress_settings')
        .update({ setting_value: value })
        .eq('setting_key', key)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-settings'] });
      toast({ title: '設定已更新' });
    },
    onError: (error: Error) => {
      toast({ title: '更新失敗', description: error.message, variant: 'destructive' });
    },
  });
}

export function useToggleProjectMilestone() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      milestoneCode, 
      isCompleted,
      note 
    }: { 
      projectId: string; 
      milestoneCode: string; 
      isCompleted: boolean;
      note?: string;
    }) => {
      const { data: existing } = await supabase
        .from('project_milestones')
        .select('id')
        .eq('project_id', projectId)
        .eq('milestone_code', milestoneCode)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('project_milestones')
          .update({
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date().toISOString() : null,
            note,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_milestones')
          .insert({
            project_id: projectId,
            milestone_code: milestoneCode,
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date().toISOString() : null,
            note,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-milestones', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: variables.isCompleted ? '里程碑已完成' : '里程碑已取消' });
    },
    onError: (error: Error) => {
      toast({ title: '操作失敗', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (milestone: Omit<ProgressMilestone, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('progress_milestones')
        .insert(milestone)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-milestones'] });
      toast({ title: '里程碑已新增' });
    },
    onError: (error: Error) => {
      toast({ title: '新增失敗', description: error.message, variant: 'destructive' });
    },
  });
}
