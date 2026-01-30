import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AIHealthResult {
  provider: string;
  status: "healthy" | "error" | "no_key" | "quota_exceeded";
  message: string;
  responseTime?: number;
}

interface HealthCheckResponse {
  success: boolean;
  results?: AIHealthResult[];
  error?: string;
}

export function useAIHealthCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<AIHealthResult[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async (provider?: string) => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-ai-health', {
        body: { provider },
      });

      if (error) {
        console.error('Health check error:', error);
        return;
      }

      const response = data as HealthCheckResponse;
      if (response.success && response.results) {
        setResults(response.results);
        setLastChecked(new Date());
      }
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const getStatusForProvider = useCallback((provider: string): AIHealthResult | undefined => {
    return results.find(r => r.provider === provider);
  }, [results]);

  return {
    isChecking,
    results,
    lastChecked,
    checkHealth,
    getStatusForProvider,
  };
}
