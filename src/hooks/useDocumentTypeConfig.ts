import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AGENCY_CODE_TO_LABEL, type AgencyCode } from '@/lib/docTypeMapping';

export interface DocumentTypeConfig {
  id: string;
  code: string;
  label: string;
  agency_code: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface DocumentTypeConfigInput {
  code: string;
  label: string;
  agency_code: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}

export function useDocumentTypeConfig() {
  const queryClient = useQueryClient();

  // Fetch all document types
  const { data: documentTypes = [], isLoading, error } = useQuery({
    queryKey: ['document-type-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_type_config' as any)
        .select('*')
        .order('agency_code')
        .order('sort_order');

      if (error) throw error;
      return (data || []) as unknown as DocumentTypeConfig[];
    },
  });

  // Create new document type
  const createMutation = useMutation({
    mutationFn: async (input: DocumentTypeConfigInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('document_type_config' as any)
        .insert({
          ...input,
          created_by: user?.id,
          updated_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-type-config'] });
      toast.success('文件類型已建立');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('代碼已存在', { description: '請使用不同的代碼' });
      } else {
        toast.error('建立失敗', { description: error.message });
      }
    },
  });

  // Update document type
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<DocumentTypeConfigInput>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('document_type_config' as any)
        .update({
          ...input,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-type-config'] });
      toast.success('文件類型已更新');
    },
    onError: (error: any) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('document_type_config' as any)
        .update({
          is_active,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['document-type-config'] });
      toast.success(variables.is_active ? '已啟用' : '已停用');
    },
    onError: (error: any) => {
      toast.error('操作失敗', { description: error.message });
    },
  });

  // Get grouped by agency
  const groupedByAgency = useCallback(() => {
    const grouped: Record<string, DocumentTypeConfig[]> = {};
    
    documentTypes.forEach(dt => {
      if (!grouped[dt.agency_code]) {
        grouped[dt.agency_code] = [];
      }
      grouped[dt.agency_code].push(dt);
    });

    return grouped;
  }, [documentTypes]);

  // Get active types only
  const activeTypes = documentTypes.filter(dt => dt.is_active);

  return {
    documentTypes,
    activeTypes,
    isLoading,
    error,
    groupedByAgency,
    createDocumentType: createMutation.mutateAsync,
    updateDocumentType: updateMutation.mutateAsync,
    toggleActive: toggleActiveMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}