import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DocumentStatusSyncInput {
  documentId: string;
  docTypeCode: string | null;
  docType: string;
  projectId: string;
  issuedAt: string | null;
  previousIssuedAt?: string | null;
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
          
          // Show success message with all applied rules
          const messages = successfulLinkages.map(l => l.message).join('、');
          toast.success('文件狀態已連動', {
            description: messages,
          });
        }
      }
    },
    onError: (error: Error) => {
      console.error('[DocumentStatusSync] Error:', error);
      // Don't show error toast - this is a background operation
    },
  });

  /**
   * Trigger sync when a document's issued_at is updated
   * Call this after successfully updating a document
   */
  const triggerSync = async (input: DocumentStatusSyncInput) => {
    // Only trigger if issued_at is being set (not cleared)
    if (!input.issuedAt) return;
    
    // Only trigger if this is a new issuance (previous was null)
    if (input.previousIssuedAt) return;

    // Check if this document type has linkage rules
    const linkedTypes = [
      'MOEA_CONSENT', '同意備案',
      'TPC_CONTRACT', '躉購合約', '台電躉售合約',
      'TPC_FORMAL_FIT', '正式躉售', '台電正式躉售',
    ];
    
    const effectiveType = input.docTypeCode || input.docType;
    if (!linkedTypes.includes(effectiveType)) return;

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
