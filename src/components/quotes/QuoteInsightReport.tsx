import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Sparkles, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Zap,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { EngineeringCategory, BillingContext, calculateItemSubtotal } from "@/hooks/useQuoteEngineering";
import { useAIHealthCheck, AIHealthResult } from "@/hooks/useAIHealthCheck";
import { useAISettings } from "@/hooks/useAISettings";

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
    provider?: string;
  };
  error?: string;
  errorType?: string;
  failedProvider?: string;
}

type ProviderType = "gemini" | "openai" | "lovable";

const PROVIDER_LABELS: Record<ProviderType, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI ChatGPT",
  lovable: "Lovable Cloud AI",
};

// Focus area options for user selection
type FocusAreaType = "brokerage" | "margin" | "pricing" | "cost_structure" | "historical" | "equipment";

const FOCUS_AREAS: { id: FocusAreaType; label: string; description: string }[] = [
  { id: "brokerage", label: "仲介費分析", description: "仲介費合理性與議價空間" },
  { id: "margin", label: "利潤健康度", description: "毛利率風險與改善建議" },
  { id: "pricing", label: "價格競爭力", description: "每kW單價市場定位" },
  { id: "cost_structure", label: "成本結構", description: "各項成本佔比優化" },
  { id: "historical", label: "歷史比較", description: "與歷史報價趨勢比較" },
  { id: "equipment", label: "設備分析", description: "模組與逆變器成本效益" },
];

// Output format options
type OutputFormatType = "narrative" | "table" | "mixed";

