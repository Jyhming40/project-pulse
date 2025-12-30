import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserSecurity {
  id: string;
  user_id: string;
  must_change_password: boolean;
  password_changed_at: string | null;
  password_expires_at: string | null;
}

interface PasswordPolicy {
  password_expires_days: number;
  force_first_login_change: boolean;
}

export function usePasswordPolicy() {
  const { user } = useAuth();

  // Fetch user's security status using raw query
  const { data: securityStatus, isLoading: isLoadingSecurity } = useQuery({
    queryKey: ['user-security', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_security' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching user security:', error);
        return null;
      }
      
      return data as unknown as UserSecurity | null;
    },
    enabled: !!user,
  });

  // Fetch password policy settings
  const { data: policy, isLoading: isLoadingPolicy } = useQuery({
    queryKey: ['password-policy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('progress_settings')
        .select('setting_value')
        .eq('setting_key', 'password_policy')
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching password policy:', error);
        return { password_expires_days: 90, force_first_login_change: true };
      }
      
      const value = data?.setting_value as unknown as PasswordPolicy | null;
      return value || { password_expires_days: 90, force_first_login_change: true };
    },
  });

  // Check if password needs to be changed
  const mustChangePassword = (): boolean => {
    if (!user) return false;
    
    // If no security record exists, assume first login and needs change
    if (!securityStatus) {
      return policy?.force_first_login_change ?? true;
    }
    
    // Check must_change_password flag
    if (securityStatus.must_change_password) {
      return true;
    }
    
    // Check if password has expired
    if (securityStatus.password_expires_at) {
      const expiresAt = new Date(securityStatus.password_expires_at);
      if (expiresAt < new Date()) {
        return true;
      }
    }
    
    return false;
  };

  // Get expiration info
  const getExpirationInfo = () => {
    if (!securityStatus?.password_expires_at) {
      return { isExpired: false, daysRemaining: null, expiresAt: null };
    }
    
    const expiresAt = new Date(securityStatus.password_expires_at);
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      isExpired: daysRemaining < 0,
      daysRemaining,
      expiresAt
    };
  };

  return {
    securityStatus,
    policy,
    isLoading: isLoadingSecurity || isLoadingPolicy,
    mustChangePassword: mustChangePassword(),
    expirationInfo: getExpirationInfo()
  };
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (newPassword: string) => {
      const { data, error } = await supabase.functions.invoke('user-change-password', {
        body: { newPassword }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-security', user?.id] });
    }
  });
}
