import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DocumentLinkageRule {
  id: string;
  rule_name: string;
  description: string | null;
  trigger_doc_type_code: string;
  trigger_field: 'issued_at' | 'submitted_at';
  trigger_condition: 'set_new' | 'any_change';
  target_type: 'project_status' | 'construction_status' | 'milestone' | 'project_field';
  target_value: string | null;
  target_field: string | null;
  use_trigger_value: boolean;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateLinkageRuleInput {
  rule_name: string;
  description?: string;
  trigger_doc_type_code: string;
  trigger_field?: 'issued_at' | 'submitted_at';
  trigger_condition?: 'set_new' | 'any_change';
  target_type: 'project_status' | 'construction_status' | 'milestone' | 'project_field';
  target_value?: string;
  target_field?: string;
  use_trigger_value?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export function useDocumentLinkageRules() {
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ['document-linkage-rules'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('document_linkage_rules')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as DocumentLinkageRule[];
    },
  });

  const createRule = useMutation({
    mutationFn: async (input: CreateLinkageRuleInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('document_linkage_rules')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as DocumentLinkageRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-linkage-rules'] });
      toast.success('連動規則已新增');
    },
    onError: (error: Error) => {
      toast.error('新增失敗', { description: error.message });
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DocumentLinkageRule> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('document_linkage_rules')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DocumentLinkageRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-linkage-rules'] });
      toast.success('連動規則已更新');
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('document_linkage_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-linkage-rules'] });
      toast.success('連動規則已刪除');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗', { description: error.message });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('document_linkage_rules')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DocumentLinkageRule;
    },
    onSuccess: (data: DocumentLinkageRule) => {
      queryClient.invalidateQueries({ queryKey: ['document-linkage-rules'] });
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
 * Get active rules for a specific document type code
 */
export function useActiveRulesForDocType(docTypeCode: string | null) {
  const { activeRules } = useDocumentLinkageRules();
  
  if (!docTypeCode) return [];
  
  return activeRules.filter(rule => rule.trigger_doc_type_code === docTypeCode);
}
