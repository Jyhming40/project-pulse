import { AlertTriangle, Clock, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ProjectIssueSummary } from "@/hooks/useProjectIssueSummary";

interface ProjectIssueIndicatorsProps {
  summary: ProjectIssueSummary | null;
  className?: string;
}

/**
 * Displays small icons indicating active issues for a project
 * - 🔴 AlertTriangle = Disputes (爭議)
 * - 🟡 Clock = Delays (延遲)
 * - 🔵 Pencil = Design Changes (設計變更)
 */
export function ProjectIssueIndicators({ summary, className }: ProjectIssueIndicatorsProps) {
  if (!summary || !summary.has_any_issue) {
    return null;
  }

  return (
    <div className={cn("inline-flex items-center gap-1 ml-1.5", className)}>
      {summary.dispute_count > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="w-3 h-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{summary.dispute_count} 項爭議未解決</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      {summary.delay_count > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-warning/15 text-warning">
              <Clock className="w-3 h-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{summary.delay_count} 項延遲未解決</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      {summary.design_change_count > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-info/15 text-info">
              <Pencil className="w-3 h-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{summary.design_change_count} 項設計變更</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
