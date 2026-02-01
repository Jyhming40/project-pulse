import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TrendingUp,
  AlertTriangle,
  Wallet,
  FileText,
  Gavel,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";

interface ProjectCommandCenterProps {
  projectId: string;
  project: {
    status?: string;
    construction_status?: string;
    admin_progress?: number;
    engineering_progress?: number;
    overall_progress?: number;
  };
  onModuleClick?: (module: "progress" | "risk" | "finance" | "documents" | "disputes") => void;
}

interface ModuleCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  status: "success" | "warning" | "danger" | "neutral";
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

const statusColors = {
  success: "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20",
  warning: "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20",
  danger: "border-red-500/50 bg-red-50/50 dark:bg-red-950/20",
  neutral: "border-border bg-muted/30",
};

const statusIconColors = {
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  neutral: "text-muted-foreground",
};

function ModuleCard({ icon, label, value, status, subtitle, onClick, className }: ModuleCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] border-2",
        statusColors[status],
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className={cn("p-2 rounded-lg bg-background/50", statusIconColors[status])}>
            {icon}
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold">{value}</div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectCommandCenter({
  projectId,
  project,
  onModuleClick,
}: ProjectCommandCenterProps) {
  // Fetch documents count
  const { data: documentsStats } = useQuery({
    queryKey: ["project-documents-stats", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, doc_status, submitted_at, issued_at")
        .eq("project_id", projectId)
        .eq("is_deleted", false);

      if (error) throw error;

      const total = data?.length || 0;
      const completed = data?.filter((d) => d.issued_at).length || 0;
      const pending = data?.filter((d) => d.submitted_at && !d.issued_at).length || 0;

      return { total, completed, pending };
    },
  });

  // Fetch issues count
  const { data: issuesStats } = useQuery({
    queryKey: ["project-issues-stats", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_issues")
        .select("id, issue_type, severity, is_resolved")
        .eq("project_id", projectId);

      if (error) throw error;

      const total = data?.length || 0;
      const active = data?.filter((i) => !i.is_resolved).length || 0;
      const disputes = data?.filter((i) => i.issue_type === "dispute").length || 0;
      const highSeverity = data?.filter((i) => i.severity === "high" && !i.is_resolved).length || 0;

      return { total, active, disputes, highSeverity };
    },
  });

  // Fetch related quote for finance info
  const { data: quoteStats } = useQuery({
    queryKey: ["project-quote-stats", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_quotes")
        .select("id, capacity_kwp, total_price_with_tax, irr_20_year, payback_years, is_finalized")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Calculate progress status
  const overallProgress = project.overall_progress || 0;
  const progressStatus =
    overallProgress >= 100
      ? "success"
      : overallProgress >= 50
      ? "warning"
      : "neutral";

  // Calculate risk status based on issues
  const activeIssues = issuesStats?.active || 0;
  const highSeverityIssues = issuesStats?.highSeverity || 0;
  const riskStatus =
    highSeverityIssues > 0
      ? "danger"
      : activeIssues > 0
      ? "warning"
      : "success";

  // Calculate documents status
  const docCompleted = documentsStats?.completed || 0;
  const docTotal = documentsStats?.total || 0;
  const docPending = documentsStats?.pending || 0;
  const docStatus =
    docTotal === 0
      ? "neutral"
      : docCompleted === docTotal
      ? "success"
      : docPending > 3
      ? "warning"
      : "neutral";

  // Calculate disputes status
  const disputeCount = issuesStats?.disputes || 0;
  const disputeStatus =
    disputeCount === 0 ? "success" : disputeCount > 2 ? "danger" : "warning";

  // Calculate finance status
  const hasQuote = !!quoteStats;
  const irr = quoteStats?.irr_20_year || 0;
  const financeStatus = !hasQuote ? "neutral" : irr >= 8 ? "success" : irr >= 5 ? "warning" : "danger";

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            專案指揮中心
          </h2>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 進度模組 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ModuleCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="進度"
                  value={
                    <div className="flex items-center gap-2">
                      <span>{Math.round(overallProgress)}%</span>
                      <Progress value={overallProgress} className="w-16 h-2" />
                    </div>
                  }
                  status={progressStatus}
                  subtitle={`行政 ${Math.round(project.admin_progress || 0)}% / 工程 ${Math.round(project.engineering_progress || 0)}%`}
                  onClick={() => onModuleClick?.("progress")}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>查看行政流程與工程進度詳情</p>
            </TooltipContent>
          </Tooltip>

          {/* 風險模組 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ModuleCard
                  icon={<AlertTriangle className="w-5 h-5" />}
                  label="風險"
                  value={
                    activeIssues === 0 ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-emerald-600">無待處理</span>
                      </div>
                    ) : (
                      <span>{activeIssues} 項待處理</span>
                    )
                  }
                  status={riskStatus}
                  subtitle={
                    highSeverityIssues > 0
                      ? `⚠️ ${highSeverityIssues} 項高風險`
                      : activeIssues > 0
                      ? "點擊查看詳情"
                      : "暫無風險項目"
                  }
                  onClick={() => onModuleClick?.("risk")}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>查看延遲、設計變更等風險項目</p>
            </TooltipContent>
          </Tooltip>

          {/* 財務模組 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ModuleCard
                  icon={<Wallet className="w-5 h-5" />}
                  label="財務"
                  value={
                    hasQuote ? (
                      <span>IRR {irr.toFixed(1)}%</span>
                    ) : (
                      <span className="text-muted-foreground text-lg">未報價</span>
                    )
                  }
                  status={financeStatus}
                  subtitle={
                    hasQuote
                      ? `回本 ${quoteStats?.payback_years?.toFixed(1) || "-"} 年`
                      : "建立報價以分析投資"
                  }
                  onClick={() => onModuleClick?.("finance")}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>查看報價與投資分析</p>
            </TooltipContent>
          </Tooltip>

          {/* 文件模組 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ModuleCard
                  icon={<FileText className="w-5 h-5" />}
                  label="文件"
                  value={
                    <span>
                      {docCompleted}/{docTotal} 完成
                    </span>
                  }
                  status={docStatus}
                  subtitle={
                    docPending > 0
                      ? `${docPending} 份待核發`
                      : docTotal === 0
                      ? "尚無文件記錄"
                      : "文件進度正常"
                  }
                  onClick={() => onModuleClick?.("documents")}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>查看送審文件與核發進度</p>
            </TooltipContent>
          </Tooltip>

          {/* 爭議模組 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ModuleCard
                  icon={<Gavel className="w-5 h-5" />}
                  label="爭議"
                  value={
                    disputeCount === 0 ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-emerald-600">無爭議</span>
                      </div>
                    ) : (
                      <span>{disputeCount} 項記錄</span>
                    )
                  }
                  status={disputeStatus}
                  subtitle={
                    disputeCount > 0 ? "點擊管理爭議紀錄" : "暫無爭議事項"
                  }
                  onClick={() => onModuleClick?.("disputes")}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>管理爭議、訴訟與責任歸屬</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
