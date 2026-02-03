import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LinkagePendingDocument {
  id: string;
  doc_type: string;
  doc_type_code: string | null;
  issued_at: string | null;
  submitted_at: string | null;
  project_id: string;
  project_name: string;
  project_code: string | null;
  investor_code: string | null;
  has_files: boolean;
  rule_name: string;
  updated_at: string;
}

/**
 * Hook to find documents that triggered linkage rules but have no attached files
 * These documents need file uploads for proper record-keeping
 */
export function useLinkagePendingFiles() {
  return useQuery({
    queryKey: ['linkage-pending-files'],
    queryFn: async () => {
      // First, get all active linkage rules
      const { data: rules, error: rulesError } = await supabase
        .from('document_linkage_rules')
        .select('trigger_doc_type_code, rule_name')
        .eq('is_active', true);

      if (rulesError) throw rulesError;
      if (!rules || rules.length === 0) return [];

      // Get unique trigger codes
      const triggerCodes = [...new Set(rules.map(r => r.trigger_doc_type_code))];
      
      // Create a map of codes to rule names
      const ruleNameMap = new Map<string, string>();
      rules.forEach(r => {
        if (!ruleNameMap.has(r.trigger_doc_type_code)) {
          ruleNameMap.set(r.trigger_doc_type_code, r.rule_name);
        }
      });

      // Find documents that match linkage rules and have issued_at or submitted_at set
      // but don't have any files attached (check both document_files and drive_file_id)
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select(`
          id,
          doc_type,
          doc_type_code,
          issued_at,
          submitted_at,
          project_id,
          updated_at,
          drive_file_id,
          projects!inner (
            project_name,
            project_code,
            investors (
              investor_code
            )
          )
        `)
        .in('doc_type_code', triggerCodes)
        .eq('is_deleted', false)
        .or('issued_at.not.is.null,submitted_at.not.is.null')
        .order('updated_at', { ascending: false });

      if (docsError) throw docsError;
      if (!documents || documents.length === 0) return [];

      // Get file counts for these documents
      const docIds = documents.map(d => d.id);
      const { data: fileCounts, error: filesError } = await supabase
        .from('document_files')
        .select('document_id')
        .in('document_id', docIds)
        .eq('is_deleted', false);

      if (filesError) throw filesError;

      // Create a set of document IDs that have files
      const docsWithFiles = new Set(fileCounts?.map(f => f.document_id) || []);

      // Filter to only documents without files (check both document_files AND drive_file_id)
      // If document has drive_file_id, it means file was uploaded to Drive (even if document_files record missing)
      const pendingDocs: LinkagePendingDocument[] = documents
        .filter(doc => !docsWithFiles.has(doc.id) && !doc.drive_file_id)
        .map(doc => {
          const project = doc.projects as any;
          return {
            id: doc.id,
            doc_type: doc.doc_type,
            doc_type_code: doc.doc_type_code,
            issued_at: doc.issued_at,
            submitted_at: doc.submitted_at,
            project_id: doc.project_id,
            project_name: project?.project_name || '-',
            project_code: project?.project_code || null,
            investor_code: project?.investors?.investor_code || null,
            has_files: false,
            rule_name: ruleNameMap.get(doc.doc_type_code || '') || '文件連動',
            updated_at: doc.updated_at,
          };
        });

      return pendingDocs;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Check if a specific document has triggered linkage but lacks files
 */
export function useDocumentLinkageFileStatus(documentId: string | null, docTypeCode: string | null) {
  return useQuery({
    queryKey: ['document-linkage-file-status', documentId, docTypeCode],
    queryFn: async () => {
      if (!documentId || !docTypeCode) return null;

      // Check if this doc type has linkage rules
      const { data: rules } = await supabase
        .from('document_linkage_rules')
        .select('rule_name')
        .eq('trigger_doc_type_code', docTypeCode)
        .eq('is_active', true)
        .limit(1);

      if (!rules || rules.length === 0) return null;

      // Check if document has files (either in document_files or via drive_file_id)
      const { count } = await supabase
        .from('document_files')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId)
        .eq('is_deleted', false);

      // Also check if document has drive_file_id
      const { data: doc } = await supabase
        .from('documents')
        .select('drive_file_id')
        .eq('id', documentId)
        .single();

      const hasFiles = (count || 0) > 0 || !!doc?.drive_file_id;

      return {
        hasLinkage: true,
        hasFiles,
        ruleName: rules[0].rule_name,
      };
    },
    enabled: !!documentId && !!docTypeCode,
  });
}
