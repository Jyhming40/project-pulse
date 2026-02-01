import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InvestmentReportData {
  projectName: string;
  projectLocation: string;
  capacityKwp: number;
  pricePerKwp: number;
  totalInvestment: number;
  revenueMode: 'self_consumption' | 'feed_in_tariff';
  gridConnectionType: 'internal' | 'external';
  investmentMode: 'self_owned' | 'rental_investment';
  tariffRate: number;
  sunshineHours: number;
  sunshineDays: number;
  insuranceRate: number;
  projections: Array<{
    year: number;
    generationKwh: number;
    revenue: number;
    maintenanceCost: number;
    insuranceCost: number;
    rentCost: number;
    cashFlow: number;
    cumulativeCashFlow: number;
  }>;
  summary: {
    totalGeneration: number;
    totalRevenue: number;
    totalMaintenance: number;
    totalInsurance: number;
    totalRent: number;
    totalCost: number;
    netProfit: number;
    irr: number;
    paybackYear: number;
    costPerKwh: number;
  };
  trecEstimation?: {
    certificateCount: number;
    scenarios: {
      conservative: { totalRevenue: number };
      baseline: { totalRevenue: number };
      optimistic: { totalRevenue: number };
    };
  };
  sensitivityAnalysis?: Array<{
    growthRate: number;
    irr: number;
    label: string;
  }>;
}

async function generateAIContent(
  data: InvestmentReportData,
  contentType: 'opening' | 'summary' | 'risk'
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not configured, using fallback content");
    return getFallbackContent(data, contentType);
  }

  const systemPrompt = getSystemPrompt(contentType);
  const userPrompt = getUserPrompt(data, contentType);

  try {
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
        max_tokens: 800,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      console.error(`AI API error: ${response.status}`);
      return getFallbackContent(data, contentType);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || getFallbackContent(data, contentType);
  } catch (error) {
    console.error("AI generation error:", error);
    return getFallbackContent(data, contentType);
  }
}

function getSystemPrompt(contentType: string): string {
  const prompts: Record<string, string> = {
    opening: `你是一位專業的太陽能投資顧問，請為客戶撰寫一段溫和專業的投資評估報告開場白。
風格要求：
- 使用繁體中文
- 專業但親切的語氣
- 2-3 段，約 150-200 字
- 強調太陽能投資的長期價值與環境效益
- 根據案場資訊客製化開場`,
    
    summary: `你是一位資深太陽能投資分析師，請根據財務數據撰寫投資建議摘要。
風格要求：
- 使用繁體中文
- 專業且具說服力
- 2-3 點核心建議
- 約 100-150 字
- 用數據支持建議`,
    
    risk: `你是一位太陽能產業風險評估專家，請分析投資風險並提供應對建議。
風格要求：
- 使用繁體中文
- 客觀分析風險等級（高/中/低）
- 列出 2-3 個主要風險點
- 每個風險附帶簡短應對建議
- 約 100-150 字`,
  };
  
  return prompts[contentType] || prompts.summary;
}

function getUserPrompt(data: InvestmentReportData, contentType: string): string {
  const modeLabels = {
    revenueMode: data.revenueMode === 'feed_in_tariff' ? '躉售電力' : '自用節電',
    gridType: data.gridConnectionType === 'internal' ? '併內線' : '併外線',
    investMode: data.investmentMode === 'self_owned' ? '自有場地' : '租賃投資',
  };

  const baseInfo = `
案場名稱：${data.projectName || '太陽能發電系統'}
案場位置：${data.projectLocation || '台灣'}
裝置容量：${data.capacityKwp} kWp
收益模式：${modeLabels.revenueMode}
併網類型：${modeLabels.gridType}
投資模式：${modeLabels.investMode}
總投資金額：${data.totalInvestment.toLocaleString()} 元
預估 IRR：${data.summary.irr.toFixed(2)}%
回收年限：${data.summary.paybackYear} 年
20年淨利：${data.summary.netProfit.toLocaleString()} 元
`;

  if (contentType === 'opening') {
    return `請為以下太陽能投資案場撰寫專業的報告開場白：\n${baseInfo}`;
  } else if (contentType === 'summary') {
    return `請根據以下數據撰寫投資建議摘要：\n${baseInfo}
電價/躉購費率：${data.tariffRate} 元/度
每度電成本：${data.summary.costPerKwh.toFixed(2)} 元
20年總發電量：${data.summary.totalGeneration.toLocaleString()} 度`;
  } else {
    return `請分析以下投資案的風險因素：\n${baseInfo}
日照時數假設：${data.sunshineHours} 小時/天
日照天數假設：${data.sunshineDays} 天/年
${data.investmentMode === 'rental_investment' ? `租金成本佔比：${((data.summary.totalRent / data.summary.totalRevenue) * 100).toFixed(1)}%` : ''}`;
  }
}

function getFallbackContent(data: InvestmentReportData, contentType: string): string {
  const fallbacks: Record<string, string> = {
    opening: `感謝您選擇評估太陽能光電投資方案。本報告針對「${data.projectName || '太陽能發電系統'}」進行 20 年期的投資收益分析，涵蓋發電量預估、維運成本計算與財務指標評估。

太陽能光電系統不僅能為您創造穩定的長期收益，更是實踐永續發展、善盡企業社會責任的具體行動。以下分析將協助您全面了解本案場的投資價值與預期回報。`,
    
    summary: `📊 本案場預估內部報酬率 (IRR) 為 ${data.summary.irr.toFixed(2)}%，投資回收期約 ${data.summary.paybackYear} 年。

💡 建議：${data.summary.irr >= 8 ? '本案財務指標健康，具有良好的投資價值。' : '建議進一步評估成本優化空間，以提升整體投資效益。'}`,
    
    risk: `⚠️ 風險評估：

1. **天候風險 (中)**：實際日照可能低於預估，建議採用保守假設進行試算。

2. **電價波動風險 (${data.revenueMode === 'feed_in_tariff' ? '低' : '中'})**：${data.revenueMode === 'feed_in_tariff' ? '躉購費率鎖定 20 年，風險可控。' : '電價可能隨政策調整，建議關注電價趨勢。'}

3. **設備維護風險 (低)**：選用優質設備並簽訂維運合約可有效降低風險。`,
  };
  
  return fallbacks[contentType] || fallbacks.summary;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportData, includeAI = true } = await req.json() as {
      reportData: InvestmentReportData;
      includeAI?: boolean;
    };

    console.log(`Generating investment report for: ${reportData.projectName || 'Unknown project'}`);

    // Generate AI content in parallel if enabled
    let openingText = "";
    let summaryText = "";
    let riskText = "";

    if (includeAI) {
      const [opening, summary, risk] = await Promise.all([
        generateAIContent(reportData, 'opening'),
        generateAIContent(reportData, 'summary'),
        generateAIContent(reportData, 'risk'),
      ]);
      openingText = opening;
      summaryText = summary;
      riskText = risk;
    } else {
      openingText = getFallbackContent(reportData, 'opening');
      summaryText = getFallbackContent(reportData, 'summary');
      riskText = getFallbackContent(reportData, 'risk');
    }

    return new Response(
      JSON.stringify({
        success: true,
        content: {
          opening: openingText,
          summary: summaryText,
          risk: riskText,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Generate investment report error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
