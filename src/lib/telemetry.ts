/**
 * Telemetry Client for User Experience Tracking
 * 
 * This module provides lightweight telemetry for debugging and UX improvement.
 * It is separate from audit_logs (data change auditing).
 */

import { supabase } from '@/integrations/supabase/client';

// ==========================================
// Types
// ==========================================
export type EventType = 'page_view' | 'action' | 'error';

export interface TelemetryEvent {
  event_type: EventType;
  event_name: string;
  path?: string;
  workspace?: string | null;
  metadata?: Record<string, unknown>;
}

// ==========================================
// Session Management
// ==========================================
const SESSION_KEY = 'pulse-telemetry-session';

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

// ==========================================
// Core Telemetry Functions
// ==========================================

/**
 * Track an event to the telemetry system
 * Non-blocking: errors are logged but don't affect app functionality
 */
export async function trackEvent(event: TelemetryEvent): Promise<void> {
  try {
    const sessionId = getSessionId();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Sanitize metadata - remove any potentially sensitive fields
    const sanitizedMetadata = sanitizeMetadata(event.metadata);
    
    // Use type assertion since user_events table may not be in generated types yet
    const { error } = await (supabase as any).from('user_events').insert({
      session_id: sessionId,
      user_id: user?.id || null,
      event_type: event.event_type,
      event_name: event.event_name,
      path: event.path || window.location.pathname,
      workspace: event.workspace || getCurrentWorkspace(),
      metadata: sanitizedMetadata,
    });
    
    if (error) {
      // Silent fail in production, log in development
      if (import.meta.env.DEV) {
        console.warn('[Telemetry] Failed to track event:', error.message);
      }
    }
  } catch (err) {
    // Never throw - telemetry should not break the app
    if (import.meta.env.DEV) {
      console.warn('[Telemetry] Error:', err);
    }
  }
}

/**
 * Track a page view
 */
export function trackPageView(path: string, workspace?: string | null): void {
  trackEvent({
    event_type: 'page_view',
    event_name: 'page_view',
    path,
    workspace,
  });
}

/**
 * Track a user action
 */
export function trackAction(
  actionName: string, 
  metadata?: Record<string, unknown>
): void {
  trackEvent({
    event_type: 'action',
    event_name: actionName,
    metadata,
  });
}

/**
 * Track an error
 */
export function trackError(
  errorName: string,
  error: Error | unknown,
  additionalInfo?: Record<string, unknown>
): void {
  const errorDetails = error instanceof Error
    ? {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines only
      }
    : { message: String(error) };

  trackEvent({
    event_type: 'error',
    event_name: errorName,
    metadata: {
      ...errorDetails,
      ...additionalInfo,
    },
  });
}

/**
 * Track an API error
 */
export function trackApiError(
  endpoint: string,
  status: number,
  message?: string
): void {
  trackEvent({
    event_type: 'error',
    event_name: 'api_error',
    metadata: {
      endpoint,
      status,
      message: message?.substring(0, 200), // Truncate long messages
    },
  });
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Get current workspace from URL
 */
function getCurrentWorkspace(): string | null {
  const match = window.location.pathname.match(/^\/w\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Sanitize metadata to remove sensitive information
 */
function sanitizeMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  
  // Fields that should never be logged
  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'auth',
    'credit_card', 'ssn', 'phone', 'email', 'address',
    'content', 'body', 'document', 'file_content',
    'personal', 'private', 'tax_id', 'bank_account',
  ];
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    const keyLower = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sk => keyLower.includes(sk));
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 500) {
      // Truncate long strings
      sanitized[key] = value.substring(0, 500) + '...';
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects (one level deep)
      sanitized[key] = '[object]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// ==========================================
// Global Error Handler Setup
// ==========================================

let isErrorHandlerInstalled = false;

export function installGlobalErrorHandler(): void {
  if (isErrorHandlerInstalled) return;
  isErrorHandlerInstalled = true;
  
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    trackError('uncaught_error', event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    trackError('unhandled_rejection', event.reason);
  });
}
