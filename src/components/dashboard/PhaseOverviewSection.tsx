import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  CheckCircle2, 
  Wrench, 
  Clock,
  ArrowRight,
  Milestone
} from 'lucide-react';

interface Project {
  id: string;
  project_name: string;
  status: string;
  construction_status: string | null;
  admin_progress: number | null;
  engineering_progress: number | null;
  overall_progress: number | null;
  investors?: { investor_code: string; company_name: string } | null;
}

interface PhaseOverviewSectionProps {
  projects: Project[];
}

// Phase 1: 送審期 - 分水嶺前 (能源署同意備案前)
const PHASE1_STATUSES = ['開發中', '土地確認', '結構簽證', '台電送件', '台電審查', '能源署送件', '無饋線'];
// Phase 2: 執行期 - 分水嶺後 (能源署同意備案後)
const PHASE2_STATUSES = ['同意備案', '工程施工', '報竣掛表', '設備登記', '運維中'];
// 其他狀態
const INACTIVE_STATUSES = ['暫停', '取消'];

export function PhaseOverviewSection({ projects }: PhaseOverviewSectionProps) {
  const navigate = useNavigate();

  // 按階段分類專案
  const phaseData = useMemo(() => {
    const activeProjects = projects.filter(p => !INACTIVE_STATUSES.includes(p.status));
    
    const phase1Projects = activeProjects.filter(p => PHASE1_STATUSES.includes(p.status));
    const phase2Projects = activeProjects.filter(p => PHASE2_STATUSES.includes(p.status));
    
    // Phase 1 細分
    const phase1Breakdown = {
      developing: phase1Projects.filter(p => ['開發中', '土地確認', '結構簽證'].includes(p.status)).length,
      submitting: phase1Projects.filter(p => ['台電送件', '台電審查', '無饋線'].includes(p.status)).length,
      energyReview: phase1Projects.filter(p => p.status === '能源署送件').length,
    };
    
    // Phase 2 細分
    const phase2Breakdown = {
      approved: phase2Projects.filter(p => p.status === '同意備案').length,
      construction: phase2Projects.filter(p => p.status === '工程施工').length,
      metering: phase2Projects.filter(p => p.status === '報竣掛表').length,
      completed: phase2Projects.filter(p => ['設備登記', '運維中'].includes(p.status)).length,
    };
    
    // 計算平均進度
    const phase1AvgProgress = phase1Projects.length > 0
      ? phase1Projects.reduce((sum, p) => sum + (p.admin_progress || 0), 0) / phase1Projects.length
      : 0;
    
    const phase2AvgProgress = phase2Projects.length > 0
      ? phase2Projects.reduce((sum, p) => sum + (p.overall_progress || 0), 0) / phase2Projects.length
      : 0;
    
    return {
      phase1: {
        total: phase1Projects.length,
        breakdown: phase1Breakdown,
        avgProgress: phase1AvgProgress,
      },
      phase2: {
        total: phase2Projects.length,
        breakdown: phase2Breakdown,
        avgProgress: phase2AvgProgress,
      },
      inactive: {
        paused: projects.filter(p => p.status === '暫停').length,
        cancelled: projects.filter(p => p.status === '取消').length,
      },
    };
  }, [projects]);

  return (
    <div className="space-y-4">
      {/* Phase 1 & Phase 2 Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Phase 1: 送審期 */}
        <Card className="border-l-4 border-l-info">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-info" />
                Phase 1：送審期
              </CardTitle>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {phaseData.phase1.total} 件
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">分水嶺前：接案 → 能源署同意備案</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Progress Bar */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">平均進度</span>
              <Progress value={phaseData.phase1.avgProgress} className="h-2 flex-1" />
              <span className="text-sm font-medium w-12 text-right">
                {phaseData.phase1.avgProgress.toFixed(0)}%
              </span>
            </div>
            
            {/* Breakdown */}
            <div className="grid grid-cols-3 gap-2">
              <div 
                className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate('/projects?status=開發中,土地確認,結構簽證')}
              >
                <p className="text-xs text-muted-foreground">開發準備</p>
                <p className="text-xl font-bold">{phaseData.phase1.breakdown.developing}</p>
              </div>
              <div 
                className="p-3 rounded-lg bg-info/5 cursor-pointer hover:bg-info/10 transition-colors"
                onClick={() => navigate('/projects?status=台電送件,台電審查,無饋線')}
              >
                <p className="text-xs text-muted-foreground">台電審查</p>
                <p className="text-xl font-bold">{phaseData.phase1.breakdown.submitting}</p>
              </div>
              <div 
                className="p-3 rounded-lg bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => navigate('/projects?status=能源署送件')}
              >
                <p className="text-xs text-muted-foreground">能源署</p>
                <p className="text-xl font-bold">{phaseData.phase1.breakdown.energyReview}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phase 2: 執行期 */}
        <Card className="border-l-4 border-l-success">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Wrench className="w-4 h-4 text-success" />
                Phase 2：執行期
              </CardTitle>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {phaseData.phase2.total} 件
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">分水嶺後：備案 → 工程施工 → 掛表 → 運維</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Progress Bar */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">平均進度</span>
              <Progress value={phaseData.phase2.avgProgress} className="h-2 flex-1" />
              <span className="text-sm font-medium w-12 text-right">
                {phaseData.phase2.avgProgress.toFixed(0)}%
              </span>
            </div>
            
            {/* Breakdown */}
            <div className="grid grid-cols-4 gap-2">
              <div 
                className="p-3 rounded-lg bg-success/5 cursor-pointer hover:bg-success/10 transition-colors"
                onClick={() => navigate('/projects?status=同意備案')}
              >
                <p className="text-xs text-muted-foreground">已備案</p>
                <p className="text-xl font-bold">{phaseData.phase2.breakdown.approved}</p>
              </div>
              <div 
                className="p-3 rounded-lg bg-info/5 cursor-pointer hover:bg-info/10 transition-colors"
                onClick={() => navigate('/projects?status=工程施工')}
              >
                <p className="text-xs text-muted-foreground">施工中</p>
                <p className="text-xl font-bold">{phaseData.phase2.breakdown.construction}</p>
              </div>
              <div 
                className="p-3 rounded-lg bg-warning/5 cursor-pointer hover:bg-warning/10 transition-colors"
                onClick={() => navigate('/projects?status=報竣掛表')}
              >
                <p className="text-xs text-muted-foreground">待掛表</p>
                <p className="text-xl font-bold">{phaseData.phase2.breakdown.metering}</p>
              </div>
              <div 
                className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate('/projects?status=設備登記,運維中')}
              >
                <p className="text-xs text-muted-foreground">已完成</p>
                <p className="text-xl font-bold">{phaseData.phase2.breakdown.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flow Visualization */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground overflow-x-auto">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted/50 whitespace-nowrap">
              <Milestone className="w-3 h-3" />
              接案
            </div>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
            <div className="px-2 py-1 rounded bg-info/10 text-info whitespace-nowrap">台電送件</div>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
            <div className="px-2 py-1 rounded bg-info/10 text-info whitespace-nowrap">意見書</div>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
            <div className="px-2 py-1 rounded bg-primary/10 text-primary whitespace-nowrap">能源署</div>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
            <div className="px-2 py-1 rounded bg-success/20 text-success font-medium whitespace-nowrap border border-success/30">
              ✓ 同意備案
            </div>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
            <div className="px-2 py-1 rounded bg-warning/10 text-warning whitespace-nowrap">施工</div>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
            <div className="px-2 py-1 rounded bg-warning/10 text-warning whitespace-nowrap">掛表</div>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-success/10 text-success whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3" />
              運維
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inactive Projects */}
      {(phaseData.inactive.paused > 0 || phaseData.inactive.cancelled > 0) && (
        <div className="flex gap-3">
          {phaseData.inactive.paused > 0 && (
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-muted"
              onClick={() => navigate('/projects?status=暫停')}
            >
              <Clock className="w-3 h-3 mr-1" />
              暫停 {phaseData.inactive.paused} 件
            </Badge>
          )}
          {phaseData.inactive.cancelled > 0 && (
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-muted text-muted-foreground"
              onClick={() => navigate('/projects?status=取消')}
            >
              取消 {phaseData.inactive.cancelled} 件
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
