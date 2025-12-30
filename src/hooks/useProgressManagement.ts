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
    // Alert threshold settings
    months_threshold?: number;
    min_progress_old_project?: number;
    min_progress_late_stage?: number;
    late_stages?: string[];
    max_display_count?: number;
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

// Helper to execute raw queries for tables not yet in generated types
async function queryTable<T>(tableName: string, options?: { 
  select?: string;
  eq?: { column: string; value: unknown }[];
  order?: { column: string; ascending?: boolean };
}): Promise<T[]> {
  let query = `SELECT ${options?.select || '*'} FROM ${tableName}`;
  const conditions: string[] = [];
  
  if (options?.eq) {
    options.eq.forEach(({ column, value }) => {
      if (typeof value === 'string') {
        conditions.push(`${column} = '${value}'`);
      } else {
        conditions.push(`${column} = ${value}`);
      }
    });
  }
  
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }
  
  if (options?.order) {
    query += ` ORDER BY ${options.order.column} ${options.order.ascending !== false ? 'ASC' : 'DESC'}`;
  }
  
  const { data, error } = await supabase.rpc('execute_sql' as any, { query_text: query });
  if (error) throw error;
  return (data || []) as T[];
}

export function useProgressMilestones(type?: 'admin' | 'engineering') {
  return useQuery({
    queryKey: ['progress-milestones', type],
    queryFn: async () => {
      const conditions = type ? [{ column: 'milestone_type', value: type }] : undefined;
      
      // Use direct fetch with proper typing workaround
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/progress_milestones?${type ? `milestone_type=eq.${type}&` : ''}order=sort_order.asc`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch progress milestones');
      return (await response.json()) as ProgressMilestone[];
    },
  });
}

export function useProgressSettings() {
  return useQuery({
    queryKey: ['progress-settings'],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/progress_settings`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch progress settings');
      return (await response.json()) as ProgressSettings[];
    },
  });
}

export function useProjectMilestones(projectId: string) {
  return useQuery({
    queryKey: ['project-milestones', projectId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_milestones?project_id=eq.${projectId}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch project milestones');
      return (await response.json()) as ProjectMilestone[];
    },
    enabled: !!projectId,
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (milestone: Partial<ProgressMilestone> & { id: string }) => {
      const { id, ...updates } = milestone;
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/progress_milestones?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(updates),
        }
      );
      if (!response.ok) throw new Error('Failed to update milestone');
      const data = await response.json();
      return data[0] as ProgressMilestone;
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
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/progress_settings?setting_key=eq.${key}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({ setting_value: value }),
        }
      );
      if (!response.ok) throw new Error('Failed to update settings');
      const data = await response.json();
      return data[0] as ProgressSettings;
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
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // Check if record exists
      const checkResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_milestones?project_id=eq.${projectId}&milestone_code=eq.${milestoneCode}&select=id`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      const existing = await checkResponse.json();

      if (existing && existing.length > 0) {
        // Update existing
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_milestones?id=eq.${existing[0].id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              is_completed: isCompleted,
              completed_at: isCompleted ? new Date().toISOString() : null,
              note,
            }),
          }
        );
        if (!response.ok) throw new Error('Failed to update milestone');
      } else {
        // Insert new
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_milestones`,
          {
            method: 'POST',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              project_id: projectId,
              milestone_code: milestoneCode,
              is_completed: isCompleted,
              completed_at: isCompleted ? new Date().toISOString() : null,
              note,
            }),
          }
        );
        if (!response.ok) throw new Error('Failed to create milestone');
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
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/progress_milestones`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(milestone),
        }
      );
      if (!response.ok) throw new Error('Failed to create milestone');
      const data = await response.json();
      return data[0] as ProgressMilestone;
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
