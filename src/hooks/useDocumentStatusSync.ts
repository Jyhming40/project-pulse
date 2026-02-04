import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { hasLinkageEffect } from '@/lib/documentLinkageRules';

interface DocumentStatusSyncInput {
  documentId: string;
  docTypeCode: string | null;
  docType: string;
  projectId: string;
  issuedAt: string | null;
  submittedAt: string | null;
  previousIssuedAt?: string | null;
  previousSubmittedAt?: string | null;
}

interface LinkageResult {
  rule: string;
  success: boolean;
  message: string;
  changes?: Record<string, unknown>;
}

interface SyncResponse {
  success: boolean;
  message: string;
  linkages: LinkageResult[];
}

/**
 * Hook to trigger document status synchronization
 * Automatically updates project status based on document milestones
 */
export function useDocumentStatusSync() {
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async (input: DocumentStatusSyncInput): Promise<SyncResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('未登入');
      }

      const response = await supabase.functions.invoke('sync-document-status', {
        body: input,
      });

      if (response.error) {
        throw new Error(response.error.message || '同步失敗');
      }

      return response.data as SyncResponse;
    },
    onSuccess: (data, variables) => {
      // Show toast for each successful linkage
      if (data.linkages && data.linkages.length > 0) {
        const successfulLinkages = data.linkages.filter(l => l.success);
        
        if (successfulLinkages.length > 0) {
          // Invalidate project queries to refresh UI
          queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['project-milestones'] });
          queryClient.invalidateQueries({ queryKey: ['linkage-pending-files'] });
          queryClient.invalidateQueries({ queryKey: ['documents', variables.projectId] });
          
          // Show success message with reminder to upload document file
          const messages = successfulLinkages.map(l => l.message).join('、');
          toast.success('文件狀態已連動', {
            description: messages,
            duration: 6000,
          });
          
          // Show reminder toast after a delay
          setTimeout(() => {
            toast.info('📎 請記得上傳文件檔案', {
              description: '雖然狀態已自動連動，但建議上傳相關函文/文件檔案以完整留存記錄',
              duration: 8000,
            });
          }, 1500);
        }
      }
    },
    onError: (error: Error) => {
      console.error('[DocumentStatusSync] Error:', error);
      // Don't show error toast - this is a background operation
    },
  });

  /**
   * Trigger sync when a document's issued_at or submitted_at is updated
   * Call this after successfully updating a document
   */
  const triggerSync = async (input: DocumentStatusSyncInput) => {
    const effectiveType = input.docTypeCode || input.docType;
    
    // Check if this document type has linkage rules
    if (!hasLinkageEffect(effectiveType)) return;

    // Check if there's a meaningful change to trigger
    const issuedAtChanged = input.issuedAt && !input.previousIssuedAt;
    const submittedAtChanged = input.submittedAt && !input.previousSubmittedAt;
    
    // Only trigger if either field was newly set
    if (!issuedAtChanged && !submittedAtChanged) return;

    // Trigger background sync
    try {
      await syncMutation.mutateAsync(input);
    } catch (err) {
      // Silently fail - this is a background enhancement
      console.error('[DocumentStatusSync] Background sync failed:', err);
    }
  };

  return {
    triggerSync,
    isSyncing: syncMutation.isPending,
  };
}
