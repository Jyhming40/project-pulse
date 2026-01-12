import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  FileWarning,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Building2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Filter,
  Download,
  Search,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Required document types for each project status
const REQUIRED_DOCS_BY_STATUS: Record<string, string[]> = {
  '台電送件': ['TPC_REVIEW'],
  '台電審查': ['TPC_REVIEW', 'TPC_NEGOTIATION'],
  '同意備案': ['TPC_REVIEW', 'TPC_NEGOTIATION', 'TPC_APPROVED_DRAWING', 'MOEA_CONSENT'],
  '報竣掛表': ['TPC_REVIEW', 'TPC_NEGOTIATION', 'TPC_APPROVED_DRAWING', 'MOEA_CONSENT', 'TPC_INSPECTION', 'TPC_CONTRACT', 'TPC_FORMAL_FIT', 'TPC_METER'],
  '設備登記': ['TPC_REVIEW', 'TPC_NEGOTIATION', 'TPC_APPROVED_DRAWING', 'MOEA_CONSENT', 'TPC_INSPECTION', 'TPC_CONTRACT', 'TPC_FORMAL_FIT', 'TPC_METER', 'MOEA_REGISTER'],
};

// All trackable document types with labels
const DOC_TYPE_LABELS: Record<string, string> = {
  'TPC_REVIEW': '審查意見書',
  'TPC_NEGOTIATION': '細部協商',
  'TPC_APPROVED_DRAWING': '審訖圖',
  'TPC_INSPECTION': '派員訪查併聯函',
  'TPC_METER_LEASE': '電表租約',
  'TPC_LINE_COMP': '線補費通知單/收據',
  'TPC_CONTRACT': '躉售合約',
  'TPC_FORMAL_FIT': '正式躉售',
  'TPC_METER': '報竣掛表',
  'TPC_AMENDMENT': '換文修約',
  'MOEA_CONSENT': '同意備案',
  'MOEA_REGISTER': '設備登記',
  'BUILD_EXEMPT_APP': '免雜項申請',
  'BUILD_EXEMPT_COMP': '免雜項竣工',
};

// Status priority for sorting (higher = more urgent)
const STATUS_PRIORITY: Record<string, number> = {
  '取消': 0,
  '暫停': 1,
  '無饋線': 2,
  '開發中': 3,
  '台電送件': 4,
  '台電審查': 5,
  '同意備案': 6,
  '報竣掛表': 7,
  '設備登記': 8,
};

interface ProjectWithGaps {
  id: string;
  project_code: string;
  project_name: string;
  status: string;
  investor_name: string | null;
  overall_progress: number | null;
  required_docs: string[];
  existing_docs: string[];
  missing_docs: string[];
  completion_rate: number;
}

