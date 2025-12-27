import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Partner {
  id: string;
  name: string;
  partner_type: string | null;
  tax_id: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  is_active: boolean;
  work_capabilities: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePartnerInput {
  name: string;
  partner_type?: string;
  tax_id?: string;
  contact_person?: string;
  contact_phone?: string;
  email?: string;
  address?: string;
  note?: string;
  work_capabilities?: string[];
}

export interface UpdatePartnerInput extends Partial<CreatePartnerInput> {
  is_active?: boolean;
}

export function usePartners() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch all partners (exclude soft-deleted)
  const { data: partners = [], isLoading, error } = useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('is_deleted', false)
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Partner[];
    },
  });

  // Fetch only active partners (for dropdowns) - also exclude soft-deleted
  const { data: activePartners = [] } = useQuery({
    queryKey: ['partners', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Partner[];
    },
  });

  // Create partner
  const createMutation = useMutation({
    mutationFn: async (input: CreatePartnerInput) => {
      const { data, error } = await supabase
        .from('partners')
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success('外包夥伴已新增');
    },
    onError: (error: Error) => {
      toast.error('新增失敗', { description: error.message });
    },
  });

  // Update partner
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: UpdatePartnerInput & { id: string }) => {
      const { data, error } = await supabase
        .from('partners')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success('外包夥伴已更新');
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('partners')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success(is_active ? '已啟用' : '已停用');
    },
    onError: (error: Error) => {
      toast.error('操作失敗', { description: error.message });
    },
  });

  // Delete partner (admin only, soft delete preferred)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if partner is used in any assignments
      const { count, error: countError } = await supabase
        .from('project_construction_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('partner_id', id);
      
      if (countError) throw countError;
      
      if (count && count > 0) {
        throw new Error(`此夥伴已被 ${count} 個工程項目使用，無法刪除。請改為停用。`);
      }

      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success('外包夥伴已刪除');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗', { description: error.message });
    },
  });

  return {
    partners,
    activePartners,
    isLoading,
    error,
    createPartner: createMutation.mutateAsync,
    updatePartner: updateMutation.mutateAsync,
    toggleActive: toggleActiveMutation.mutateAsync,
    deletePartner: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
