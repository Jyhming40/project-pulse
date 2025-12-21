import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DriveTokenInfo {
  google_email: string | null;
  google_error: string | null;
  updated_at: string | null;
}

export function useDriveAuth() {
  const { user } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<DriveTokenInfo | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check if user has authorized Google Drive
  const checkAuthorization = useCallback(async () => {
    if (!user) {
      setIsAuthorized(false);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_drive_tokens')
        .select('id, google_email, google_error, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking drive auth:', error);
        setIsAuthorized(false);
      } else {
        setIsAuthorized(!!data);
        if (data) {
          setTokenInfo({
            google_email: (data as any).google_email,
            google_error: (data as any).google_error,
            updated_at: data.updated_at,
          });
        }
      }
    } catch (err) {
      console.error('Error checking drive auth:', err);
      setIsAuthorized(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Check on mount and when user changes
  useEffect(() => {
    checkAuthorization();
  }, [checkAuthorization]);

  // Check URL for drive_auth result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('drive_auth');
    
    if (authResult === 'success') {
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      setAuthError(null);
      // Refresh authorization status
      checkAuthorization();
    } else if (authResult === 'error') {
      const error = params.get('error');
      setAuthError(error || '授權失敗');
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [checkAuthorization]);

  // Start OAuth flow
  const authorize = useCallback(async () => {
    if (!user) return;

    setIsAuthorizing(true);
    setAuthError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('drive-auth-url', {
        body: {
          userId: user.id,
          redirectUrl: window.location.href.split('?')[0],
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.authUrl) throw new Error('未取得授權網址');

      // Store callback URL for display
      if (data.callbackUrl) {
        setCallbackUrl(data.callbackUrl);
      }

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('Error starting OAuth:', err);
      setAuthError((err as Error).message);
      setIsAuthorizing(false);
      throw err;
    }
  }, [user]);

  // Revoke authorization (delete tokens)
  const revoke = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_drive_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      setIsAuthorized(false);
      setTokenInfo(null);
      setAuthError(null);
    } catch (err) {
      console.error('Error revoking authorization:', err);
      throw err;
    }
  }, [user]);

  // Test connection
  const testConnection = useCallback(async () => {
    if (!user) throw new Error('未登入');

    const { data, error } = await supabase.functions.invoke('drive-test-connection', {
      body: { userId: user.id },
    });

    if (error) throw new Error(error.message);
    return data;
  }, [user]);

  // Get the expected callback URL
  const getCallbackUrl = useCallback(() => {
    return `https://mcvgtsoheayabjpdplcr.supabase.co/functions/v1/drive-auth-callback`;
  }, []);

  return {
    isAuthorized,
    isLoading,
    isAuthorizing,
    authorize,
    revoke,
    checkAuthorization,
    testConnection,
    callbackUrl: callbackUrl || getCallbackUrl(),
    tokenInfo,
    authError,
    clearError: () => setAuthError(null),
  };
}
