import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Issue types supported by the project_issues table
export type IssueType = "dispute" | "delay" | "design_change";
export type IssueSeverity = "low" | "medium" | "high";

export interface ProjectIssue {
  id: string;
  project_id: string;
  issue_type: IssueType;
  title: string;
  description?: string;
  severity: IssueSeverity;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  stage_id?: string;
  evidence_document_id?: string;
  is_resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  // Joined data
  stage_name?: string;
  evidence_document_title?: string;
}

export interface CreateIssueInput {
  project_id: string;
  issue_type: IssueType;
  title: string;
  description?: string;
  severity: IssueSeverity;
  start_date: string;
  end_date: string;
  stage_id?: string;
  evidence_document_id?: string;
}

export interface UpdateIssueInput {
  issue_type?: IssueType;
  title?: string;
  description?: string;
  severity?: IssueSeverity;
  start_date?: string;
  end_date?: string;
  stage_id?: string;
  evidence_document_id?: string;
  is_resolved?: boolean;
}

// Issue type label mapping
export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  dispute: "爭議",
  delay: "延遲",
  design_change: "設計變更",
};

// Issue type color mapping
export const ISSUE_TYPE_COLORS: Record<IssueType, string> = {
  dispute: "bg-destructive/15 text-destructive",
  delay: "bg-warning/15 text-warning",
  design_change: "bg-info/15 text-info",
};

// Severity label mapping
export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

// Severity color mapping
export const SEVERITY_COLORS: Record<IssueSeverity, string> = {
  low: "bg-success/15 text-success",
  medium: "bg-warning/15 text-warning",
  high: "bg-destructive/15 text-destructive",
};

export function useProjectIssues(projectId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch issues for a specific project or all issues
  const { data: issues = [], isLoading, refetch } = useQuery({
    queryKey: ["project-issues", projectId],
    queryFn: async () => {
      let query = supabase
        .from("project_issues")
        .select(`
          *,
          process_stages:stage_id(name),
          documents:evidence_document_id(title)
        `)
        .order("created_at", { ascending: false });

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to fetch project issues:", error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        project_id: row.project_id,
        issue_type: row.issue_type as IssueType,
        title: row.title,
        description: row.description || undefined,
        severity: row.severity as IssueSeverity,
        start_date: row.start_date,
        end_date: row.end_date,
        stage_id: row.stage_id || undefined,
        evidence_document_id: row.evidence_document_id || undefined,
        is_resolved: row.is_resolved || false,
        resolved_at: row.resolved_at || undefined,
        resolved_by: row.resolved_by || undefined,
        created_by: row.created_by || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
        stage_name: row.process_stages?.name || undefined,
        evidence_document_title: row.documents?.title || undefined,
      })) as ProjectIssue[];
    },
    enabled: !!user,
  });

  // Create issue mutation
  const createMutation = useMutation({
    mutationFn: async (input: CreateIssueInput) => {
      const { data, error } = await supabase
        .from("project_issues")
        .insert({
          project_id: input.project_id,
          issue_type: input.issue_type,
          title: input.title,
          description: input.description || null,
          severity: input.severity,
          start_date: input.start_date,
          end_date: input.end_date,
          stage_id: input.stage_id || null,
          evidence_document_id: input.evidence_document_id || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-issues"] });
      toast.success("問題已新增");
    },
    onError: (error) => {
      console.error("Failed to create issue:", error);
      toast.error("新增問題失敗");
    },
  });

  // Update issue mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateIssueInput }) => {
      const updateData: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Handle resolved state
      if (updates.is_resolved === true) {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = user?.id;
      } else if (updates.is_resolved === false) {
        updateData.resolved_at = null;
        updateData.resolved_by = null;
      }

      const { data, error } = await supabase
        .from("project_issues")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-issues"] });
      toast.success("問題已更新");
    },
    onError: (error) => {
      console.error("Failed to update issue:", error);
      toast.error("更新問題失敗");
    },
  });

  // Delete issue mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_issues")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-issues"] });
      toast.success("問題已刪除");
    },
    onError: (error) => {
      console.error("Failed to delete issue:", error);
      toast.error("刪除問題失敗");
    },
  });

  // Resolve/unresolve issue
  const toggleResolved = async (id: string, resolved: boolean) => {
    return updateMutation.mutateAsync({ id, updates: { is_resolved: resolved } });
  };

  // Statistics
  const stats = {
    total: issues.length,
    resolved: issues.filter((i) => i.is_resolved).length,
    unresolved: issues.filter((i) => !i.is_resolved).length,
    byType: {
      dispute: issues.filter((i) => i.issue_type === "dispute").length,
      delay: issues.filter((i) => i.issue_type === "delay").length,
      design_change: issues.filter((i) => i.issue_type === "design_change").length,
    },
    bySeverity: {
      high: issues.filter((i) => i.severity === "high").length,
      medium: issues.filter((i) => i.severity === "medium").length,
      low: issues.filter((i) => i.severity === "low").length,
    },
  };

  return {
    issues,
    stats,
    isLoading,
    refetch,
    createIssue: createMutation.mutateAsync,
    updateIssue: (id: string, updates: UpdateIssueInput) =>
      updateMutation.mutateAsync({ id, updates }),
    deleteIssue: deleteMutation.mutateAsync,
    toggleResolved,
    isSaving:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending,
  };
}
