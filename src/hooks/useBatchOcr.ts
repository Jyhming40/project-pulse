import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OcrTask {
  documentId: string;
  documentTitle: string;
  projectCode: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped' | 'review';
  error?: string;
  extractedDates?: {
    submittedAt?: string;
    issuedAt?: string;
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
}

export function useBatchOcr(options: UseBatchOcrOptions = {}) {
  const {
    maxConcurrent = 3,
    maxBatchSize = 50,
    autoUpdate = true,
    maxPages = 1,
  } = options;

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

  // Process a single document OCR
  const processDocument = useCallback(async (
    documentId: string,
    signal: AbortSignal
  ): Promise<{ success: boolean; error?: string; dates?: { submittedAt?: string; issuedAt?: string } }> => {
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
          }),
          signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || `HTTP ${response.status}` };
      }

      const result = await response.json();
      
      // Check if any dates were found
      if (!result.extractedDates || result.extractedDates.length === 0) {
        return { success: true, dates: {} };
      }

      return {
        success: true,
        dates: {
          submittedAt: result.updatedFields?.submitted_at,
          issuedAt: result.updatedFields?.issued_at,
        },
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: '已取消' };
      }
      return { success: false, error: error.message };
    }
  }, [autoUpdate, maxPages]);

  // Start batch OCR processing
  const startBatchOcr = useCallback(async (documents: Array<{
    id: string;
    title: string;
    projectCode: string;
    hasDriveFile: boolean;
    hasSubmittedAt: boolean;
    hasIssuedAt: boolean;
  }>) => {
    // Filter documents that need OCR (have drive file but missing dates)
    const eligibleDocs = documents
      .filter(doc => doc.hasDriveFile && (!doc.hasSubmittedAt || !doc.hasIssuedAt))
      .slice(0, maxBatchSize);

    if (eligibleDocs.length === 0) {
      return { started: false, message: '沒有符合條件的文件（需有雲端檔案且缺少日期）' };
    }

    // Initialize tasks
    const initialTasks: OcrTask[] = eligibleDocs.map(doc => ({
      documentId: doc.id,
      documentTitle: doc.title || '未命名',
      projectCode: doc.projectCode,
      status: 'pending',
    }));

    setTasks(initialTasks);
    setProgress({
      total: eligibleDocs.length,
      completed: 0,
      success: 0,
      error: 0,
      skipped: 0,
      review: 0,
    });
    setIsRunning(true);

    // Create abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Process with concurrency control
    let taskIndex = 0;
    const processNext = async (): Promise<void> => {
      while (taskIndex < eligibleDocs.length && !signal.aborted) {
        const currentIndex = taskIndex++;
        const doc = eligibleDocs[currentIndex];

        // Update status to processing
        setTasks(prev => prev.map((t, i) => 
          i === currentIndex ? { ...t, status: 'processing' } : t
        ));

        // Process the document
        const result = await processDocument(doc.id, signal);

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
    const workers = Array(Math.min(maxConcurrent, eligibleDocs.length))
      .fill(null)
      .map(() => processNext());

    await Promise.all(workers);

    setIsRunning(false);
    abortControllerRef.current = null;

    return { started: true, processed: eligibleDocs.length };
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
  };
}
