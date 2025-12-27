import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PartnerContact {
  id: string;
  partner_id: string;
  contact_name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePartnerContactInput {
  partner_id: string;
  contact_name: string;
  role?: string;
  phone?: string;
  email?: string;
  note?: string;
  is_primary?: boolean;
}

export interface UpdatePartnerContactInput extends Partial<Omit<CreatePartnerContactInput, 'partner_id'>> {
  is_active?: boolean;
}

export function usePartnerContacts(partnerId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch contacts for a specific partner
  const { data: contacts = [], isLoading, error } = useQuery({
    queryKey: ['partner-contacts', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from('partner_contacts')
        .select('*')
        .eq('partner_id', partnerId)
        .order('is_primary', { ascending: false })
        .order('contact_name', { ascending: true });
      if (error) throw error;
      return data as PartnerContact[];
    },
    enabled: !!partnerId,
  });

  // Create contact
  const createMutation = useMutation({
    mutationFn: async (input: CreatePartnerContactInput) => {
      // If setting as primary, unset other primaries first
      if (input.is_primary) {
        await supabase
          .from('partner_contacts')
          .update({ is_primary: false })
          .eq('partner_id', input.partner_id);
      }

      const { data, error } = await supabase
        .from('partner_contacts')
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['partner-contacts', variables.partner_id] });
      toast.success('聯絡人已新增');
    },
    onError: (error: Error) => {
      toast.error('新增失敗', { description: error.message });
    },
  });

  // Update contact
  const updateMutation = useMutation({
    mutationFn: async ({ id, partnerId: pId, ...input }: UpdatePartnerContactInput & { id: string; partnerId: string }) => {
      // If setting as primary, unset other primaries first
      if (input.is_primary) {
        await supabase
          .from('partner_contacts')
          .update({ is_primary: false })
          .eq('partner_id', pId)
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('partner_contacts')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['partner-contacts', variables.partnerId] });
      toast.success('聯絡人已更新');
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  // Delete contact
  const deleteMutation = useMutation({
    mutationFn: async ({ id, partnerId: pId }: { id: string; partnerId: string }) => {
      const { error } = await supabase
        .from('partner_contacts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return pId;
    },
    onSuccess: (pId) => {
      queryClient.invalidateQueries({ queryKey: ['partner-contacts', pId] });
      toast.success('聯絡人已刪除');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗', { description: error.message });
    },
  });

  return {
    contacts,
    isLoading,
    error,
    createContact: createMutation.mutateAsync,
    updateContact: updateMutation.mutateAsync,
    deleteContact: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