const OUTPUT_FORMATS: { id: OutputFormatType; label: string; description: string }[] = [
  { id: "narrative", label: "文字敘述", description: "詳細的段落式分析報告" },
  { id: "table", label: "表格呈現", description: "結構化的表格比較資料" },
  { id: "mixed", label: "圖文混合", description: "結合表格與文字的綜合報告" },
];

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
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>("lovable");
  const [showFallbackDialog, setShowFallbackDialog] = useState(false);
  const [failedProviderInfo, setFailedProviderInfo] = useState<{ provider: string; error: string } | null>(null);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<FocusAreaType[]>([]);
  const [selectedOutputFormat, setSelectedOutputFormat] = useState<OutputFormatType>("narrative");

  const { isChecking, results: healthResults, checkHealth, getStatusForProvider } = useAIHealthCheck();
  const { defaultProvider, geminiKey, openaiKey, isLoading: isLoadingSettings } = useAISettings();

  // Set initial provider from settings
  useEffect(() => {
    if (defaultProvider?.setting_value) {
      setSelectedProvider(defaultProvider.setting_value as ProviderType);
    }
  }, [defaultProvider]);

  // Check health when sheet opens
  useEffect(() => {
    if (isOpen) {
      checkHealth();
    }
  }, [isOpen, checkHealth]);

  // Fetch historical quotes for comparison
  const { data: historicalQuotes } = useQuery({
    queryKey: ["historical-quotes", capacityKwp],
    queryFn: async () => {
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
    mutationFn: async (provider: ProviderType) => {
      const billingContext: BillingContext = {
        capacityKwp,
        pricePerKwp,
        taxRate,
      };
      
      // 傳送更詳細的類別資料，包含項目的計費方式以便 AI 識別仲介費等特殊項目
      const categoryData = categories.map(cat => ({
        categoryName: cat.categoryName,
        subtotal: cat.items.reduce((sum, item) => {
          return sum + calculateItemSubtotal(item, capacityKwp, billingContext);
        }, 0),
        items: cat.items.map(item => ({
          itemName: item.itemName,
          billingMethod: item.billingMethod,
          subtotal: calculateItemSubtotal(item, capacityKwp, billingContext),
        })),
      }));

      const historicalData = historicalQuotes?.map(q => ({
        capacityKwp: Number(q.capacity_kwp),
        pricePerKwp: Number(q.price_per_kwp),
        grossMarginRate: 0.15,
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
          selectedProvider: provider,
          allowFallback: false, // Don't auto-fallback
          focusAreas: selectedFocusAreas, // Pass user-selected focus areas
          outputFormat: selectedOutputFormat, // Pass user-selected output format
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
        setShowFallbackDialog(false);
        setFailedProviderInfo(null);
      } else if (data?.error) {
        // Show fallback dialog
        setFailedProviderInfo({
          provider: data.failedProvider || selectedProvider,
          error: data.error,
        });
        setShowFallbackDialog(true);
      }
    },
    onError: (error) => {
      console.error("Insight error:", error);
      toast.error("無法生成洞察報告，請稍後再試");
    },
  });

  const handleGenerateReport = () => {
    setReport(null);
    insightMutation.mutate(selectedProvider);
  };

  const handleUseFallback = (fallbackProvider: ProviderType) => {
    setShowFallbackDialog(false);
    setSelectedProvider(fallbackProvider);
    insightMutation.mutate(fallbackProvider);
  };

  const getHealthStatusIcon = (status: AIHealthResult["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
      case "quota_exceeded":
        return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
      case "no_key":
        return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      default:
        return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getHealthStatusLabel = (status: AIHealthResult["status"]) => {
    switch (status) {
      case "healthy":
        return "正常";
      case "quota_exceeded":
        return "額度不足";
      case "no_key":
        return "未設定";
      case "error":
        return "錯誤";
      default:
        return "未知";
    }
  };

  const isProviderAvailable = (provider: ProviderType): boolean => {
    if (provider === "lovable") return true;
    if (provider === "gemini") return geminiKey?.is_enabled && !!geminiKey?.setting_value;
    if (provider === "openai") return openaiKey?.is_enabled && !!openaiKey?.setting_value;
    return false;
  };

  const getAvailableFallbackProviders = (): ProviderType[] => {
    const providers: ProviderType[] = ["gemini", "openai", "lovable"];
    return providers.filter(p => {
      if (p === failedProviderInfo?.provider) return false;
      const health = getStatusForProvider(p);
      if (health?.status === "error" || health?.status === "quota_exceeded") return false;
      return isProviderAvailable(p);
    });
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
    <>
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
            {/* AI Model Selection */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>AI 模型選擇</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => checkHealth()}
                    disabled={isChecking}
                    className="h-7 px-2"
                  >
                    {isChecking ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={selectedProvider}
                  onValueChange={(v) => setSelectedProvider(v as ProviderType)}
                  disabled={insightMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇 AI 模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["gemini", "openai", "lovable"] as ProviderType[]).map((provider) => {
                      const health = getStatusForProvider(provider);
                      const available = isProviderAvailable(provider);
                      return (
                        <SelectItem 
                          key={provider} 
                          value={provider}
                          disabled={!available && provider !== "lovable"}
                        >
                          <div className="flex items-center gap-2">
                            <Zap className="h-3.5 w-3.5" />
                            <span>{PROVIDER_LABELS[provider]}</span>
                            {health && (
                              <span className="flex items-center gap-1 ml-2 text-xs text-muted-foreground">
                                {getHealthStatusIcon(health.status)}
                                {health.responseTime && health.status === "healthy" && (
                                  <span>{health.responseTime}ms</span>
                                )}
                              </span>
                            )}
                            {!available && provider !== "lovable" && (
                              <span className="text-xs text-muted-foreground">(未設定)</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

            {/* Health Status Display */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {(["gemini", "openai", "lovable"] as ProviderType[]).map((provider) => {
                    const health = getStatusForProvider(provider);
                    const available = isProviderAvailable(provider);
                    return (
                      <div 
                        key={provider}
                        className={`flex flex-col items-center p-2 rounded-md border ${
                          selectedProvider === provider ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                      >
                        <span className="font-medium truncate w-full text-center">
                          {provider === "gemini" ? "Gemini" : provider === "openai" ? "OpenAI" : "Lovable"}
                        </span>
                        <div className="flex items-center gap-1 mt-1">
                          {isChecking ? (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          ) : health ? (
                            <>
                              {getHealthStatusIcon(health.status)}
                              <span className={
                                health.status === "healthy" ? "text-green-600" :
                                health.status === "quota_exceeded" ? "text-amber-600" :
                                "text-muted-foreground"
                              }>
                                {getHealthStatusLabel(health.status)}
                              </span>
                            </>
                          ) : !available && provider !== "lovable" ? (
                            <>
                              <XCircle className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">未設定</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Focus Areas Selection */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">分析重點選擇（可多選）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {FOCUS_AREAS.map((area) => {
                    const isSelected = selectedFocusAreas.includes(area.id);
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => {
                          setSelectedFocusAreas(prev => 
                            isSelected 
                              ? prev.filter(a => a !== area.id)
                              : [...prev, area.id]
                          );
                        }}
                        className={`flex flex-col items-start p-2 rounded-md border text-left transition-colors ${
                          isSelected 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : 'border-border hover:border-muted-foreground/50 hover:bg-muted/50'
                        }`}
                      >
                        <span className="font-medium text-sm">{area.label}</span>
                        <span className="text-xs text-muted-foreground">{area.description}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedFocusAreas.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    已選擇 {selectedFocusAreas.length} 項重點，AI 將優先分析這些面向
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Output Format Selection */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">輸出格式</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {OUTPUT_FORMATS.map((format) => {
                    const isSelected = selectedOutputFormat === format.id;
                    return (
                      <button
                        key={format.id}
                        type="button"
                        onClick={() => setSelectedOutputFormat(format.id)}
                        className={`flex flex-col items-center p-3 rounded-md border text-center transition-colors ${
                          isSelected 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : 'border-border hover:border-muted-foreground/50 hover:bg-muted/50'
                        }`}
                      >
                        <span className="font-medium text-sm">{format.label}</span>
                        <span className="text-xs text-muted-foreground mt-1">{format.description}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

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
                  {PROVIDER_LABELS[selectedProvider]} 分析中...
                </>
              ) : report ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  重新分析
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  使用 {PROVIDER_LABELS[selectedProvider]} 生成報告
                </>
              )}
            </Button>

            {/* Report Content */}
            {report && (
              <Card className="border-primary/20">
                <CardHeader className="py-3 bg-gradient-to-r from-primary/5 to-transparent">
                  <CardTitle className="text-sm flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span>AI 洞察報告</span>
                      <div className="flex gap-2">
                        {metadata?.pricePosition && getPricePositionBadge(metadata.pricePosition)}
                        {metadata?.grossMarginRate !== undefined && getMarginHealthBadge(metadata.grossMarginRate)}
                      </div>
                    </div>
                    {metadata?.provider && (
                      <div className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                        <Sparkles className="h-3 w-3" />
                        <span>
                          由{" "}
                          {metadata.provider === "openai" && "OpenAI ChatGPT"}
                          {metadata.provider === "gemini" && "Google Gemini"}
                          {metadata.provider === "lovable" && "Lovable Cloud AI"}
                          {metadata.provider === "lovable (fallback)" && "Lovable Cloud AI (備援)"}
                          {!["openai", "gemini", "lovable", "lovable (fallback)"].includes(metadata.provider) && metadata.provider}
                          {" "}提供
                        </span>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="overflow-x-auto">
                      <ReactMarkdown
                        components={{
                          table: ({ children }) => (
                            <div className="my-4 overflow-x-auto rounded-lg border border-border">
                              <table className="w-full border-collapse text-sm min-w-[400px]">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => (
                            <thead className="bg-muted/60 dark:bg-muted/30">{children}</thead>
                          ),
                          th: ({ children }) => (
                            <th className="border-b border-border px-3 py-2.5 text-left font-semibold text-foreground whitespace-nowrap">{children}</th>
                          ),
                          td: ({ children }) => (
                            <td className="border-b border-border/50 px-3 py-2">{children}</td>
                          ),
                          tr: ({ children, ...props }) => {
                            // Check if this is in tbody by looking at children types
                            const isBodyRow = !(props as any).node?.children?.some((c: any) => c.tagName === 'th');
                            return (
                              <tr className={isBodyRow ? "even:bg-muted/30 hover:bg-muted/50 transition-colors" : ""}>
                                {children}
                              </tr>
                            );
                          },
                          // Style other markdown elements for consistency
                          p: ({ children }) => (
                            <p className="mb-3 leading-relaxed">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="mb-4 space-y-1 list-disc list-inside">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="mb-4 space-y-1 list-decimal list-inside">{children}</ol>
                          ),
                          li: ({ children }) => (
                            <li className="leading-relaxed">{children}</li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">{children}</strong>
                          ),
                          h1: ({ children }) => (
                            <h1 className="text-lg font-bold mt-4 mb-2 text-foreground">{children}</h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-base font-bold mt-4 mb-2 text-foreground">{children}</h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm font-bold mt-3 mb-1.5 text-foreground">{children}</h3>
                          ),
                        }}
                      >
                        {report}
                      </ReactMarkdown>
                    </div>
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

      {/* Fallback Dialog */}
      <AlertDialog open={showFallbackDialog} onOpenChange={setShowFallbackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              AI 模型無法使用
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                <strong>{PROVIDER_LABELS[failedProviderInfo?.provider as ProviderType] || failedProviderInfo?.provider}</strong> 目前無法使用：
              </p>
              <p className="text-sm bg-muted p-2 rounded-md">
                {failedProviderInfo?.error}
              </p>
              <p>您可以選擇其他可用的 AI 模型繼續分析：</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-4">
            {getAvailableFallbackProviders().map((provider) => {
              const health = getStatusForProvider(provider);
              return (
                <Button
                  key={provider}
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => handleUseFallback(provider)}
                >
                  {getHealthStatusIcon(health?.status || "healthy")}
                  <span>{PROVIDER_LABELS[provider]}</span>
                  {health?.responseTime && (
                    <span className="text-xs text-muted-foreground ml-auto">{health.responseTime}ms</span>
                  )}
                </Button>
              );
            })}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
