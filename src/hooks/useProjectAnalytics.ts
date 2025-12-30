import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectAnalytics {
  project_id: string;
  project_code: string;
  project_name: string;
  investor_id: string | null;
  investor_name: string | null;
  investor_code: string | null;
  current_project_status: string;
  construction_status: string | null;
  admin_progress_percent: number;
  engineering_progress_percent: number;
  overall_progress_percent: number;
  admin_stage: string | null;
  engineering_stage: string | null;
  city: string | null;
  district: string | null;
  capacity_kwp: number | null;
  installation_type: string | null;
  grid_connection_type: string | null;
  fiscal_year: number | null;
  intake_year: number | null;
  approval_date: string | null;
  created_at: string;
  updated_at: string;
  has_risk: boolean;
  risk_reasons: string[];
  last_status_changed_at: string | null;
  total_documents: number;
  completed_documents: number;
}

export interface DocumentAnalytics {
  document_id: string;
  project_id: string;
  project_code: string;
  project_name: string;
  document_type: string;
  document_status: string;
  uploaded_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  due_at: string | null;
  is_overdue: boolean;
  is_pending: boolean;
  is_archived: boolean;
  created_by: string | null;
  owner_user_id: string | null;
}

export interface RiskAssessment {
  has_risk: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'none';
  risk_reasons: string[];
}

// Fetch project analytics data
export function useProjectAnalytics(filters?: {
  investor_id?: string;
  status?: string;
  construction_status?: string;
  has_risk?: boolean;
}) {
  return useQuery({
    queryKey: ['project-analytics', filters],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      let url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_analytics_view?select=*`;
      
      if (filters?.investor_id) {
        url += `&investor_id=eq.${filters.investor_id}`;
      }
      if (filters?.status) {
        url += `&current_project_status=eq.${encodeURIComponent(filters.status)}`;
      }
      if (filters?.construction_status) {
        url += `&construction_status=eq.${encodeURIComponent(filters.construction_status)}`;
      }
      if (filters?.has_risk !== undefined) {
        url += `&has_risk=eq.${filters.has_risk}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch project analytics');
      return (await response.json()) as ProjectAnalytics[];
    },
  });
}

// Fetch at-risk projects
export function useRiskProjects(limit: number = 10) {
  return useQuery({
    queryKey: ['risk-projects', limit],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_analytics_view?has_risk=eq.true&select=*&limit=${limit}&order=overall_progress_percent.asc`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch risk projects');
      return (await response.json()) as ProjectAnalytics[];
    },
  });
}

// Fetch document analytics data
export function useDocumentAnalytics(projectId?: string) {
  return useQuery({
    queryKey: ['document-analytics', projectId],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      let url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/document_analytics_view?select=*`;
      
      if (projectId) {
        url += `&project_id=eq.${projectId}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch document analytics');
      return (await response.json()) as DocumentAnalytics[];
    },
  });
}

// Fetch overdue documents
export function useOverdueDocuments(limit: number = 10) {
  return useQuery({
    queryKey: ['overdue-documents', limit],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/document_analytics_view?is_overdue=eq.true&select=*&limit=${limit}`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch overdue documents');
      return (await response.json()) as DocumentAnalytics[];
    },
  });
}

// Get risk assessment for a specific project
export function useProjectRiskAssessment(projectId: string) {
  return useQuery({
    queryKey: ['project-risk', projectId],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // Use REST API to call the function since types aren't generated yet
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/get_project_risk_assessment`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_project_id: projectId }),
        }
      );
      
      if (!response.ok) {
        // If function doesn't exist yet, return default
        return { has_risk: false, risk_level: 'none', risk_reasons: [] } as RiskAssessment;
      }
      
      const data = await response.json();
      return (data?.[0] || { has_risk: false, risk_level: 'none', risk_reasons: [] }) as RiskAssessment;
    },
    enabled: !!projectId,
  });
}

// Summary statistics
export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/project_analytics_view?select=*`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch analytics summary');
      const projects = (await response.json()) as ProjectAnalytics[];
      
      return {
        total_projects: projects.length,
        at_risk_count: projects.filter(p => p.has_risk).length,
        average_progress: projects.length > 0 
          ? Math.round(projects.reduce((sum, p) => sum + p.overall_progress_percent, 0) / projects.length * 10) / 10
          : 0,
        average_admin_progress: projects.length > 0
          ? Math.round(projects.reduce((sum, p) => sum + p.admin_progress_percent, 0) / projects.length * 10) / 10
          : 0,
        average_engineering_progress: projects.length > 0
          ? Math.round(projects.reduce((sum, p) => sum + p.engineering_progress_percent, 0) / projects.length * 10) / 10
          : 0,
        status_distribution: projects.reduce((acc, p) => {
          acc[p.current_project_status] = (acc[p.current_project_status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        construction_status_distribution: projects.reduce((acc, p) => {
          const status = p.construction_status || '未設定';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };
    },
  });
}
