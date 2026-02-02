/**
 * React hooks for telemetry integration
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { 
  trackPageView, 
  trackAction, 
  trackError, 
  trackApiError,
  installGlobalErrorHandler 
} from '@/lib/telemetry';

// ==========================================
// Page View Tracking Hook
// ==========================================

/**
 * Hook to automatically track page views on route changes
 * Should be used once at the app level
 */
export function usePageViewTracking(): void {
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const prevPathRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Only track if path actually changed
    if (prevPathRef.current !== location.pathname) {
      trackPageView(location.pathname, currentWorkspace);
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, currentWorkspace]);
}

// ==========================================
// Global Error Handler Hook
// ==========================================

/**
 * Hook to install global error handlers
 * Should be used once at the app level
 */
export function useGlobalErrorTracking(): void {
  useEffect(() => {
    installGlobalErrorHandler();
  }, []);
}

// ==========================================
// Action Tracking Utilities
// ==========================================

/**
 * Pre-defined action trackers for common operations
 */
export const telemetryActions = {
  // Project actions
  createProject: (projectId: string, projectName?: string) => 
    trackAction('create_project', { project_id: projectId, project_name: projectName }),
  
  updateProject: (projectId: string, fields?: string[]) => 
    trackAction('update_project', { project_id: projectId, updated_fields: fields }),
  
  deleteProject: (projectId: string) => 
    trackAction('delete_project', { project_id: projectId }),
  
  // Document actions
  uploadDocument: (projectId: string, docType: string, count: number = 1) => 
    trackAction('upload_document', { project_id: projectId, doc_type: docType, count }),
  
  updateDocument: (documentId: string, docType: string) => 
    trackAction('update_document', { document_id: documentId, doc_type: docType }),
  
  deleteDocument: (documentId: string) => 
    trackAction('delete_document', { document_id: documentId }),
  
  // Milestone actions
  updateMilestone: (projectId: string, milestoneCode: string, isCompleted: boolean) => 
    trackAction('update_milestone', { 
      project_id: projectId, 
      milestone_code: milestoneCode, 
      is_completed: isCompleted 
    }),
  
  // Batch operations
  batchImport: (type: string, count: number, success: number) => 
    trackAction('batch_import', { type, total_count: count, success_count: success }),
  
  batchExport: (type: string, count: number, format?: string) => 
    trackAction('batch_export', { type, count, format }),
  
  batchUpdate: (type: string, count: number) => 
    trackAction('batch_update', { type, count }),
  
  batchDelete: (type: string, count: number) => 
    trackAction('batch_delete', { type, count }),
  
  // Quote actions
  createQuote: (quoteId: string, capacity?: number) => 
    trackAction('create_quote', { quote_id: quoteId, capacity_kwp: capacity }),
  
  updateQuote: (quoteId: string) => 
    trackAction('update_quote', { quote_id: quoteId }),
  
  finalizeQuote: (quoteId: string) => 
    trackAction('finalize_quote', { quote_id: quoteId }),
  
  exportQuotePdf: (quoteId: string) => 
    trackAction('export_quote_pdf', { quote_id: quoteId }),
  
  // User actions
  login: () => trackAction('login'),
  logout: () => trackAction('logout'),
  changePassword: () => trackAction('change_password'),
  
  // Settings actions
  updateSettings: (settingType: string) => 
    trackAction('update_settings', { setting_type: settingType }),
  
  backupSettings: () => trackAction('backup_settings'),
  restoreSettings: () => trackAction('restore_settings'),
  
  // Drive actions
  syncDrive: (projectId: string) => 
    trackAction('sync_drive', { project_id: projectId }),
  
  uploadToDrive: (projectId: string, fileCount: number) => 
    trackAction('upload_to_drive', { project_id: projectId, file_count: fileCount }),
  
  // OCR actions
  runOcr: (documentId: string) => 
    trackAction('run_ocr', { document_id: documentId }),
  
  batchOcr: (count: number) => 
    trackAction('batch_ocr', { count }),
  
  // AI actions
  aiAssistant: (query?: string) => 
    trackAction('ai_assistant', { query_length: query?.length }),
  
  aiInsightReport: (quoteId: string) => 
    trackAction('ai_insight_report', { quote_id: quoteId }),
};

// ==========================================
// Error Tracking Utilities
// ==========================================

export { trackError, trackApiError };
