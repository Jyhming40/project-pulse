import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  Wrench, 
  DollarSign, 
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp
} from 'lucide-react';
import { usePaymentSummary } from '@/hooks/usePaymentTracking';

interface Project {
  id: string;
  project_name: string;
  status: string;
  construction_status: string | null;
  admin_stage: string | null;
  engineering_stage: string | null;
  admin_progress: number | null;
  engineering_progress: number | null;
  overall_progress: number | null;
}

interface Phase2TracksSectionProps {
  projects: Project[];
  isLoading?: boolean;
}

// Phase 2 的所有狀態
const PHASE2_STATUSES = ['同意備案', '工程施工', '報竣掛表', '設備登記', '運維中'];

// 行政線節點 (C1-C9)
const ADMIN_TRACK_STAGES = [
  { code: 'C1', label: '免雜項/技師簽證', milestones: ['ADMIN_05_MISC_EXEMPT', 'ADMIN_05B_ELECTRICAL_CERT'] },
  { code: 'C2', label: '台電細部協商', milestones: ['ADMIN_06_TAIPOWER_DETAIL'] },
  { code: 'C3', label: '躉售合約', milestones: ['ADMIN_07_PPA_SIGNED'] },
  { code: 'C4', label: '報竣掛表', milestones: ['ADMIN_08_METER_INSTALLED'] },
  { code: 'C5', label: '設備登記', milestones: ['ADMIN_09_EQUIPMENT_REG'] },
  { code: 'C6', label: '正式躉售函', milestones: ['ADMIN_09B_FIT_OFFICIAL'] },
];

// 工程線節點 (B1-B6)
const ENGINEERING_TRACK_STAGES = [
  { code: 'B1', label: '設計定稿', milestones: ['ENG_02_DESIGN_FINAL'] },
  { code: 'B2', label: '材料採購', milestones: ['ENG_03_MATERIAL_ORDER'] },
  { code: 'B3', label: '鋼構支架', milestones: ['ENG_04_STRUCTURE'] },
  { code: 'B4', label: '模組安裝', milestones: ['ENG_05_MODULE'] },
  { code: 'B5', label: '機電配線', milestones: ['ENG_06_ELECTRICAL'] },
  { code: 'B6', label: '併聯測試', milestones: ['ENG_08_GRID_TEST'] },
];

// 根據 construction_status 判斷工程進度
const getEngineeringStageFromStatus = (constructionStatus: string | null): number => {
  const statusToStage: Record<string, number> = {
    '尚未開工': 0,
    '備料中': 1,
    '施工中': 3,
    '已完工': 6,
    '已掛錶': 6,
    '暫緩': 0,
  };
  return statusToStage[constructionStatus || ''] ?? 0;
};

// 根據 status 判斷行政進度
const getAdminStageFromStatus = (status: string): number => {
  const statusToStage: Record<string, number> = {
    '同意備案': 1,
    '工程施工': 2,
    '報竣掛表': 3,
    '設備登記': 5,
    '運維中': 6,
  };
  return statusToStage[status] ?? 0;
};

