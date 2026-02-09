import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Memo {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  content: string;
  is_pinned: boolean;
  is_personal: boolean;
  reminder_at: string | null;
  tag_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // joined
  project?: { id: string; project_code: string; project_name: string } | null;
  tag?: { id: string; name: string; color: string } | null;
  profile?: { full_name: string | null; email: string | null } | null;
}

export interface MemoTag {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export interface MemoFormData {
  title: string;
  content: string;
  project_id?: string | null;
  is_personal: boolean;
  is_pinned: boolean;
  reminder_at?: string | null;
  tag_id?: string | null;
}

export function useMemos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: memos = [], isLoading } = useQuery({
    queryKey: ['memos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memos' as any)
        .select('*, projects:project_id(id, project_code, project_name), memo_tags:tag_id(id, name, color), profiles:user_id(full_name, email)')
        .eq('is_deleted', false)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as any[]).map((m: any) => ({
        ...m,
        project: m.projects,
        tag: m.memo_tags,
        profile: m.profiles,
      })) as Memo[];
    },
    enabled: !!user?.id,
  });

  const createMemo = useMutation({
    mutationFn: async (form: MemoFormData) => {
      const { error } = await supabase.from('memos' as any).insert({
        user_id: user!.id,
        title: form.title,
        content: form.content,
        project_id: form.project_id || null,
        is_personal: form.is_personal,
        is_pinned: form.is_pinned,
        reminder_at: form.reminder_at || null,
        tag_id: form.tag_id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] });
      toast.success('備忘錄已建立');
    },
    onError: () => toast.error('建立備忘錄失敗'),
  });

  const updateMemo = useMutation({
    mutationFn: async ({ id, ...form }: MemoFormData & { id: string }) => {
      const { error } = await supabase.from('memos' as any).update({
        title: form.title,
        content: form.content,
        project_id: form.project_id || null,
        is_personal: form.is_personal,
        is_pinned: form.is_pinned,
        reminder_at: form.reminder_at || null,
        tag_id: form.tag_id || null,
      } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] });
      toast.success('備忘錄已更新');
    },
    onError: () => toast.error('更新備忘錄失敗'),
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, is_pinned }: { id: string; is_pinned: boolean }) => {
      const { error } = await supabase.from('memos' as any).update({ is_pinned } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memos'] }),
  });

  const deleteMemo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('memos' as any).update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] });
      toast.success('備忘錄已刪除');
    },
    onError: () => toast.error('刪除備忘錄失敗'),
  });

  return { memos, isLoading, createMemo, updateMemo, togglePin, deleteMemo };
}

export function useMemoTags() {
  const queryClient = useQueryClient();

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['memo-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memo_tags' as any)
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as unknown as MemoTag[];
    },
  });

  const createTag = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { error } = await supabase.from('memo_tags' as any).insert({ name, color } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memo-tags'] });
      toast.success('標籤已建立');
    },
    onError: () => toast.error('建立標籤失敗'),
  });

  return { tags, isLoading, createTag };
}
