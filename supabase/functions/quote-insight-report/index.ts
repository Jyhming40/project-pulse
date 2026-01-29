import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface QuoteData {
  capacityKwp: number;
  pricePerKwp: number;
  taxRate: number;
  totalCost: number;
  engineeringTotal: number;
  modulesTotal: number;
  invertersTotal: number;
  grossMargin: number;
  grossMarginRate: number;
  categories: Array<{
    categoryName: string;
    subtotal: number;
  }>;
  historicalQuotes?: Array<{
    capacityKwp: number;
    pricePerKwp: number;
    grossMarginRate: number;
    createdAt: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quoteData } = await req.json() as { quoteData: QuoteData };
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Calculate cost breakdown percentages
    const totalCost = quoteData.totalCost || 1;
    const engineeringPercent = ((quoteData.engineeringTotal / totalCost) * 100).toFixed(1);
    const modulesPercent = ((quoteData.modulesTotal / totalCost) * 100).toFixed(1);
    const invertersPercent = ((quoteData.invertersTotal / totalCost) * 100).toFixed(1);
    
    // Category breakdown
    const categoryBreakdown = quoteData.categories
      .filter(c => c.subtotal > 0)
      .map(c => `- ${c.categoryName}: $${c.subtotal.toLocaleString()} (${((c.subtotal / totalCost) * 100).toFixed(1)}%)`)
      .join('\n');

    // Historical comparison context
    let historyContext = "";
    if (quoteData.historicalQuotes && quoteData.historicalQuotes.length > 0) {
      const avgHistoricalPrice = quoteData.historicalQuotes.reduce((sum, q) => sum + q.pricePerKwp, 0) / quoteData.historicalQuotes.length;
      const avgHistoricalMargin = quoteData.historicalQuotes.reduce((sum, q) => sum + q.grossMarginRate, 0) / quoteData.historicalQuotes.length;
      const priceDiff = ((quoteData.pricePerKwp - avgHistoricalPrice) / avgHistoricalPrice * 100).toFixed(1);
      const marginDiff = (quoteData.grossMarginRate - avgHistoricalMargin).toFixed(1);
      
      historyContext = `
歷史報價比較（${quoteData.historicalQuotes.length} 筆類似容量案場）：
- 歷史平均每kW單價：$${avgHistoricalPrice.toLocaleString()}
- 本次每kW單價：$${quoteData.pricePerKwp.toLocaleString()} (${Number(priceDiff) >= 0 ? '+' : ''}${priceDiff}%)
- 歷史平均毛利率：${(avgHistoricalMargin * 100).toFixed(1)}%
- 本次毛利率：${(quoteData.grossMarginRate * 100).toFixed(1)}% (${Number(marginDiff) >= 0 ? '+' : ''}${marginDiff}%)`;
    }

    // Market reference context (Taiwan solar market 2024-2025)
    const marketLowPrice = 38000; // Lower bound for 100kW+
    const marketHighPrice = 55000; // Upper bound for smaller systems
    const pricePosition = quoteData.pricePerKwp < marketLowPrice ? "低於市場" : 
                         quoteData.pricePerKwp > marketHighPrice ? "高於市場" : "市場區間內";

    const systemPrompt = `你是一位資深太陽能光電產業報價分析師，專精於台灣市場的成本分析與投資評估。請根據提供的報價數據，提供簡潔專業的洞察報告。

輸出格式要求：
1. 使用繁體中文
2. 提供 3-5 點關鍵洞察
3. 每點用 emoji 開頭使報告易讀
4. 洞察需具體、可執行，避免籠統建議
5. 若發現異常指標，請明確指出風險等級（高/中/低）
6. 最後總結一句報價合理性評估`;

    const userPrompt = `請分析以下太陽能光電專案報價：

【案場規格】
- 裝置容量：${quoteData.capacityKwp} kWp
- 每kW未稅報價：$${quoteData.pricePerKwp.toLocaleString()}
- 稅率：${(quoteData.taxRate * 100).toFixed(0)}%

【成本結構】
- 總成本：$${totalCost.toLocaleString()}
- 工程費用：$${quoteData.engineeringTotal.toLocaleString()} (${engineeringPercent}%)
- 模組費用：$${quoteData.modulesTotal.toLocaleString()} (${modulesPercent}%)
- 逆變器費用：$${quoteData.invertersTotal.toLocaleString()} (${invertersPercent}%)

工程明細：
${categoryBreakdown || '無明細資料'}

【利潤指標】
- 毛利金額：$${quoteData.grossMargin.toLocaleString()}
- 毛利率：${(quoteData.grossMarginRate * 100).toFixed(1)}%
${historyContext}

【市場參考】
- 台灣當前市場每kW報價區間：$${marketLowPrice.toLocaleString()} ~ $${marketHighPrice.toLocaleString()}
- 本案價格定位：${pricePosition}

請提供專業洞察報告：`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI 服務請求過於頻繁，請稍後再試。" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI 服務額度已用完，請聯繫管理員。" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI 服務暫時無法使用" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "無法生成洞察報告";

    return new Response(JSON.stringify({ 
      success: true, 
      report: content,
      metadata: {
        pricePosition,
        grossMarginRate: quoteData.grossMarginRate,
        hasHistoricalData: !!quoteData.historicalQuotes?.length,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("quote-insight-report error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