export function Phase2TracksSection({ projects, isLoading }: Phase2TracksSectionProps) {
  const navigate = useNavigate();
  const { data: paymentSummary, isLoading: paymentLoading } = usePaymentSummary();

  // 只取 Phase 2 專案
  const phase2Projects = useMemo(() => 
    projects.filter(p => PHASE2_STATUSES.includes(p.status)),
    [projects]
  );

  // 計算各軌道數據
  const trackData = useMemo(() => {
    // === 行政線分析 ===
    const adminAnalysis = {
      total: phase2Projects.length,
      completed: phase2Projects.filter(p => ['運維中'].includes(p.status)).length,
      distribution: {} as Record<string, number>,
      avgProgress: 0,
      // 真正卡關：工程已完工但行政還在早期階段
      bottlenecks: [] as { label: string; count: number }[],
    };
    
    // 統計各階段分佈
    phase2Projects.forEach(p => {
      adminAnalysis.distribution[p.status] = (adminAnalysis.distribution[p.status] || 0) + 1;
    });
    
    // 找出真正卡關的案件：工程已完成但行政落後
    const engineeringDoneButAdminBehind = phase2Projects.filter(p => {
      const isEngineeringDone = p.construction_status === '已完工' || p.construction_status === '已掛錶';
      const isAdminBehind = ['同意備案', '工程施工', '報竣掛表'].includes(p.status);
      return isEngineeringDone && isAdminBehind;
    });
    
    if (engineeringDoneButAdminBehind.length > 0) {
      // 按行政階段分組
      const byAdminStage: Record<string, number> = {};
      engineeringDoneButAdminBehind.forEach(p => {
        byAdminStage[p.status] = (byAdminStage[p.status] || 0) + 1;
      });
      Object.entries(byAdminStage).forEach(([stage, count]) => {
        adminAnalysis.bottlenecks.push({ label: `工程完成卡在${stage}`, count });
      });
    }
    
    adminAnalysis.avgProgress = phase2Projects.length > 0
      ? phase2Projects.reduce((sum, p) => sum + (p.admin_progress || 0), 0) / phase2Projects.length
      : 0;

    // === 工程線分析 ===
    const engineeringAnalysis = {
      total: phase2Projects.length,
      completed: phase2Projects.filter(p => 
        p.construction_status === '已完工' || p.construction_status === '已掛錶'
      ).length,
      distribution: {} as Record<string, number>,
      avgProgress: 0,
      onHold: phase2Projects.filter(p => p.construction_status === '暫緩').length,
      // 真正卡關：行政已過但工程未開始
      bottlenecks: [] as { label: string; count: number }[],
    };
    
    phase2Projects.forEach(p => {
      const status = p.construction_status || '尚未開工';
      engineeringAnalysis.distribution[status] = (engineeringAnalysis.distribution[status] || 0) + 1;
    });
    
    // 找出真正卡關的案件：已備案但工程未開始
    const adminPassedButEngineeringNotStarted = phase2Projects.filter(p => {
      const isAdminPassed = ['同意備案', '工程施工', '報竣掛表', '設備登記'].includes(p.status);
      const isEngineeringNotStarted = !p.construction_status || p.construction_status === '尚未開工';
      return isAdminPassed && isEngineeringNotStarted;
    });
    
    if (adminPassedButEngineeringNotStarted.length > 0) {
      engineeringAnalysis.bottlenecks.push({ 
        label: '已備案未開工', 
        count: adminPassedButEngineeringNotStarted.length 
      });
    }
    
    engineeringAnalysis.avgProgress = phase2Projects.length > 0
      ? phase2Projects.reduce((sum, p) => sum + (p.engineering_progress || 0), 0) / phase2Projects.length
      : 0;

    // === 財務線分析 (從 paymentSummary) ===
    const financialAnalysis = {
      pendingCount: paymentSummary?.pendingCount || 0,
      pendingAmount: paymentSummary?.totalPending || 0,
      invoicedCount: paymentSummary?.invoicedCount || 0,
      invoicedAmount: paymentSummary?.totalInvoiced || 0,
      paidCount: paymentSummary?.paidCount || 0,
      paidAmount: paymentSummary?.totalPaid || 0,
      collectionRate: 0,
    };
    
    const totalAmount = financialAnalysis.pendingAmount + financialAnalysis.invoicedAmount + financialAnalysis.paidAmount;
    financialAnalysis.collectionRate = totalAmount > 0 
      ? (financialAnalysis.paidAmount / totalAmount) * 100 
      : 0;

    // === 營運線分析 ===
    const operationsAnalysis = {
      meterInstalled: phase2Projects.filter(p => 
        p.construction_status === '已掛錶' || p.status === '設備登記' || p.status === '運維中'
      ).length,
      equipmentRegistered: phase2Projects.filter(p => 
        ['設備登記', '運維中'].includes(p.status)
      ).length,
      inOperation: phase2Projects.filter(p => p.status === '運維中').length,
      pendingFirstBill: phase2Projects.filter(p => 
        p.status === '設備登記'
      ).length,
    };

    return {
      admin: adminAnalysis,
      engineering: engineeringAnalysis,
      financial: financialAnalysis,
      operations: operationsAnalysis,
    };
  }, [phase2Projects, paymentSummary]);

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}千萬`;
    if (amount >= 10000) return `${(amount / 10000).toFixed(0)}萬`;
    return amount.toLocaleString();
  };

  if (isLoading || paymentLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Phase 2 執行期 - 多軌並行追蹤</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 取得最大的真正卡關項目
  const topAdminBottleneck = trackData.admin.bottlenecks[0];
  const topEngineeringBottleneck = trackData.engineering.bottlenecks[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Phase 2 執行期 - 多軌並行追蹤
          </CardTitle>
          <Badge variant="secondary" className="text-sm">
            {phase2Projects.length} 件
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          備案後執行期：行政/工程/財務/營運 四條主線並行
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Track C: 行政/法規線 */}
          <Card 
            className="bg-gradient-to-br from-info/5 to-info/10 border-info/20 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/projects?status=同意備案,工程施工,報竣掛表,設備登記')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-info/20 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-info" />
                </div>
                <div>
                  <p className="text-xs font-medium text-info">行政/法規線</p>
                  <p className="text-[10px] text-muted-foreground">Track C</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">進度</span>
                  <span className="text-sm font-medium">{trackData.admin.avgProgress.toFixed(0)}%</span>
                </div>
                <Progress value={trackData.admin.avgProgress} className="h-1.5" />
                
                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-muted-foreground">已完成</span>
                  <span className="font-medium text-success">{trackData.admin.completed}</span>
                </div>
                
                {topAdminBottleneck && (
                  <div className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 rounded px-2 py-1 mt-2">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="truncate">{topAdminBottleneck.label}</span>
                    <Badge variant="destructive" className="ml-auto text-[10px] h-4">
                      {topAdminBottleneck.count}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Track B: 工程施工線 */}
          <Card 
            className="bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/projects?construction_status=施工中,備料中')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <p className="text-xs font-medium text-warning">工程施工線</p>
                  <p className="text-[10px] text-muted-foreground">Track B</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">進度</span>
                  <span className="text-sm font-medium">{trackData.engineering.avgProgress.toFixed(0)}%</span>
                </div>
                <Progress value={trackData.engineering.avgProgress} className="h-1.5" />
                
                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-muted-foreground">已完工</span>
                  <span className="font-medium text-success">{trackData.engineering.completed}</span>
                </div>
                
                {trackData.engineering.onHold > 0 && (
                  <div className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 rounded px-2 py-1 mt-2">
                    <Clock className="w-3 h-3" />
                    <span>暫緩中</span>
                    <Badge variant="destructive" className="ml-auto text-[10px] h-4">
                      {trackData.engineering.onHold}
                    </Badge>
                  </div>
                )}
                
                {topEngineeringBottleneck && (
                  <div className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 rounded px-2 py-1 mt-2">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="truncate">{topEngineeringBottleneck.label}</span>
                    <Badge variant="destructive" className="ml-auto text-[10px] h-4">
                      {topEngineeringBottleneck.count}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Track A: 財務/請款線 */}
          <Card 
            className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/projects?payment_status=pending')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-primary">財務/請款線</p>
                  <p className="text-[10px] text-muted-foreground">Track A</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">收款率</span>
                  <span className="text-sm font-medium">{trackData.financial.collectionRate.toFixed(0)}%</span>
                </div>
                <Progress value={trackData.financial.collectionRate} className="h-1.5" />
                
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">待請款</p>
                    <p className="font-medium">{formatCurrency(trackData.financial.pendingAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">已收款</p>
                    <p className="font-medium text-success">{formatCurrency(trackData.financial.paidAmount)}</p>
                  </div>
                </div>
                
                {trackData.financial.invoicedCount > 0 && (
                  <div className="flex items-center gap-1 text-xs text-info bg-info/10 rounded px-2 py-1 mt-2">
                    <FileText className="w-3 h-3" />
                    <span>已開票待收</span>
                    <Badge variant="secondary" className="ml-auto text-[10px] h-4">
                      {trackData.financial.invoicedCount}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Track D: 營運線 */}
          <Card 
            className="bg-gradient-to-br from-success/5 to-success/10 border-success/20 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/projects?status=設備登記,運維中')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="text-xs font-medium text-success">台電營運線</p>
                  <p className="text-[10px] text-muted-foreground">Track D</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground">已掛錶</p>
                    <p className="text-lg font-bold">{trackData.operations.meterInstalled}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground">運維中</p>
                    <p className="text-lg font-bold text-success">{trackData.operations.inOperation}</p>
                  </div>
                </div>
                
                {trackData.operations.pendingFirstBill > 0 && (
                  <div className="flex items-center gap-1 text-xs text-warning bg-warning/10 rounded px-2 py-1 mt-2">
                    <Clock className="w-3 h-3" />
                    <span>待第一次電費單</span>
                    <Badge variant="secondary" className="ml-auto text-[10px] h-4">
                      {trackData.operations.pendingFirstBill}
                    </Badge>
                  </div>
                )}
                
                <div className="flex items-center gap-1 text-xs text-success pt-2">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>設備登記完成 {trackData.operations.equipmentRegistered} 件</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
