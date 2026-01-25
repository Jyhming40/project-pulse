import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, Pencil, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

interface IssueStats {
  total: number;
  unresolved: number;
  resolved: number;
  byType: {
    dispute: number;
    delay: number;
    design_change: number;
  };
  bySeverity: {
    high: number;
    medium: number;
    low: number;
  };
}

export function IssuesSummarySection() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-issue-stats"],
    queryFn: async (): Promise<IssueStats> => {
      const { data, error } = await supabase
        .from("project_issues")
        .select("issue_type, severity, is_resolved");

      if (error) throw error;

      const issues = data || [];
      
      return {
        total: issues.length,
        unresolved: issues.filter(i => !i.is_resolved).length,
        resolved: issues.filter(i => i.is_resolved).length,
        byType: {
          dispute: issues.filter(i => i.issue_type === "dispute" && !i.is_resolved).length,
          delay: issues.filter(i => i.issue_type === "delay" && !i.is_resolved).length,
          design_change: issues.filter(i => i.issue_type === "design_change" && !i.is_resolved).length,
        },
        bySeverity: {
          high: issues.filter(i => i.severity === "high" && !i.is_resolved).length,
          medium: issues.filter(i => i.severity === "medium" && !i.is_resolved).length,
          low: issues.filter(i => i.severity === "low" && !i.is_resolved).length,
        },
      };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasUnresolvedIssues = stats && stats.unresolved > 0;

  return (
    <Card className={hasUnresolvedIssues ? "border-warning/50" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            問題追蹤
          </CardTitle>
          {stats && stats.unresolved > 0 && (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
              {stats.unresolved} 項待處理
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Disputes */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">爭議</span>
            </div>
            <span className="text-2xl font-bold mt-1">{stats?.byType.dispute ?? 0}</span>
          </div>

          {/* Delays */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-warning/5 border border-warning/20">
            <div className="flex items-center gap-1.5 text-warning">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">延遲</span>
            </div>
            <span className="text-2xl font-bold mt-1">{stats?.byType.delay ?? 0}</span>
          </div>

          {/* Design Changes */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-info/5 border border-info/20">
            <div className="flex items-center gap-1.5 text-info">
              <Pencil className="w-4 h-4" />
              <span className="text-sm font-medium">設計變更</span>
            </div>
            <span className="text-2xl font-bold mt-1">{stats?.byType.design_change ?? 0}</span>
          </div>
        </div>

        {/* Severity breakdown for unresolved issues */}
        {stats && stats.unresolved > 0 && (
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">按嚴重度：</span>
              <div className="flex items-center gap-3">
                {stats.bySeverity.high > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    高 <strong>{stats.bySeverity.high}</strong>
                  </span>
                )}
                {stats.bySeverity.medium > 0 && (
                  <span className="flex items-center gap-1 text-warning">
                    中 <strong>{stats.bySeverity.medium}</strong>
                  </span>
                )}
                {stats.bySeverity.low > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    低 <strong>{stats.bySeverity.low}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* All resolved message */}
        {stats && stats.unresolved === 0 && stats.total > 0 && (
          <div className="mt-4 pt-3 border-t flex items-center justify-center gap-2 text-sm text-success">
            <CheckCircle2 className="w-4 h-4" />
            全部問題已解決
          </div>
        )}

        {/* No issues at all */}
        {stats && stats.total === 0 && (
          <div className="mt-4 pt-3 border-t text-center text-sm text-muted-foreground">
            目前沒有記錄的問題
          </div>
        )}
      </CardContent>
    </Card>
  );
}
