import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface AISettings {
  setting_key: string;
  setting_value: string | null;
  is_enabled: boolean;
}

async function getAISettings(supabaseClient: any): Promise<{
  provider: string;
  geminiKey: string | null;
  openaiKey: string | null;
}> {
  const { data, error } = await supabaseClient
    .from('ai_settings')
    .select('setting_key, setting_value, is_enabled');
  
  if (error) {
    console.error("Failed to fetch AI settings:", error);
    return { provider: 'lovable', geminiKey: null, openaiKey: null };
  }
  
  const settings = data as AISettings[];
  const defaultProvider = settings.find(s => s.setting_key === 'default_ai_provider');
  const geminiSetting = settings.find(s => s.setting_key === 'gemini_api_key');
  const openaiSetting = settings.find(s => s.setting_key === 'openai_api_key');
  
  const geminiKey = geminiSetting?.is_enabled ? geminiSetting?.setting_value : null;
  const openaiKey = openaiSetting?.is_enabled ? openaiSetting?.setting_value : null;
  
  let provider = defaultProvider?.setting_value || 'gemini';
  
  // If selected provider has no key, try the other one, fallback to lovable
  if (provider === 'gemini' && !geminiKey) {
    provider = openaiKey ? 'openai' : 'lovable';
  } else if (provider === 'openai' && !openaiKey) {
    provider = geminiKey ? 'gemini' : 'lovable';
  }
  
  return { provider, geminiKey, openaiKey };
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1500,
        },
      }),
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "無法生成洞察報告";
}

async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "無法生成洞察報告";
}

async function callLovableGateway(systemPrompt: string, userPrompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }
  
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
      throw new Error("RATE_LIMIT");
    }
    if (response.status === 402) {
      throw new Error("PAYMENT_REQUIRED");
    }
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error("AI gateway error");
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "無法生成洞察報告";
}

// Focus area definitions
const FOCUS_AREA_PROMPTS: Record<string, string> = {
  brokerage: "特別分析仲介費的合理性與佔比，比較市場行情，評估是否有議價空間",
  margin: "深入分析毛利率健康度，與同類案場比較，指出利潤風險與改善建議",
  pricing: "著重分析每kW單價的市場競爭力，與台灣當前市場行情比較定位",
  cost_structure: "詳細分析各項成本結構佔比是否合理，找出可能的成本優化空間",
  historical: "與歷史報價深度比較，分析價格與利潤趨勢變化",
  equipment: "分析模組與逆變器的價格合理性，評估設備選型與成本效益",
};

