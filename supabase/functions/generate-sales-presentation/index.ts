import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PresentationRequest {
  mode: "company" | "project" | "investor" | "market";
  data: Record<string, any>;
  companyName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, data, companyName } = (await req.json()) as PresentationRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `你是一位專業的太陽能產業業務顧問，擅長撰寫投資簡報與業務報告。
請根據提供的數據，以專業但易懂的語氣撰寫簡報文字內容。
使用繁體中文。回傳 JSON 格式。不要使用 markdown。

你的回覆必須是一個 JSON 物件，包含以下欄位：
- executive_summary: 執行摘要（2-3 段，每段 80-120 字）
- highlights: 重點亮點陣列（3-5 項，每項 30-50 字）
- analysis: 數據分析摘要（2-3 段，每段 60-100 字）
- recommendation: 建議與展望（1-2 段，每段 60-100 字）

確保內容專業、具說服力，適合向客戶或投資人簡報使用。`;

    let userPrompt = "";

    switch (mode) {
      case "company":
        userPrompt = `請根據以下公司營運數據撰寫業務簡報內容：

公司名稱：${companyName || "太陽能公司"}

營運概況：
- 專案總數：${data.totalProjects || 0} 件
- 已成案容量：${data.completedCapacity || 0} kWp（已結案/運維中）
- 進行中容量：${data.inProgressCapacity || 0} kWp
- 總申請容量：${data.totalAppliedCapacity || 0} kWp
- 已成案案件：${data.completedCount || 0} 件
- 進行中案件：${data.inProgressCount || 0} 件
- 取消/暫停案件：${data.cancelledCount || 0} 件（${data.cancelledCapacity || 0} kWp）
- 案件成案率：${data.projectConversionRate || 0}%（已成案/全部含取消暫停）
- 風險案場：${data.riskCount || 0} 件
- 平均進度：${data.avgProgress || 0}%

報價統計：
- 報價總數：${data.totalQuotes || 0} 份
- 報價成交率：${data.conversionRate || 0}%
- 本月成交：${data.closedThisMonth || 0} 件

案場類型分佈：${JSON.stringify(data.typeDistribution || {})}
地區分佈（前10）：${JSON.stringify(data.regionDistribution || {})}
年度趨勢：${JSON.stringify(data.yearlyTrend || {})}
容量級距：${JSON.stringify(data.capacityDistribution || {})}`;
        break;

      case "project":
        userPrompt = `請根據以下特定案場數據撰寫投資提案簡報：

案場名稱：${data.projectName || ""}
案場代碼：${data.projectCode || ""}
投資人：${data.investorName || ""}
裝置容量：${data.capacityKwp || 0} kWp
案場類型：${data.installationType || ""}
所在地區：${data.city || ""} ${data.district || ""}
目前狀態：${data.status || ""}
整體進度：${data.overallProgress || 0}%

報價資訊：
- 報價金額：${data.quoteAmount || 0} 元
- 每kW單價：${data.pricePerKw || 0} 元/kW
- 毛利率：${data.grossMargin || 0}%

財務預估：
- 預估年發電量：${data.annualGeneration || 0} kWh
- 預估年收益：${data.annualRevenue || 0} 元
- IRR：${data.irr || 0}%
- 回本年限：${data.paybackYears || 0} 年`;
        break;

      case "investor":
        userPrompt = `請根據以下投資人專案組合撰寫投資報告：

投資人：${data.investorName || ""}
投資人代碼：${data.investorCode || ""}

專案組合：
- 案場總數：${data.projectCount || 0} 件
- 總裝置容量：${data.totalCapacity || 0} kWp
- 平均進度：${data.avgProgress || 0}%
- 已完成案場：${data.completedCount || 0} 件

各案場明細：
${JSON.stringify(data.projects || [], null, 2)}`;
        break;

      case "market":
        userPrompt = `請根據以下市場分析數據撰寫市場趨勢簡報：

案場類型分佈：${JSON.stringify(data.typeDistribution || {})}
地區分佈：${JSON.stringify(data.regionDistribution || {})}
年度案件趨勢：${JSON.stringify(data.yearlyTrend || {})}
容量級距分佈：${JSON.stringify(data.capacityDistribution || {})}
總案場數：${data.totalProjects || 0}
總容量：${data.totalCapacity || 0} kWp`;
        break;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI 請求過於頻繁，請稍後再試" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI 額度不足，請至設定頁面加值" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Try to parse as JSON, fall back to raw text
    let parsed;
    try {
      // Remove markdown code block if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        executive_summary: content,
        highlights: [],
        analysis: "",
        recommendation: "",
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-sales-presentation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
