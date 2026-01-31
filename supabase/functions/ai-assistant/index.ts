import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: Message[];
  currentPage: string;
  mode: "chat" | "summary" | "help";
  selectedProvider?: "gemini" | "openai" | "lovable";
  selectedModel?: string;
}

interface AISettings {
  setting_key: string;
  setting_value: string | null;
  is_enabled: boolean;
}

// Page-specific knowledge base
const PAGE_KNOWLEDGE: Record<string, string> = {
  "/": `儀表板頁面功能：
- 專案進度總覽：顯示所有專案的整體進度
- 待辦事項：需要立即處理的事項
- 風險專案：進度落後或有問題的專案
- 快速存取：常用專案的快捷入口`,

  "/projects": `專案管理頁面功能：
- 新增專案：點擊右上角「新增專案」按鈕
- 篩選專案：使用上方篩選器依狀態、投資人等條件過濾
- 批次操作：勾選多個專案後可批次更新
- 專案狀態：評估中 → 送件中 → 台電審查 → 能源局送件 → 同意備案 → 工程施工 → 報竣掛表 → 完工
- 點擊專案可查看詳細資訊`,

  "/quotes": `報價管理頁面功能：
- 建立報價：點擊「新增報價」進入報價精靈
- 報價精靈分五步驟：基本資訊 → 模組選擇 → 逆變器 → 成本報價 → 報價單產出
- 每kW單價：總報價除以裝置容量，是業界常用的價格比較指標
- AI 洞察：在報價單產出頁面可使用 AI 分析報價合理性`,

  "/documents": `文件管理頁面功能：
- 上傳文件：支援拖拉上傳或點擊選擇檔案
- 文件類型：台電函件、能源局文件、施工文件等
- 文件狀態：待提交 → 審核中 → 已核准 / 需補件
- 版本管理：同一文件可上傳多個版本`,

  "/investors": `投資人管理頁面功能：
- 新增投資人：填寫公司名稱、統編、聯絡資訊
- 投資人編碼：系統自動生成，格式為英文代碼
- 聯絡人管理：每個投資人可設定多位聯絡人
- 付款方式：可設定銀行帳戶資訊`,

  "/partners": `合作廠商管理頁面功能：
- 廠商類型：施工商、設備商、仲介等
- 聯絡人：每個廠商可設定多位聯絡人
- 工作能力：標註廠商可承接的工作類型`,
};

// Mode-specific system prompts
const MODE_PROMPTS: Record<string, string> = {
  chat: `你是 MQT Solar 太陽能專案管理系統的 AI 助理。
- 回答要簡潔實用，使用繁體中文
- 如果使用者問操作問題，給出具體步驟
- 如果需要資料分析，提供可執行的建議
- 對於不確定的問題，誠實告知可能需要查閱更多資料`,

  summary: `你是 MQT Solar 系統的資料摘要助理。
- 幫助使用者快速了解當前頁面的重要資訊
- 如果缺乏具體資料，說明該頁面的功能和用途
- 使用條列式整理重點
- 指出需要注意的事項`,

  help: `你是 MQT Solar 系統的操作指引助理。
- 專門解答如何使用系統功能
- 給出步驟式的操作說明
- 說明各個按鈕和功能的用途
- 提供常見問題的解決方案`,
};

async function getAISettings(supabaseClient: any): Promise<{
  geminiKey: string | null;
  openaiKey: string | null;
}> {
  const { data, error } = await supabaseClient
    .from('ai_settings')
    .select('setting_key, setting_value, is_enabled');
  
  if (error) {
    console.error("Failed to fetch AI settings:", error);
    return { geminiKey: null, openaiKey: null };
  }
  
  const settings = data as AISettings[];
  const geminiSetting = settings.find(s => s.setting_key === 'gemini_api_key');
  const openaiSetting = settings.find(s => s.setting_key === 'openai_api_key');
  
  return {
    geminiKey: geminiSetting?.is_enabled ? geminiSetting?.setting_value : null,
    openaiKey: openaiSetting?.is_enabled ? openaiSetting?.setting_value : null,
  };
}

// Map model ID to Gemini API model name
function getGeminiModelName(modelId: string): string {
  const mapping: Record<string, string> = {
    "google/gemini-3-flash-preview": "gemini-2.0-flash",
    "google/gemini-3-pro-preview": "gemini-2.0-flash", // fallback
    "google/gemini-2.5-pro": "gemini-1.5-pro",
    "google/gemini-2.5-flash": "gemini-1.5-flash",
    "google/gemini-2.5-flash-lite": "gemini-1.5-flash",
  };
  return mapping[modelId] || "gemini-2.0-flash";
}

