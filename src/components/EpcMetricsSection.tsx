import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  BarChart3,
  Pencil,
  Plus,
  Settings2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { formatTWD, formatPercent } from '@/lib/formatNumber';
import {
  getMarginThresholds,
  setMarginThresholds,
  getMarginColor,
  getMarginBadgeClasses,
  MarginThresholds,
} from '@/lib/epcSettings';
import { toast } from 'sonner';

interface EpcMetricsSectionProps {
  projectId: string;
}

interface EpcRow {
  id: string;
  project_id: string;
  contract_amount: number | null;
  direct_cost: number | null;
  gross_profit: number | null;
  gross_margin_rate: number | null;
  risk_reserve_percent: number;
  risk_reserve_amount: number | null;
  net_expected_profit: number | null;
  note: string | null;
}

export function EpcMetricsSection({ projectId }: EpcMetricsSectionProps) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [thresholdOpen, setThresholdOpen] = useState(false);

  // Fetch EPC row
  const { data: epcRow, isLoading: epcLoading } = useQuery({
    queryKey: ['epc-metrics', projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('project_epc_financial_metrics')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as EpcRow | null;
    },
    enabled: !!projectId,
  });

  // Fetch quotes for prefill
  const { data: quotes } = useQuery({
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

  // Auto-prefill from best quote
  const prefill = useMemo(() => {
    if (epcRow || !quotes || quotes.length === 0) return null;
    // Prefer finalized/approved
    const best =
      quotes.find((q) => q.is_finalized) ||
      quotes.find((q) => q.quote_status === 'approved') ||
      quotes[0];
    if (!best) return null;

    const directCost =
      (Number(best.actual_modules_cost) || 0) +
      (Number(best.actual_inverters_cost) || 0) +
      (Number(best.actual_engineering_cost) || 0);

    return {
      contract_amount: Number(best.total_price_with_tax) || 0,
      direct_cost: directCost > 0 ? directCost : undefined,
      risk_reserve_percent: 0.03,
    };
  }, [epcRow, quotes]);

  // Form state
  const [form, setForm] = useState({
    contract_amount: '',
    direct_cost: '',
    risk_reserve_percent: '',
    note: '',
  });

  const openEditDialog = useCallback(() => {
    if (epcRow) {
      setForm({
        contract_amount: epcRow.contract_amount?.toString() || '',
        direct_cost: epcRow.direct_cost?.toString() || '',
        risk_reserve_percent: ((epcRow.risk_reserve_percent || 0.03) * 100).toString(),
        note: epcRow.note || '',
      });
    } else if (prefill) {
      setForm({
        contract_amount: prefill.contract_amount.toString(),
        direct_cost: prefill.direct_cost?.toString() || '',
        risk_reserve_percent: ((prefill.risk_reserve_percent) * 100).toString(),
        note: '',
      });
    } else {
      setForm({ contract_amount: '', direct_cost: '', risk_reserve_percent: '3', note: '' });
    }
    setEditOpen(true);
  }, [epcRow, prefill]);

  // Upsert mutation
  const upsertMutation = useMutation({
    mutationFn: async (values: {
      contract_amount: number | null;
      direct_cost: number | null;
      risk_reserve_percent: number;
      note: string;
    }) => {
      const payload = {
        project_id: projectId,
        contract_amount: values.contract_amount,
        direct_cost: values.direct_cost,
        risk_reserve_percent: values.risk_reserve_percent,
        note: values.note || null,
      };

      if (epcRow) {
        const { error } = await supabase
          .from('project_epc_financial_metrics' as any)
          .update(payload as any)
          .eq('id', epcRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_epc_financial_metrics' as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epc-metrics', projectId] });
      toast.success('EPC 指標已儲存');
      setEditOpen(false);
    },
    onError: (err: any) => {
      toast.error(`儲存失敗：${err.message}`);
    },
  });

  const handleSave = () => {
    const contractAmt = form.contract_amount ? Number(form.contract_amount) : null;
    const directCost = form.direct_cost ? Number(form.direct_cost) : null;
    const riskPct = Number(form.risk_reserve_percent) / 100;

    if (isNaN(riskPct) || riskPct < 0 || riskPct > 1) {
      toast.error('風險準備金比例需在 0% ~ 100% 之間');
      return;
    }

    upsertMutation.mutate({
      contract_amount: contractAmt,
      direct_cost: directCost,
      risk_reserve_percent: riskPct,
      note: form.note,
    });
  };

  // Compute display values (from epcRow or prefill)
  const display = useMemo(() => {
    const source = epcRow
      ? {
          contractAmount: Number(epcRow.contract_amount) || 0,
          directCost: Number(epcRow.direct_cost) || 0,
          grossProfit: Number(epcRow.gross_profit) || 0,
          grossMarginRate: Number(epcRow.gross_margin_rate) || 0,
          riskReservePercent: Number(epcRow.risk_reserve_percent) || 0,
          riskReserveAmount: Number(epcRow.risk_reserve_amount) || 0,
          netExpectedProfit: Number(epcRow.net_expected_profit) || 0,
        }
      : prefill
        ? (() => {
            const ca = prefill.contract_amount;
            const dc = prefill.direct_cost || 0;
            const gp = ca - dc;
            const gmr = ca > 0 ? gp / ca : 0;
            const rrp = prefill.risk_reserve_percent;
            const rra = ca * rrp;
            return {
              contractAmount: ca,
              directCost: dc,
              grossProfit: gp,
              grossMarginRate: gmr,
              riskReservePercent: rrp,
              riskReserveAmount: rra,
              netExpectedProfit: gp - rra,
            };
          })()
        : null;

    return source;
  }, [epcRow, prefill]);

  // Threshold form
  const [thresholdForm, setThresholdForm] = useState<{ green: string; yellow: string }>({
    green: '',
    yellow: '',
  });

  const openThresholdDialog = useCallback(() => {
    const t = getMarginThresholds();
    setThresholdForm({
      green: (t.greenAbove * 100).toString(),
      yellow: (t.yellowAbove * 100).toString(),
    });
    setThresholdOpen(true);
  }, []);

  const handleThresholdSave = () => {
    const greenAbove = Number(thresholdForm.green) / 100;
    const yellowAbove = Number(thresholdForm.yellow) / 100;
    const ok = setMarginThresholds({ greenAbove, yellowAbove });
    if (!ok) {
      toast.error('門檻無效：需滿足 0 < 黃燈 < 綠燈 < 100%');
      return;
    }
    toast.success('毛利門檻已更新');
    setThresholdOpen(false);
    // Force re-render
    queryClient.invalidateQueries({ queryKey: ['epc-metrics', projectId] });
  };

  if (epcLoading) return null;

  const marginColor = display ? getMarginColor(display.grossMarginRate) : null;

  return (
    <>
      <Separator />
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            EPC 核心指標
          </h4>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={openThresholdDialog} title="門檻設定">
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={openEditDialog}>
              {epcRow ? <Pencil className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {epcRow ? '編輯' : '建立'}
            </Button>
          </div>
        </div>

        {!epcRow && prefill && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 mb-3">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              尚未建立 EPC 指標，已以最新/已確認報價預填，請確認後儲存。
            </p>
          </div>
        )}

        {display ? (
          <div className="space-y-3">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">合約金額</p>
                <p className="text-sm font-semibold">{formatTWD(display.contractAmount)}</p>
              </div>
              <div className="p-2.5 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">直接成本</p>
                <p className="text-sm font-semibold">{formatTWD(display.directCost)}</p>
              </div>
            </div>

            {/* Gross Margin Row */}
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">毛利</p>
                  <p className="text-base font-bold">{formatTWD(display.grossProfit)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">毛利率</p>
                  <Badge className={`text-sm font-bold ${marginColor ? getMarginBadgeClasses(marginColor) : ''}`}>
                    {formatPercent(display.grossMarginRate * 100)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Risk reserve & Net profit */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  風險準備金 ({formatPercent(display.riskReservePercent * 100)})
                </p>
                <p className="text-sm font-semibold text-amber-600">
                  -{formatTWD(display.riskReserveAmount)}
                </p>
              </div>
              <div className="p-2.5 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">扣風險後淨利</p>
                <p className={`text-sm font-bold ${display.netExpectedProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {formatTWD(display.netExpectedProfit)}
                </p>
              </div>
            </div>

            {display.directCost === 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                直接成本為 $0，請確認是否已填入
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground border rounded-lg bg-muted/30">
            <BarChart3 className="w-6 h-6 mx-auto mb-1.5 opacity-50" />
            <p className="text-sm">尚無 EPC 指標</p>
            <p className="text-xs mt-1">點擊「建立」開始</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{epcRow ? '編輯 EPC 指標' : '建立 EPC 指標'}</DialogTitle>
            <DialogDescription>設定此案場的合約金額、直接成本與風險準備金比例。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">合約金額（含稅）</label>
              <Input
                type="number"
                value={form.contract_amount}
                onChange={(e) => setForm((f) => ({ ...f, contract_amount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium">直接成本</label>
              <Input
                type="number"
                value={form.direct_cost}
                onChange={(e) => setForm((f) => ({ ...f, direct_cost: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium">風險準備金 (%)</label>
              <Input
                type="number"
                value={form.risk_reserve_percent}
                onChange={(e) => setForm((f) => ({ ...f, risk_reserve_percent: e.target.value }))}
                placeholder="3"
                step="0.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">備註</label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="選填"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Threshold Dialog */}
      <Dialog open={thresholdOpen} onOpenChange={setThresholdOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>毛利率門檻設定</DialogTitle>
            <DialogDescription>調整毛利率的健康指標顏色門檻（僅影響此瀏覽器）。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                綠燈門檻 (%)
              </label>
              <Input
                type="number"
                value={thresholdForm.green}
                onChange={(e) => setThresholdForm((f) => ({ ...f, green: e.target.value }))}
                placeholder="18"
                step="1"
              />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
                黃燈門檻 (%)
              </label>
              <Input
                type="number"
                value={thresholdForm.yellow}
                onChange={(e) => setThresholdForm((f) => ({ ...f, yellow: e.target.value }))}
                placeholder="12"
                step="1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              低於黃燈門檻 → 紅燈；介於黃燈與綠燈之間 → 黃燈；高於綠燈門檻 → 綠燈
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThresholdOpen(false)}>
              取消
            </Button>
            <Button onClick={handleThresholdSave}>套用</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
