import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, 
  FileText, 
  CheckCircle2, 
  Clock,
  TrendingUp
} from 'lucide-react';
import { usePaymentMilestones, usePaymentSummary, PAYMENT_STATUS_LABELS } from '@/hooks/usePaymentTracking';

interface FinancialOverviewSectionProps {
  isLoading?: boolean;
}

export function FinancialOverviewSection({ isLoading }: FinancialOverviewSectionProps) {
  const navigate = useNavigate();
  const { data: milestones = [], isLoading: milestonesLoading } = usePaymentMilestones();
  const { data: summary, isLoading: summaryLoading } = usePaymentSummary();

  const loading = isLoading || milestonesLoading || summaryLoading;

  // 計算總體統計
  const stats = useMemo(() => {
    if (!summary) {
      return {
        totalPending: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        pendingCount: 0,
        invoicedCount: 0,
        paidCount: 0,
        collectionRate: 0,
      };
    }

    const total = summary.totalPending + summary.totalInvoiced + summary.totalPaid;
    const collectionRate = total > 0 ? (summary.totalPaid / total) * 100 : 0;

    return {
      ...summary,
      collectionRate,
    };
  }, [summary]);

  // 格式化金額
  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `${(amount / 10000000).toFixed(1)}千萬`;
    }
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(0)}萬`;
    }
    return amount.toLocaleString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            財務追款概況
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            財務追款概況
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            <TrendingUp className="w-3 h-3 mr-1" />
            收款率 {stats.collectionRate.toFixed(0)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">待請款</p>
                  <p className="text-xl font-bold">{stats.pendingCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(stats.totalPending)}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-info/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">已開票</p>
                  <p className="text-xl font-bold">{stats.invoicedCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(stats.totalInvoiced)}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-success/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">已收款</p>
                  <p className="text-xl font-bold">{stats.paidCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(stats.totalPaid)}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Stage Progress */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">各階段收款進度</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {milestones.map(milestone => {
              const stageData = summary?.byStage?.[milestone.payment_code];
              const total = (stageData?.pending || 0) + (stageData?.invoiced || 0) + (stageData?.paid || 0);
              const paidPercent = total > 0 ? ((stageData?.paid || 0) / total) * 100 : 0;
              
              return (
                <div 
                  key={milestone.id}
                  className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/projects?payment=${milestone.payment_code}`)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate">{milestone.payment_name}</span>
                    <span className="text-xs text-muted-foreground">{stageData?.count || 0}</span>
                  </div>
                  <Progress value={paidPercent} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {paidPercent.toFixed(0)}% 已收
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-accent"
            onClick={() => navigate('/projects?payment_status=pending')}
          >
            待請款案場
          </Badge>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-accent"
            onClick={() => navigate('/projects?payment_status=invoiced')}
          >
            已開票未收款
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
