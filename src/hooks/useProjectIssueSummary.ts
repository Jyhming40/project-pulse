import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type IssueType = "dispute" | "delay" | "design_change";

export interface ProjectIssueSummary {
  project_id: string;
  dispute_count: number;
  delay_count: number;
  design_change_count: number;
  total_count: number;
  has_any_issue: boolean;
}

/**
 * Hook to fetch unresolved issue counts per project
 * Returns a map of project_id -> issue summary
 */
export function useProjectIssueSummary(projectIds?: string[]) {
  const { user } = useAuth();

  const { data: issueSummaryMap = {}, isLoading } = useQuery({
    queryKey: ["project-issue-summary", projectIds?.length],
    queryFn: async () => {
      // Fetch all unresolved issues grouped by project and type
      const { data, error } = await supabase
        .from("project_issues")
        .select("project_id, issue_type")
        .eq("is_resolved", false);

      if (error) {
        console.error("Failed to fetch project issue summary:", error);
        return {};
      }

      // Aggregate counts per project
      const summaryMap: Record<string, ProjectIssueSummary> = {};

      for (const row of data || []) {
        const projectId = row.project_id;
        if (!summaryMap[projectId]) {
          summaryMap[projectId] = {
            project_id: projectId,
            dispute_count: 0,
            delay_count: 0,
            design_change_count: 0,
            total_count: 0,
            has_any_issue: false,
          };
        }

        const issueType = row.issue_type as IssueType;
        if (issueType === "dispute") {
          summaryMap[projectId].dispute_count++;
        } else if (issueType === "delay") {
          summaryMap[projectId].delay_count++;
        } else if (issueType === "design_change") {
          summaryMap[projectId].design_change_count++;
        }
        summaryMap[projectId].total_count++;
        summaryMap[projectId].has_any_issue = true;
      }

      return summaryMap;
    },
    enabled: !!user,
    staleTime: 30000, // Cache for 30 seconds
  });

  return {
    issueSummaryMap,
    isLoading,
    getIssueSummary: (projectId: string): ProjectIssueSummary | null => 
      issueSummaryMap[projectId] || null,
  };
}
