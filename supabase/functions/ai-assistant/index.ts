import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, currentPage, mode = "chat" } = await req.json() as RequestBody;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: enhancedMessages,
        max_tokens: 1000,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "請求過於頻繁，請稍後再試",
          content: "抱歉，目前請求量較大。請稍待片刻後再試。"
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "AI 服務額度已用完",
          content: "抱歉，AI 服務暫時無法使用。請聯繫系統管理員。"
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "抱歉，我無法回答這個問題。";

    return new Response(JSON.stringify({ 
      success: true, 
      content,
      usage: data.usage,
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
