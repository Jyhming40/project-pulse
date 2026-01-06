import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DocumentTag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface TagAssignment {
  id: string;
  document_id: string;
  tag_id: string;
  assigned_at: string;
  tag?: DocumentTag;
}

export function useDocumentTags() {
  const queryClient = useQueryClient();

  // Fetch all active tags
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['document-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_tags')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as DocumentTag[];
    },
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (tag: { name: string; color: string; description?: string }) => {
      const { data, error } = await supabase
        .from('document_tags')
        .insert(tag)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-tags'] });
      toast.success('標籤建立成功');
    },
    onError: (error: Error) => {
      toast.error('建立失敗', { description: error.message });
    },
  });

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DocumentTag> & { id: string }) => {
      const { error } = await supabase
        .from('document_tags')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-tags'] });
      toast.success('標籤更新成功');
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('document_tags')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-tags'] });
      toast.success('標籤已刪除');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗', { description: error.message });
    },
  });

  return {
    tags,
    isLoading,
    createTag: createTagMutation.mutateAsync,
    updateTag: updateTagMutation.mutateAsync,
    deleteTag: deleteTagMutation.mutateAsync,
    isCreating: createTagMutation.isPending,
    isUpdating: updateTagMutation.isPending,
    isDeleting: deleteTagMutation.isPending,
  };
}

export function useDocumentTagAssignments(documentId?: string) {
  const queryClient = useQueryClient();

  // Fetch assignments for a specific document
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['document-tag-assignments', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      
      const { data, error } = await supabase
        .from('document_tag_assignments')
        .select(`
          *,
          tag:document_tags(*)
        `)
        .eq('document_id', documentId);
      
      if (error) throw error;
      return data as (TagAssignment & { tag: DocumentTag })[];
    },
    enabled: !!documentId,
  });

  // Assign tag mutation
  const assignTagMutation = useMutation({
    mutationFn: async ({ documentId, tagId }: { documentId: string; tagId: string }) => {
      const { error } = await supabase
        .from('document_tag_assignments')
        .insert({ document_id: documentId, tag_id: tagId });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-tag-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
    },
    onError: (error: Error) => {
      if (error.message.includes('unique')) {
        toast.error('此標籤已指派');
      } else {
        toast.error('指派失敗', { description: error.message });
      }
    },
  });

  // Remove tag assignment mutation
  const removeTagMutation = useMutation({
    mutationFn: async ({ documentId, tagId }: { documentId: string; tagId: string }) => {
      const { error } = await supabase
        .from('document_tag_assignments')
        .delete()
        .eq('document_id', documentId)
        .eq('tag_id', tagId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-tag-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
    },
    onError: (error: Error) => {
      toast.error('移除失敗', { description: error.message });
    },
  });

  return {
    assignments,
    isLoading,
    assignTag: assignTagMutation.mutateAsync,
    removeTag: removeTagMutation.mutateAsync,
    isAssigning: assignTagMutation.isPending,
    isRemoving: removeTagMutation.isPending,
  };
}

// Hook to fetch all tag assignments for multiple documents (for list views)
export function useAllDocumentTagAssignments() {
  return useQuery({
    queryKey: ['all-document-tag-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_tag_assignments')
        .select(`
          document_id,
          tag:document_tags(id, name, color)
        `);
      
      if (error) throw error;
      
      // Group by document_id
      const grouped = new Map<string, { id: string; name: string; color: string }[]>();
      for (const item of data || []) {
        const docId = item.document_id;
        const tag = item.tag as { id: string; name: string; color: string } | null;
        if (tag) {
          if (!grouped.has(docId)) {
            grouped.set(docId, []);
          }
          grouped.get(docId)!.push(tag);
        }
      }
      
      return grouped;
    },
  });
}
