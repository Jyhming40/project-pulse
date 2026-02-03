import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DocumentExpiryRule {
  id: string;
  rule_name: string;
  description: string | null;
  source_doc_type_code: string;
  base_field: 'issued_at' | 'submitted_at';
  default_validity_days: number | null;
  supersede_doc_type_code: string | null;
  supersede_action: 'clear' | 'inherit_field' | 'extend_days' | null;
  supersede_field: string | null;
  supersede_days: number | null;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateExpiryRuleInput {
  rule_name: string;
  description?: string;
  source_doc_type_code: string;
  base_field?: 'issued_at' | 'submitted_at';
  default_validity_days?: number | null;
  supersede_doc_type_code?: string;
  supersede_action?: 'clear' | 'inherit_field' | 'extend_days';
  supersede_field?: string;
  supersede_days?: number;
  is_active?: boolean;
  sort_order?: number;
}

export function useDocumentExpiryRules() {
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ['document-expiry-rules'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('document_expiry_rules')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as DocumentExpiryRule[];
    },
  });

  const createRule = useMutation({
    mutationFn: async (input: CreateExpiryRuleInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('document_expiry_rules')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as DocumentExpiryRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-expiry-rules'] });
      toast.success('效期規則已新增');
    },
    onError: (error: Error) => {
      toast.error('新增失敗', { description: error.message });
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DocumentExpiryRule> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('document_expiry_rules')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DocumentExpiryRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-expiry-rules'] });
      toast.success('效期規則已更新');
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('document_expiry_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-expiry-rules'] });
      toast.success('效期規則已刪除');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗', { description: error.message });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('document_expiry_rules')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DocumentExpiryRule;
    },
    onSuccess: (data: DocumentExpiryRule) => {
      queryClient.invalidateQueries({ queryKey: ['document-expiry-rules'] });
      toast.success(data.is_active ? '規則已啟用' : '規則已停用');
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  return {
    rules,
    activeRules: rules.filter(r => r.is_active),
    isLoading,
    error,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  };
}

/**
 * Get active expiry rules for a specific document type code
 */
export function useActiveExpiryRulesForDocType(docTypeCode: string | null) {
  const { activeRules } = useDocumentExpiryRules();
  
  if (!docTypeCode) return [];
  
  return activeRules.filter(rule => 
    rule.source_doc_type_code === docTypeCode || 
    rule.supersede_doc_type_code === docTypeCode
  );
}
