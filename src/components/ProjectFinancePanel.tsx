import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  ArrowRight,
  CircleDollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { formatTWD, formatPercent } from '@/lib/formatNumber';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { EpcMetricsSection } from '@/components/EpcMetricsSection';

interface ProjectFinancePanelProps {
  projectId: string;
  projectCode?: string;
  investorId?: string;
  capacityKwp?: number;
}

// Quote status display
const quoteStatusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-muted text-muted-foreground' },
  pending: { label: '待審核', color: 'bg-amber-100 text-amber-800' },
  approved: { label: '已核准', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已拒絕', color: 'bg-red-100 text-red-800' },
  finalized: { label: '已確認', color: 'bg-primary/10 text-primary' },
};

// Payment status display
const paymentStatusMap: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: '待請款', icon: <Clock className="w-3 h-3" />, color: 'text-muted-foreground' },
  invoiced: { label: '已開票', icon: <Receipt className="w-3 h-3" />, color: 'text-amber-600' },
  paid: { label: '已收款', icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-600' },
  overdue: { label: '逾期', icon: <AlertTriangle className="w-3 h-3" />, color: 'text-destructive' },
};

export function ProjectFinancePanel({
  projectId,
  projectCode,
  investorId,
  capacityKwp,
}: ProjectFinancePanelProps) {
  // Fetch quotes for this project
  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ['project-quotes', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_quotes')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  // Fetch payment milestones config
  const { data: paymentMilestones } = useQuery({
    queryKey: ['payment-milestones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_milestones')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch project payments
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['project-payments', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_payments')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  // Get the primary/latest quote
  const primaryQuote = quotes?.find((q) => q.is_finalized) || quotes?.[0];

  // Calculate payment summary
  const totalContractAmount = payments?.reduce((sum, p) => sum + (Number(p.contract_amount) || 0), 0) || 0;
  const totalPaidAmount = payments?.reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0) || 0;
  const totalInvoicedAmount = payments?.reduce((sum, p) => sum + (Number(p.invoiced_amount) || 0), 0) || 0;
  const paymentProgress = totalContractAmount > 0 ? (totalPaidAmount / totalContractAmount) * 100 : 0;

  // Calculate cost tracking variance
  const hasCostTracking = primaryQuote && (
    primaryQuote.actual_modules_cost != null ||
    primaryQuote.actual_inverters_cost != null ||
    primaryQuote.actual_engineering_cost != null
  );

  const budgetedTotal =
    (Number(primaryQuote?.total_price_with_tax) || 0) -
    ((Number(primaryQuote?.total_price_with_tax) || 0) * 0.2); // Rough estimate of costs (80% of price)

  const actualTotal =
    (Number(primaryQuote?.actual_modules_cost) || 0) +
    (Number(primaryQuote?.actual_inverters_cost) || 0) +
    (Number(primaryQuote?.actual_engineering_cost) || 0);

  const variance = hasCostTracking && budgetedTotal > 0 ? actualTotal - budgetedTotal : 0;
  const variancePercent = budgetedTotal > 0 ? (variance / budgetedTotal) * 100 : 0;

  if (quotesLoading || paymentsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            財務資訊
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CircleDollarSign className="w-5 h-5 text-primary" />
            財務資訊
          </CardTitle>
          <Link to={`/quotes/new?projectId=${projectId}${investorId ? `&investorId=${investorId}` : ''}`}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="w-4 h-4" />
              建立報價
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Quote Summary Section */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            報價單
          </h4>
          {quotes && quotes.length > 0 ? (
            <div className="space-y-2">
              {quotes.slice(0, 3).map((quote) => {
                const status = quoteStatusMap[quote.quote_status] || quoteStatusMap.draft;
                const pricePerKw = quote.capacity_kwp > 0
                  ? Number(quote.total_price_with_tax) / quote.capacity_kwp
                  : 0;

                return (
                  <Link
                    key={quote.id}
                    to={`/quotes/${quote.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {quote.quote_number || '報價單'}
                            </span>
                            <Badge className={status.color} variant="secondary">
                              {status.label}
                            </Badge>
                            {quote.is_finalized && (
                              <Badge variant="default" className="text-xs">
                                主報價
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(quote.created_at), 'yyyy/MM/dd', { locale: zhTW })}
                            {' · '}
                            {formatTWD(Number(quote.total_price_with_tax))}
                            {pricePerKw > 0 && (
                              <span className="ml-1">
                                （{formatTWD(pricePerKw)}/kW）
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
              {quotes.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  還有 {quotes.length - 3} 份報價單
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/30">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">尚無報價單</p>
              <p className="text-xs mt-1">點擊「建立報價」開始</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Cost Tracking Section */}
        {primaryQuote && hasCostTracking && (
          <>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                成本追蹤
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs text-muted-foreground">實際成本</p>
                  <p className="text-lg font-semibold">{formatTWD(actualTotal)}</p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs text-muted-foreground">預算差異</p>
                  <div className="flex items-center gap-1.5">
                    {variance <= 0 ? (
                      <TrendingDown className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-destructive" />
                    )}
                    <span
                      className={`text-lg font-semibold ${
                        variance <= 0 ? 'text-green-600' : 'text-destructive'
                      }`}
                    >
                      {variance <= 0 ? '節省' : '超支'} {formatPercent(Math.abs(variancePercent))}
                    </span>
                  </div>
                </div>
              </div>
              {primaryQuote.is_finalized && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  ✓ 報價已確認結案
                </p>
              )}
            </div>
            <Separator />
          </>
        )}

        {/* Payment Tracking Section */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            付款進度
          </h4>
          {payments && payments.length > 0 ? (
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">已收款進度</span>
                  <span className="font-medium">
                    {formatTWD(totalPaidAmount)} / {formatTWD(totalContractAmount)}
                  </span>
                </div>
                <Progress value={paymentProgress} className="h-2" />
              </div>

              {/* Payment list */}
              <div className="space-y-1.5">
                {payments.map((payment) => {
                  const milestone = paymentMilestones?.find(
                    (m) => m.payment_code === payment.payment_code
                  );
                  const status = paymentStatusMap[payment.payment_status] || paymentStatusMap.pending;

                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className={status.color}>{status.icon}</span>
                        <span>{milestone?.payment_name || payment.payment_code}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">
                          {formatTWD(Number(payment.paid_amount) || 0)}
                        </span>
                        {Number(payment.contract_amount) > 0 && (
                          <span className="text-muted-foreground ml-1">
                            / {formatTWD(Number(payment.contract_amount))}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground border rounded-lg bg-muted/30">
              <Receipt className="w-6 h-6 mx-auto mb-1.5 opacity-50" />
              <p className="text-sm">尚無付款記錄</p>
            </div>
          )}
        </div>

        {/* Financial KPIs from Quote */}
        {primaryQuote && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                投資效益指標
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {primaryQuote.irr_20_year != null && (
                  <div className="text-center p-2 rounded-lg border bg-muted/30">
                    <p className="text-xs text-muted-foreground">IRR</p>
                    <p className="text-sm font-semibold text-primary">
                      {formatPercent(Number(primaryQuote.irr_20_year) * 100)}
                    </p>
                  </div>
                )}
                {primaryQuote.payback_years != null && (
                  <div className="text-center p-2 rounded-lg border bg-muted/30">
                    <p className="text-xs text-muted-foreground">回本</p>
                    <p className="text-sm font-semibold">
                      {Number(primaryQuote.payback_years).toFixed(1)} 年
                    </p>
                  </div>
                )}
                {primaryQuote.roi_20_year != null && (
                  <div className="text-center p-2 rounded-lg border bg-muted/30">
                    <p className="text-xs text-muted-foreground">ROI</p>
                    <p className="text-sm font-semibold text-green-600">
                      {formatPercent(Number(primaryQuote.roi_20_year) * 100)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {/* EPC Core Metrics */}
        <EpcMetricsSection projectId={projectId} />
      </CardContent>
    </Card>
  );
}
