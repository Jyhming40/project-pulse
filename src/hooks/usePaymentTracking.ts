import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PaymentMilestone {
  id: string;
  payment_code: string;
  payment_name: string;
  description: string | null;
  sort_order: number;
  default_percentage: number;
  trigger_milestone_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectPayment {
  id: string;
  project_id: string;
  payment_code: string;
  payment_status: 'pending' | 'invoiced' | 'partial' | 'paid' | 'waived';
  contract_amount: number | null;
  invoiced_amount: number | null;
  paid_amount: number | null;
  invoiced_at: string | null;
  paid_at: string | null;
  invoice_number: string | null;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus = ProjectPayment['payment_status'];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: '待請款',
  invoiced: '已開票',
  partial: '部分收款',
  paid: '已收款',
  waived: '免收',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  invoiced: 'bg-info/10 text-info',
  partial: 'bg-warning/10 text-warning',
  paid: 'bg-success/10 text-success',
  waived: 'bg-secondary text-secondary-foreground',
};

// Fetch all payment milestones
export function usePaymentMilestones() {
  return useQuery({
    queryKey: ['payment-milestones'],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/payment_milestones?is_active=eq.true&order=sort_order.asc`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch payment milestones');
      return (await response.json()) as PaymentMilestone[];
    },
  });
}

// Fetch project payments for a specific project
export function useProjectPayments(projectId: string) {
  return useQuery({
    queryKey: ['project-payments', projectId],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_payments?project_id=eq.${projectId}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch project payments');
      return (await response.json()) as ProjectPayment[];
    },
    enabled: !!projectId,
  });
}

// Fetch payment summary across all projects
export function usePaymentSummary() {
  return useQuery({
    queryKey: ['payment-summary'],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_payments?select=payment_code,payment_status,contract_amount,paid_amount`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch payment summary');
      
      const payments = (await response.json()) as ProjectPayment[];
      
      // Calculate summary
      const summary = {
        totalPending: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        pendingCount: 0,
        invoicedCount: 0,
        paidCount: 0,
        byStage: {} as Record<string, { pending: number; invoiced: number; paid: number; count: number }>,
      };
      
      payments.forEach(p => {
        const amount = p.contract_amount || 0;
        const paid = p.paid_amount || 0;
        
        if (!summary.byStage[p.payment_code]) {
          summary.byStage[p.payment_code] = { pending: 0, invoiced: 0, paid: 0, count: 0 };
        }
        summary.byStage[p.payment_code].count++;
        
        switch (p.payment_status) {
          case 'pending':
            summary.totalPending += amount;
            summary.pendingCount++;
            summary.byStage[p.payment_code].pending += amount;
            break;
          case 'invoiced':
            summary.totalInvoiced += amount;
            summary.invoicedCount++;
            summary.byStage[p.payment_code].invoiced += amount;
            break;
          case 'partial':
            summary.totalInvoiced += amount - paid;
            summary.totalPaid += paid;
            summary.invoicedCount++;
            summary.byStage[p.payment_code].invoiced += amount - paid;
            summary.byStage[p.payment_code].paid += paid;
            break;
          case 'paid':
            summary.totalPaid += paid;
            summary.paidCount++;
            summary.byStage[p.payment_code].paid += paid;
            break;
        }
      });
      
      return summary;
    },
  });
}

// Update or create project payment
export function useUpdateProjectPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      projectId,
      paymentCode,
      updates,
    }: {
      projectId: string;
      paymentCode: string;
      updates: Partial<ProjectPayment>;
    }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // Check if record exists
      const checkResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_payments?project_id=eq.${projectId}&payment_code=eq.${paymentCode}&select=id`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      const existing = await checkResponse.json();

      if (existing && existing.length > 0) {
        // Update existing
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_payments?id=eq.${existing[0].id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            },
            body: JSON.stringify({
              ...updates,
              updated_by: session.data.session?.user?.id,
            }),
          }
        );
        if (!response.ok) throw new Error('Failed to update payment');
        return (await response.json())[0] as ProjectPayment;
      } else {
        // Insert new
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_payments`,
          {
            method: 'POST',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            },
            body: JSON.stringify({
              project_id: projectId,
              payment_code: paymentCode,
              ...updates,
              created_by: session.data.session?.user?.id,
              updated_by: session.data.session?.user?.id,
            }),
          }
        );
        if (!response.ok) throw new Error('Failed to create payment');
        return (await response.json())[0] as ProjectPayment;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-payments', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] });
      toast({ title: '付款狀態已更新' });
    },
    onError: (error: Error) => {
      toast({ title: '更新失敗', description: error.message, variant: 'destructive' });
    },
  });
}

// Batch initialize payments for a project
export function useInitializeProjectPayments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      projectId,
      contractTotal,
    }: {
      projectId: string;
      contractTotal: number;
    }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // Fetch payment milestones
      const milestonesResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/payment_milestones?is_active=eq.true&order=sort_order.asc`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      const milestones = (await milestonesResponse.json()) as PaymentMilestone[];
      
      // Create payment records for each milestone
      const payments = milestones.map(m => ({
        project_id: projectId,
        payment_code: m.payment_code,
        payment_status: 'pending',
        contract_amount: contractTotal * (m.default_percentage / 100),
        created_by: session.data.session?.user?.id,
      }));
      
      // Upsert payments
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_payments`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation,resolution=merge-duplicates',
          },
          body: JSON.stringify(payments),
        }
      );
      if (!response.ok) throw new Error('Failed to initialize payments');
      return (await response.json()) as ProjectPayment[];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-payments', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] });
      toast({ title: '付款階段已初始化' });
    },
    onError: (error: Error) => {
      toast({ title: '初始化失敗', description: error.message, variant: 'destructive' });
    },
  });
}
