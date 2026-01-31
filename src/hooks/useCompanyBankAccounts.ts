import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CompanyBankAccount {
  id: string;
  bank_code: string;
  bank_name: string;
  bank_branch: string | null;
  bank_account_number: string;
  bank_account_name: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type CompanyBankAccountInput = Omit<CompanyBankAccount, 'id' | 'created_at' | 'updated_at'>;

export function useCompanyBankAccounts() {
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['company-bank-accounts'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('company_bank_accounts')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return (data || []) as CompanyBankAccount[];
    },
  });

  const createAccount = useMutation({
    mutationFn: async (account: CompanyBankAccountInput) => {
      // If this is marked as default, unset other defaults first
      if (account.is_default) {
        await (supabase as any)
          .from('company_bank_accounts')
          .update({ is_default: false })
          .eq('is_default', true);
      }

      const { data, error } = await (supabase as any)
        .from('company_bank_accounts')
        .insert({
          ...account,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as CompanyBankAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-bank-accounts'] });
      toast.success('銀行帳戶已新增');
    },
    onError: (error: any) => {
      console.error('Create failed:', error);
      toast.error(`新增失敗: ${error.message}`);
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompanyBankAccount> & { id: string }) => {
      // If setting as default, unset others first
      if (updates.is_default) {
        await (supabase as any)
          .from('company_bank_accounts')
          .update({ is_default: false })
          .neq('id', id);
      }

      const { data, error } = await (supabase as any)
        .from('company_bank_accounts')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as CompanyBankAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-bank-accounts'] });
      toast.success('銀行帳戶已更新');
    },
    onError: (error: any) => {
      console.error('Update failed:', error);
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('company_bank_accounts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-bank-accounts'] });
      toast.success('銀行帳戶已刪除');
    },
    onError: (error: any) => {
      console.error('Delete failed:', error);
      toast.error(`刪除失敗: ${error.message}`);
    },
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      // Unset all defaults
      await (supabase as any)
        .from('company_bank_accounts')
        .update({ is_default: false })
        .eq('is_default', true);

      // Set this one as default
      const { data, error } = await (supabase as any)
        .from('company_bank_accounts')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as CompanyBankAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-bank-accounts'] });
      toast.success('已設為預設帳戶');
    },
    onError: (error: any) => {
      console.error('Set default failed:', error);
      toast.error(`設定失敗: ${error.message}`);
    },
  });

  const activeAccounts = accounts.filter(a => a.is_active);
  const defaultAccount = accounts.find(a => a.is_default && a.is_active);

  return {
    accounts,
    activeAccounts,
    defaultAccount,
    isLoading,
    error,
    refetch,
    createAccount,
    updateAccount,
    deleteAccount,
    setDefault,
  };
}