// Output format instructions
const OUTPUT_FORMAT_PROMPTS: Record<string, string> = {
  narrative: `請以詳細的段落文字敘述方式呈現報告，每個洞察點用 emoji 開頭，使用流暢的敘述語氣進行分析。`,
  table: `請盡量使用 Markdown 表格呈現報告，包含：
1. 成本結構比較表（項目、金額、佔比、市場參考）
2. 關鍵指標摘要表（指標、數值、評估、建議）
3. 風險評估表（風險項目、等級、說明）
每個表格後可加簡短說明。`,
  mixed: `請使用圖文混合方式呈現報告：
1. 先用一個總覽表格列出關鍵數據
2. 再用段落文字詳細分析重點項目
3. 最後用一個風險/建議表格總結
結合表格的結構性與文字的詳細說明。`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quoteData, selectedProvider, allowFallback = false, focusAreas = [], outputFormat = "narrative" } = await req.json() as { 
      quoteData: QuoteData;
      selectedProvider?: string;
      allowFallback?: boolean;
      focusAreas?: string[];
      outputFormat?: string;
    };
    
    // Log parameters for debugging
    console.log(`Received focusAreas: ${JSON.stringify(focusAreas)}, outputFormat: ${outputFormat}`);
    
    // Create Supabase client with service role to read AI settings
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get AI settings from database
    const { provider: defaultProvider, geminiKey, openaiKey } = await getAISettings(supabaseClient);
    
    // Use selected provider if specified, otherwise use default
    let provider = selectedProvider || defaultProvider;
    console.log(`Using AI provider: ${provider} (selected: ${selectedProvider}, default: ${defaultProvider})`);

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

    // Build focus area instructions
    let focusInstructions = "";
    if (focusAreas && focusAreas.length > 0) {
      console.log(`Building focus instructions for areas: ${JSON.stringify(focusAreas)}`);
      const focusPrompts = focusAreas
        .filter(area => FOCUS_AREA_PROMPTS[area])
        .map(area => {
          console.log(`Adding focus area: ${area} -> ${FOCUS_AREA_PROMPTS[area]}`);
          return `- ${FOCUS_AREA_PROMPTS[area]}`;
        });
      
      if (focusPrompts.length > 0) {
        focusInstructions = `

【重要分析重點 - 請務必詳細分析以下主題】
${focusPrompts.join('\n')}

請在報告中針對上述每個分析重點，提供獨立的段落進行深入分析。`;
        console.log(`Focus instructions built: ${focusInstructions}`);
      }
    }

    // Build output format instructions
    const formatInstructions = OUTPUT_FORMAT_PROMPTS[outputFormat] || OUTPUT_FORMAT_PROMPTS.narrative;
    
    const systemPrompt = `你是一位資深太陽能光電產業報價分析師，專精於台灣市場的成本分析與投資評估。請根據提供的報價數據，提供簡潔專業的洞察報告。

【輸出格式要求】
${formatInstructions}

【基本規範】
1. 使用繁體中文
2. 提供 3-5 點關鍵洞察
3. 洞察需具體、可執行，避免籠統建議
4. 若發現異常指標，請明確指出風險等級（高/中/低）
5. 最後總結一句報價合理性評估${focusInstructions}`;

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

    let content: string;
    let usedProvider = provider;
    let providerError: string | null = null;
    
    try {
      if (provider === 'gemini' && geminiKey) {
        content = await callGemini(geminiKey, systemPrompt, userPrompt);
      } else if (provider === 'openai' && openaiKey) {
        content = await callOpenAI(openaiKey, systemPrompt, userPrompt);
      } else if (provider === 'lovable') {
        content = await callLovableGateway(systemPrompt, userPrompt);
      } else {
        // No valid key for selected provider
        providerError = `所選的 AI 模型 (${provider}) 尚未設定 API 金鑰`;
        
        if (!allowFallback) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: providerError,
            errorType: 'NO_API_KEY',
            failedProvider: provider,
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // Fallback to lovable if allowed
        content = await callLovableGateway(systemPrompt, userPrompt);
        usedProvider = 'lovable (fallback)';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      if (errorMessage === "RATE_LIMIT") {
        providerError = `${provider === 'gemini' ? 'Google Gemini' : provider === 'openai' ? 'OpenAI' : 'Lovable AI'} 請求過於頻繁或額度已用完`;
        
        if (!allowFallback) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: providerError,
            errorType: 'RATE_LIMIT',
            failedProvider: provider,
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      
      if (errorMessage === "PAYMENT_REQUIRED") {
        providerError = `${provider === 'lovable' ? 'Lovable AI' : provider} 額度已用完，請聯繫管理員`;
        
        if (!allowFallback) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: providerError,
            errorType: 'PAYMENT_REQUIRED',
            failedProvider: provider,
          }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      
      // Try fallback to lovable gateway if allowed and custom API fails
      if (allowFallback && provider !== 'lovable') {
        console.log(`${provider} API failed, falling back to Lovable gateway`);
        try {
          content = await callLovableGateway(systemPrompt, userPrompt);
          usedProvider = 'lovable (fallback)';
        } catch (fallbackError) {
          const fbErrorMsg = fallbackError instanceof Error ? fallbackError.message : "Unknown error";
          return new Response(JSON.stringify({ 
            success: false, 
            error: "所有 AI 服務暫時無法使用",
            errorType: 'ALL_FAILED',
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (!allowFallback) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: providerError || `${provider} API 呼叫失敗`,
          errorType: 'API_ERROR',
          failedProvider: provider,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "AI 服務暫時無法使用",
          errorType: 'API_ERROR',
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      report: content,
      metadata: {
        pricePosition,
        grossMarginRate: quoteData.grossMarginRate,
        hasHistoricalData: !!quoteData.historicalQuotes?.length,
        provider: usedProvider,
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