export default function DocumentGapAnalysis() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [investorFilter, setInvestorFilter] = useState<string>('all');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showOnlyWithGaps, setShowOnlyWithGaps] = useState(true);

  // Fetch projects with their documents
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['document-gap-analysis'],
    queryFn: async () => {
      // Fetch active projects (exclude cancelled/paused)
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, project_code, project_name, status, overall_progress, investors(company_name)')
        .eq('is_deleted', false)
        .not('status', 'in', '(\\\"取消\\\",\\\"暫停\\\",\\\"無饋線\\\",\\\"開發中\\\")')
        .order('project_code');
      
      if (projectsError) throw projectsError;

      // Fetch all documents with doc_type_code
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('id, project_id, doc_type_code, doc_type, doc_status, issued_at')
        .eq('is_deleted', false);
      
      if (docsError) throw docsError;

      // Build a map of project_id -> existing doc_type_codes (with issued_at = completed)
      const projectDocsMap = new Map<string, Set<string>>();
      
      for (const doc of documents || []) {
        if (!doc.project_id) continue;
        
        // Consider doc as \"complete\" if it has issued_at OR doc_status is not draft
        const isComplete = doc.issued_at || doc.doc_status !== 'draft';
        if (!isComplete) continue;

        let docCode = doc.doc_type_code;
        
        // Map old doc_type to new codes for legacy data
        if (!docCode && doc.doc_type) {
          const typeMap: Record<string, string> = {
            '審查意見書': 'TPC_REVIEW',
            '細部協商': 'TPC_NEGOTIATION',
            '審訖圖': 'TPC_APPROVED_DRAWING',
            '派員訪查併聯函': 'TPC_INSPECTION',
            '電表租約': 'TPC_METER_LEASE',
            '線補費通知單/收據': 'TPC_LINE_COMP',
            '躉售合約': 'TPC_CONTRACT',
            '正式躉售': 'TPC_FORMAL_FIT',
            '報竣掛表': 'TPC_METER',
            '換文修約': 'TPC_AMENDMENT',
            '同意備案': 'MOEA_CONSENT',
            '設備登記': 'MOEA_REGISTER',
            '免雜項申請': 'BUILD_EXEMPT_APP',
            '免雜項竣工': 'BUILD_EXEMPT_COMP',
          };
          docCode = typeMap[doc.doc_type] || null;
        }

        if (docCode) {
          if (!projectDocsMap.has(doc.project_id)) {
            projectDocsMap.set(doc.project_id, new Set());
          }
          projectDocsMap.get(doc.project_id)!.add(docCode);
        }
      }

      // Calculate gaps for each project
      const projectsWithGaps: ProjectWithGaps[] = (projects || []).map(project => {
        const investor = project.investors as any;
        const existingDocs = projectDocsMap.get(project.id) || new Set<string>();
        const requiredDocs = REQUIRED_DOCS_BY_STATUS[project.status] || [];
        const missingDocs = requiredDocs.filter(doc => !existingDocs.has(doc));
        const completionRate = requiredDocs.length > 0 
          ? Math.round(((requiredDocs.length - missingDocs.length) / requiredDocs.length) * 100)
          : 100;

        return {
          id: project.id,
          project_code: project.project_code,
          project_name: project.project_name,
          status: project.status,
          investor_name: investor?.company_name || null,
          overall_progress: project.overall_progress,
          required_docs: requiredDocs,
          existing_docs: Array.from(existingDocs),
          missing_docs: missingDocs,
          completion_rate: completionRate,
        };
      });

      return projectsWithGaps;
    },
  });

  // Get unique investors for filter
  const investors = useMemo(() => {
    if (!projectsData) return [];
    const unique = new Set(projectsData.map(p => p.investor_name).filter(Boolean));
    return Array.from(unique).sort();
  }, [projectsData]);

  // Get unique statuses for filter
  const statuses = useMemo(() => {
    if (!projectsData) return [];
    const unique = new Set(projectsData.map(p => p.status));
    return Array.from(unique).sort((a, b) => (STATUS_PRIORITY[b] || 0) - (STATUS_PRIORITY[a] || 0));
  }, [projectsData]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    if (!projectsData) return [];
    
    return projectsData
      .filter(project => {
        const matchesSearch = !search || 
          project.project_code.toLowerCase().includes(search.toLowerCase()) ||
          project.project_name.toLowerCase().includes(search.toLowerCase()) ||
          (project.investor_name || '').toLowerCase().includes(search.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
        const matchesInvestor = investorFilter === 'all' || project.investor_name === investorFilter;
        const matchesGapFilter = !showOnlyWithGaps || project.missing_docs.length > 0;

        return matchesSearch && matchesStatus && matchesInvestor && matchesGapFilter;
      })
      .sort((a, b) => {
        // Sort by missing docs count (more missing = higher priority)
        if (a.missing_docs.length !== b.missing_docs.length) {
          return b.missing_docs.length - a.missing_docs.length;
        }
        // Then by status priority
        return (STATUS_PRIORITY[b.status] || 0) - (STATUS_PRIORITY[a.status] || 0);
      });
  }, [projectsData, search, statusFilter, investorFilter, showOnlyWithGaps]);

  // Summary statistics
  const stats = useMemo(() => {
    if (!projectsData) return { total: 0, withGaps: 0, avgCompletion: 0, byStatus: {} };
    
    const withGaps = projectsData.filter(p => p.missing_docs.length > 0);
    const avgCompletion = projectsData.reduce((sum, p) => sum + p.completion_rate, 0) / projectsData.length || 0;
    
    const byStatus: Record<string, { total: number; withGaps: number }> = {};
    for (const project of projectsData) {
      if (!byStatus[project.status]) {
        byStatus[project.status] = { total: 0, withGaps: 0 };
      }
      byStatus[project.status].total++;
      if (project.missing_docs.length > 0) {
        byStatus[project.status].withGaps++;
      }
    }

    return {
      total: projectsData.length,
      withGaps: withGaps.length,
      avgCompletion: Math.round(avgCompletion),
      byStatus,
    };
  }, [projectsData]);

  // Toggle project expansion
  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // Navigate to project
  const goToProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            文件缺口分析
          </h1>
          <p className="text-muted-foreground mt-1">
            檢視各專案應備文件的完成狀況，找出需要補齊的文件
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">分析專案數</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">有文件缺口</p>
                <p className="text-2xl font-bold text-destructive">{stats.withGaps}</p>
              </div>
              <FileWarning className="w-8 h-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">平均完成率</p>
                <p className="text-2xl font-bold">{stats.avgCompletion}%</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">文件齊全</p>
                <p className="text-2xl font-bold text-green-600">{stats.total - stats.withGaps}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">各狀態缺口統計</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statuses.map(status => {
              const statusStats = stats.byStatus[status];
              if (!statusStats) return null;
              const gapRate = Math.round((statusStats.withGaps / statusStats.total) * 100);
              
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    statusFilter === status 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <p className="text-sm font-medium">{status}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg font-bold">{statusStats.total}</span>
                    {statusStats.withGaps > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {statusStats.withGaps} 缺
                      </Badge>
                    )}
                  </div>
                  <Progress 
                    value={100 - gapRate} 
                    className="h-1 mt-2" 
                  />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋專案編號、名稱或業主..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                {statuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={investorFilter} onValueChange={setInvestorFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="業主" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部業主</SelectItem>
                {investors.map(investor => (
                  <SelectItem key={investor} value={investor!}>{investor}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={showOnlyWithGaps ? 'default' : 'outline'}
              onClick={() => setShowOnlyWithGaps(!showOnlyWithGaps)}
              className="whitespace-nowrap"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              {showOnlyWithGaps ? '僅顯示有缺口' : '顯示全部'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Projects List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              專案列表 
              <Badge variant="secondary" className="ml-2">
                {filteredProjects.length} 筆
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredProjects.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500/50" />
                <p className="font-medium">
                  {showOnlyWithGaps ? '所有專案文件皆已齊全！' : '沒有符合條件的專案'}
                </p>
              </div>
            ) : (
              filteredProjects.map(project => (
                <Collapsible
                  key={project.id}
                  open={expandedProjects.has(project.id)}
                  onOpenChange={() => toggleProject(project.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                      <div className="flex-shrink-0">
                        {expandedProjects.has(project.id) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-primary">
                            {project.project_code}
                          </span>
                          <span className="text-sm truncate">{project.project_name}</span>
                        </div>
                        {project.investor_name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" />
                            {project.investor_name}
                          </p>
                        )}
                      </div>

                      <Badge variant="outline" className="flex-shrink-0">
                        {project.status}
                      </Badge>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-20">
                          <Progress value={project.completion_rate} className="h-2" />
                        </div>
                        <span className={`text-sm font-medium ${
                          project.completion_rate === 100 ? 'text-green-600' : 
                          project.completion_rate >= 50 ? 'text-yellow-600' : 'text-destructive'
                        }`}>
                          {project.completion_rate}%
                        </span>
                      </div>

                      {project.missing_docs.length > 0 && (
                        <Badge variant="destructive" className="flex-shrink-0">
                          缺 {project.missing_docs.length} 項
                        </Badge>
                      )}

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                goToProject(project.id);
                              }}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>前往專案</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 pl-12 bg-muted/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                        {/* Missing Documents */}
                        {project.missing_docs.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-destructive mb-2 flex items-center gap-1">
                              <FileWarning className="w-4 h-4" />
                              缺少文件
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {project.missing_docs.map(docCode => (
                                <Badge key={docCode} variant="destructive" className="text-xs">
                                  {DOC_TYPE_LABELS[docCode] || docCode}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Existing Documents */}
                        <div>
                          <p className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            已取得文件
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {project.required_docs
                              .filter(doc => !project.missing_docs.includes(doc))
                              .map(docCode => (
                                <Badge key={docCode} variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  {DOC_TYPE_LABELS[docCode] || docCode}
                                </Badge>
                              ))}
                            {project.required_docs.filter(doc => !project.missing_docs.includes(doc)).length === 0 && (
                              <span className="text-xs text-muted-foreground">（無）</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