async function callGemini(apiKey: string, messages: Message[], modelId?: string): Promise<string> {
  // Convert messages to Gemini format
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
  
  // Gemini doesn't support system role, so we prepend it to first user message
  const systemMsg = messages.find(m => m.role === "system");
  if (systemMsg && contents.length > 0) {
    const firstUserIdx = contents.findIndex(c => c.role === "user");
    if (firstUserIdx !== -1) {
      contents[firstUserIdx].parts[0].text = systemMsg.content + "\n\n" + contents[firstUserIdx].parts[0].text;
    }
  }
  
  const geminiModel = getGeminiModelName(modelId || "google/gemini-3-flash-preview");
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: contents.filter(c => c.role !== "system"),
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 1000,
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
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "抱歉，我無法回答這個問題。";
}

// Map model ID to OpenAI model name
function getOpenAIModelName(modelId: string): string {
  const mapping: Record<string, string> = {
    "openai/gpt-5": "gpt-4o",
    "openai/gpt-5.2": "gpt-4o",
    "openai/gpt-5-mini": "gpt-4o-mini",
    "openai/gpt-5-nano": "gpt-4o-mini",
  };
  return mapping[modelId] || "gpt-4o-mini";
}

async function callOpenAI(apiKey: string, messages: Message[], modelId?: string): Promise<string> {
  const openaiModel = getOpenAIModelName(modelId || "openai/gpt-5-mini");
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openaiModel,
      messages,
      max_tokens: 1000,
      temperature: 0.5,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "抱歉，我無法回答這個問題。";
}

async function callLovableGateway(messages: Message[], modelId?: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }
  
  // Use provided model or default
  const model = modelId || "google/gemini-3-flash-preview";
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1000,
      temperature: 0.5,
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
  return data.choices?.[0]?.message?.content || "抱歉，我無法回答這個問題。";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, currentPage, mode = "chat", selectedProvider = "lovable", selectedModel } = await req.json() as RequestBody;

    // Create Supabase client to read AI settings
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get AI settings from database
    const { geminiKey, openaiKey } = await getAISettings(supabaseClient);

    // Get page-specific knowledge
    const pageKnowledge = PAGE_KNOWLEDGE[currentPage] || 
      Object.entries(PAGE_KNOWLEDGE).find(([path]) => 
        currentPage.startsWith(path) && path !== "/"
      )?.[1] || 
      "這是 MQT Solar 太陽能專案管理系統的頁面。";

    // Build enhanced system prompt
    const modePrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.chat;
    const enhancedSystemPrompt = `${modePrompt}

【當前頁面知識庫】
${pageKnowledge}

請根據上述資訊和使用者的問題提供協助。`;

    // Replace system message with enhanced one
    const enhancedMessages = messages.map((m, idx) => {
      if (idx === 0 && m.role === "system") {
        return { ...m, content: enhancedSystemPrompt };
      }
      return m;
    });

    let content: string;
    let usedProvider = selectedProvider;
    let usedModel = selectedModel || "google/gemini-3-flash-preview";

    try {
      if (selectedProvider === "gemini" && geminiKey) {
        content = await callGemini(geminiKey, enhancedMessages, selectedModel);
      } else if (selectedProvider === "openai" && openaiKey) {
        content = await callOpenAI(openaiKey, enhancedMessages, selectedModel);
      } else {
        // Default to Lovable gateway
        content = await callLovableGateway(enhancedMessages, selectedModel);
        usedProvider = "lovable";
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      if (errorMessage === "RATE_LIMIT") {
        return new Response(JSON.stringify({ 
          error: "請求過於頻繁，請稍後再試",
          content: "抱歉，目前請求量較大。請稍待片刻後再試。"
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (errorMessage === "PAYMENT_REQUIRED") {
        return new Response(JSON.stringify({ 
          error: "AI 服務額度已用完",
          content: "抱歉，AI 服務暫時無法使用。請聯繫系統管理員。"
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Try fallback to lovable if custom API fails
      if (selectedProvider !== "lovable") {
        console.log(`${selectedProvider} API failed, falling back to Lovable gateway`);
        try {
          content = await callLovableGateway(enhancedMessages, "google/gemini-3-flash-preview");
          usedProvider = "lovable";
          usedModel = "google/gemini-3-flash-preview";
        } catch (fallbackError) {
          throw error; // Re-throw original error if fallback also fails
        }
      } else {
        throw error;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      content,
      provider: usedProvider,
      model: usedModel,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("ai-assistant error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ 
      error: errorMessage,
      content: "抱歉，發生錯誤。請稍後再試。"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
