import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OcrTask {
  documentId: string;
  documentTitle: string;
  projectCode: string;
  projectId: string;
  docTypeCode?: string | null; // 文件類型代碼
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped' | 'review' | 'already_processed';
  error?: string;
  extractedDates?: {
    submittedAt?: string;
    issuedAt?: string;
    meterDate?: string;
  };
  extractedPvId?: string;
  // Flag for documents that already have OCR data
  alreadyProcessed?: boolean;
  // Existing data from previous OCR
  existingData?: {
    submittedAt?: string;
    issuedAt?: string;
    pvId?: string;
  };
  // For review status - multiple candidates found
  candidates?: Array<{
    date: string;
    type: 'submitted' | 'issued' | 'unknown';
    confidence?: number;
  }>;
}

export interface BatchOcrProgress {
  total: number;
  completed: number;
  success: number;
  error: number;
  skipped: number;
  review: number;
}

interface UseBatchOcrOptions {
  maxConcurrent?: number;
  maxBatchSize?: number;
  autoUpdate?: boolean;
  maxPages?: number;
  forceReprocess?: boolean;
}

export function useBatchOcr(options: UseBatchOcrOptions = {}) {
  const {
    maxConcurrent = 3,
    maxBatchSize = 50,
    autoUpdate = true,
    maxPages = 1,
  } = options;
  
  const [forceReprocess, setForceReprocess] = useState(false);

  const [tasks, setTasks] = useState<OcrTask[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BatchOcrProgress>({
    total: 0,
    completed: 0,
    success: 0,
    error: 0,
    skipped: 0,
    review: 0,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Process a single document OCR with retry logic for transient errors
  const processDocument = useCallback(async (
    documentId: string,
    docTypeCode: string | null | undefined,
    signal: AbortSignal
  ): Promise<{ success: boolean; error?: string; dates?: { submittedAt?: string; issuedAt?: string; meterDate?: string }; pvId?: string }> => {
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (signal.aborted) {
          return { success: false, error: '已取消' };
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          return { success: false, error: '未登入' };
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-extract-dates`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              documentId,
              maxPages,
              autoUpdate,
              docTypeCode: docTypeCode || undefined,
            }),
            signal,
          }
        );

        // Retry on 502, 503, 504 errors (transient/boot errors)
        if ([502, 503, 504].includes(response.status) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`[BatchOCR] Transient error ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return { success: false, error: errorData.error || `HTTP ${response.status}` };
        }

        const result = await response.json();
        
        // Check if any dates were found
        if ((!result.extractedDates || result.extractedDates.length === 0) && !result.pvId) {
          return { success: true, dates: {}, pvId: undefined };
        }

        // Parse extractedDates array from edge function response
        // Format: [{ date: "2024-01-01", type: "submission|issue|meter_date" }]
        const submittedAt = result.extractedDates?.find((d: { type: string; date: string }) => d.type === 'submission')?.date;
        const issuedAt = result.extractedDates?.find((d: { type: string; date: string }) => d.type === 'issue')?.date;
        const meterDate = result.extractedDates?.find((d: { type: string; date: string }) => d.type === 'meter_date')?.date;

        return {
          success: true,
          dates: {
            submittedAt,
            issuedAt,
            meterDate,
          },
          pvId: result.pvId,
        };
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return { success: false, error: '已取消' };
        }
        
        // Retry on network errors
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[BatchOCR] Network error, retrying in ${delay}ms (attempt ${attempt}/${maxRetries}):`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        return { success: false, error: error.message };
      }
    }
    
    return { success: false, error: '重試次數已達上限' };
  }, [autoUpdate, maxPages]);

  // Start batch OCR processing
  const startBatchOcr = useCallback(async (documents: Array<{
    id: string;
    title: string;
    projectCode: string;
    projectId: string;
    hasDriveFile: boolean;
    hasSubmittedAt: boolean;
    hasIssuedAt: boolean;
    submittedAt?: string | null;
    issuedAt?: string | null;
    pvId?: string | null;
    docTypeCode?: string | null; // 文件類型代碼
  }>, forceReprocessAll: boolean = false) => {
    // Separate documents into already processed and needs processing
    const allDocsWithDriveFile = documents.filter(doc => doc.hasDriveFile);
    
    // When forceReprocessAll is true, process all documents regardless of existing data
    let alreadyProcessedDocs: typeof allDocsWithDriveFile = [];
    let needsProcessingDocs: typeof allDocsWithDriveFile = [];
    
    if (forceReprocessAll) {
      // Force reprocess: treat all docs as needing processing
      needsProcessingDocs = allDocsWithDriveFile;
      alreadyProcessedDocs = [];
    } else {
      // Normal mode: skip already processed
      // Already processed = has submitted_at OR issued_at OR pvId
      alreadyProcessedDocs = allDocsWithDriveFile.filter(
        doc => doc.hasSubmittedAt || doc.hasIssuedAt || doc.pvId
      );
      
      // Needs processing = no dates and no pvId
      needsProcessingDocs = allDocsWithDriveFile.filter(
        doc => !doc.hasSubmittedAt && !doc.hasIssuedAt && !doc.pvId
      );
    }
    
    // Check if we have any documents to work with
    if (allDocsWithDriveFile.length === 0) {
      return { started: false, message: '沒有符合條件的文件（需有雲端檔案）' };
    }

    // Limit total batch size
    const limitedNeedsProcessing = needsProcessingDocs.slice(0, maxBatchSize);
    const limitedAlreadyProcessed = alreadyProcessedDocs.slice(0, maxBatchSize - limitedNeedsProcessing.length);

    // Initialize tasks - needs processing first, then already processed
    const initialTasks: OcrTask[] = [
      ...limitedNeedsProcessing.map(doc => ({
        documentId: doc.id,
        documentTitle: doc.title || '未命名',
        projectCode: doc.projectCode,
        projectId: doc.projectId,
        docTypeCode: doc.docTypeCode,
        status: 'pending' as const,
        alreadyProcessed: false,
      })),
      ...limitedAlreadyProcessed.map(doc => ({
        documentId: doc.id,
        documentTitle: doc.title || '未命名',
        projectCode: doc.projectCode,
        projectId: doc.projectId,
        status: 'already_processed' as const,
        alreadyProcessed: true,
        existingData: {
          submittedAt: doc.submittedAt || undefined,
          issuedAt: doc.issuedAt || undefined,
          pvId: doc.pvId || undefined,
        },
      })),
    ];

    setTasks(initialTasks);
    
    const toProcessCount = limitedNeedsProcessing.length;
    const alreadyCount = limitedAlreadyProcessed.length;
    
    setProgress({
      total: toProcessCount,
      completed: 0,
      success: 0,
      error: 0,
      skipped: alreadyCount, // Count already processed as "skipped" in stats
      review: 0,
    });
    setIsRunning(true);

    // Create abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Only process documents that need processing (not already processed)
    const docsToProcess = limitedNeedsProcessing;

    // Process with concurrency control
    let taskIndex = 0;
    const processNext = async (): Promise<void> => {
      while (taskIndex < docsToProcess.length && !signal.aborted) {
        const currentIndex = taskIndex++;
        const doc = docsToProcess[currentIndex];

        // Update status to processing
        setTasks(prev => prev.map((t, i) => 
          i === currentIndex ? { ...t, status: 'processing' } : t
        ));

        // Process the document with docTypeCode for proper filtering
        const result = await processDocument(doc.id, doc.docTypeCode, signal);

        // Update task result
        setTasks(prev => prev.map((t, i) => {
          if (i !== currentIndex) return t;
          
          if (signal.aborted) {
            return { ...t, status: 'skipped', error: '已取消' };
          }
          
          return {
            ...t,
            status: result.success ? 'success' : 'error',
            error: result.error,
            extractedDates: result.dates,
            extractedPvId: result.pvId,
          };
        }));

        // Update progress
        setProgress(prev => ({
          ...prev,
          completed: prev.completed + 1,
          success: prev.success + (result.success ? 1 : 0),
          error: prev.error + (result.success ? 0 : 1),
        }));
      }
    };

    // Start concurrent processing
    const workers = Array(Math.min(maxConcurrent, docsToProcess.length || 1))
      .fill(null)
      .map(() => processNext());

    await Promise.all(workers);

    setIsRunning(false);
    abortControllerRef.current = null;

    return { 
      started: true, 
      processed: docsToProcess.length,
      alreadyProcessed: alreadyCount,
    };
  }, [maxBatchSize, maxConcurrent, processDocument]);

  // Cancel batch processing
  const cancelBatchOcr = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setTasks([]);
    setProgress({
      total: 0,
      completed: 0,
      success: 0,
      error: 0,
      skipped: 0,
      review: 0,
    });
    setIsRunning(false);
  }, []);

  return {
    tasks,
    progress,
    isRunning,
    startBatchOcr,
    cancelBatchOcr,
    reset,
    forceReprocess,
    setForceReprocess,
  };
}
