import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useDriveAuth() {
  const { user } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

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
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking drive auth:', error);
        setIsAuthorized(false);
      } else {
        setIsAuthorized(!!data);
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

  // Check URL for drive_auth success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('drive_auth') === 'success') {
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      // Refresh authorization status
      checkAuthorization();
    }
  }, [checkAuthorization]);

  // Start OAuth flow
  const authorize = useCallback(async () => {
    if (!user) return;

    setIsAuthorizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('drive-auth-url', {
        body: {
          userId: user.id,
          redirectUrl: window.location.href.split('?')[0], // Current page without query params
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.authUrl) throw new Error('未取得授權網址');

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('Error starting OAuth:', err);
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
    } catch (err) {
      console.error('Error revoking authorization:', err);
      throw err;
    }
  }, [user]);

  return {
    isAuthorized,
    isLoading,
    isAuthorizing,
    authorize,
    revoke,
    checkAuthorization,
  };
}
