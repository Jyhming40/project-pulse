import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Sparkles, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { EngineeringCategory } from "@/hooks/useQuoteEngineering";

interface QuoteInsightReportProps {
  capacityKwp: number;
  pricePerKwp: number;
  taxRate: number;
  engineeringTotal: number;
  modulesTotal: number;
  invertersTotal: number;
  categories: EngineeringCategory[];
  quoteId?: string;
}

interface InsightResponse {
  success: boolean;
  report?: string;
  metadata?: {
    pricePosition: string;
    grossMarginRate: number;
    hasHistoricalData: boolean;
  };
  error?: string;
}

export default function QuoteInsightReport({
  capacityKwp,
  pricePerKwp,
  taxRate,
  engineeringTotal,
  modulesTotal,
  invertersTotal,
  categories,
  quoteId,
}: QuoteInsightReportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<InsightResponse["metadata"] | null>(null);

  // Fetch historical quotes for comparison
  const { data: historicalQuotes } = useQuery({
    queryKey: ["historical-quotes", capacityKwp],
    queryFn: async () => {
      // Fetch quotes with similar capacity (±50%)
      const minCapacity = capacityKwp * 0.5;
      const maxCapacity = capacityKwp * 1.5;
      
      const { data, error } = await supabase
        .from("project_quotes")
        .select("capacity_kwp, price_per_kwp, created_at")
        .gte("capacity_kwp", minCapacity)
        .lte("capacity_kwp", maxCapacity)
        .neq("id", quoteId || "")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });

  // Calculate totals and margins
  const totalCost = engineeringTotal + modulesTotal + invertersTotal;
  const totalRevenue = capacityKwp * pricePerKwp;
  const grossMargin = totalRevenue - totalCost;
  const grossMarginRate = totalRevenue > 0 ? grossMargin / totalRevenue : 0;

  // AI insight mutation
  const insightMutation = useMutation({
    mutationFn: async () => {
      const categoryData = categories.map(cat => ({
        categoryName: cat.categoryName,
        subtotal: cat.items.reduce((sum, item) => {
          const subtotal = item.isLumpSum 
            ? (item.lumpSumAmount || 0)
            : (item.unitPrice || 0) * (item.quantity || 0);
          return sum + subtotal;
        }, 0),
      }));

      const historicalData = historicalQuotes?.map(q => ({
        capacityKwp: Number(q.capacity_kwp),
        pricePerKwp: Number(q.price_per_kwp),
        grossMarginRate: 0.15, // Default estimate since we don't have historical cost data
        createdAt: q.created_at,
      }));

      const response = await supabase.functions.invoke<InsightResponse>("quote-insight-report", {
        body: {
          quoteData: {
            capacityKwp,
            pricePerKwp,
            taxRate,
            totalCost,
            engineeringTotal,
            modulesTotal,
            invertersTotal,
            grossMargin,
            grossMarginRate,
            categories: categoryData,
            historicalQuotes: historicalData,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: (data) => {
      if (data?.success && data.report) {
        setReport(data.report);
        setMetadata(data.metadata || null);
      } else if (data?.error) {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      console.error("Insight error:", error);
      toast.error("無法生成洞察報告，請稍後再試");
    },
  });

  const handleGenerateReport = () => {
    setReport(null);
    insightMutation.mutate();
  };

  const getPricePositionBadge = (position: string) => {
    switch (position) {
      case "低於市場":
        return <Badge variant="destructive" className="gap-1"><TrendingDown className="h-3 w-3" /> 低於市場</Badge>;
      case "高於市場":
        return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800"><TrendingUp className="h-3 w-3" /> 高於市場</Badge>;
      default:
        return <Badge variant="outline" className="gap-1 border-green-500 text-green-700"><CheckCircle className="h-3 w-3" /> 市場區間</Badge>;
    }
  };

  const getMarginHealthBadge = (rate: number) => {
    if (rate < 0.1) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> 利潤過低</Badge>;
    } else if (rate < 0.15) {
      return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800"><AlertTriangle className="h-3 w-3" /> 利潤偏低</Badge>;
    } else if (rate < 0.25) {
      return <Badge variant="outline" className="gap-1 border-green-500 text-green-700"><CheckCircle className="h-3 w-3" /> 利潤健康</Badge>;
    } else {
      return <Badge className="gap-1 bg-green-600"><TrendingUp className="h-3 w-3" /> 利潤優異</Badge>;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          AI 洞察報告
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            報價洞察分析
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Quick Stats */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">快速概覽</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">裝置容量</span>
                <span className="font-medium">{capacityKwp} kWp</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">每kW未稅報價</span>
                <span className="font-medium">${pricePerKwp.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">總成本</span>
                <span className="font-medium text-red-600">${totalCost.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">毛利金額</span>
                <span className={`font-medium ${grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${grossMargin.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">毛利率</span>
                <span className="font-bold text-lg">
                  {(grossMarginRate * 100).toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerateReport} 
            disabled={insightMutation.isPending}
            className="w-full gap-2"
          >
            {insightMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 分析中...
              </>
            ) : report ? (
              <>
                <RefreshCw className="h-4 w-4" />
                重新分析
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                生成洞察報告
              </>
            )}
          </Button>

          {/* Report Content */}
          {report && (
            <Card className="border-primary/20">
              <CardHeader className="py-3 bg-gradient-to-r from-primary/5 to-transparent">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>AI 洞察報告</span>
                  <div className="flex gap-2">
                    {metadata?.pricePosition && getPricePositionBadge(metadata.pricePosition)}
                    {metadata?.grossMarginRate !== undefined && getMarginHealthBadge(metadata.grossMarginRate)}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{report}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Historical Data Info */}
          {historicalQuotes && historicalQuotes.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              📊 已載入 {historicalQuotes.length} 筆類似容量的歷史報價作為參考
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
