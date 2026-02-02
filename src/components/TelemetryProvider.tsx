/**
 * Telemetry Provider Component
 * 
 * Wraps the app to provide automatic telemetry tracking for:
 * - Page views on route changes
 * - Global error handling
 */

import { ReactNode } from 'react';
import { usePageViewTracking, useGlobalErrorTracking } from '@/hooks/useTelemetry';

interface TelemetryProviderProps {
  children: ReactNode;
}

function TelemetryTracking() {
  usePageViewTracking();
  useGlobalErrorTracking();
  return null;
}

export function TelemetryProvider({ children }: TelemetryProviderProps) {
  return (
    <>
      <TelemetryTracking />
      {children}
    </>
  );
}
