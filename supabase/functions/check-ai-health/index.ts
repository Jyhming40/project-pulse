import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface HealthCheckResult {
  provider: string;
  status: "healthy" | "error" | "no_key" | "quota_exceeded";
  message: string;
  responseTime?: number;
}

async function checkGemini(apiKey: string): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Hi" }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      }
    );
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        provider: "gemini",
        status: "healthy",
        message: "連線正常",
        responseTime,
      };
    }

    const errorData = await response.json();
    const errorMessage = errorData?.error?.message || "";
    
    if (response.status === 429 || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      return {
        provider: "gemini",
        status: "quota_exceeded",
        message: "API 額度已用盡",
        responseTime,
      };
    }

    if (response.status === 400 && errorMessage.includes("API_KEY_INVALID")) {
      return {
        provider: "gemini",
        status: "error",
        message: "API 金鑰無效",
        responseTime,
      };
    }

    return {
      provider: "gemini",
      status: "error",
      message: `錯誤 ${response.status}: ${errorMessage.substring(0, 50)}`,
      responseTime,
    };
  } catch (error) {
    return {
      provider: "gemini",
      status: "error",
      message: error instanceof Error ? error.message : "連線失敗",
    };
  }
}

async function checkOpenAI(apiKey: string): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      }),
    });
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        provider: "openai",
        status: "healthy",
        message: "連線正常",
        responseTime,
      };
    }

    const errorData = await response.json();
    const errorMessage = errorData?.error?.message || "";
    const errorCode = errorData?.error?.code || "";

    if (response.status === 429 || errorCode === "insufficient_quota" || errorMessage.includes("quota")) {
      return {
        provider: "openai",
        status: "quota_exceeded",
        message: "API 額度已用盡",
        responseTime,
      };
    }

    if (response.status === 401) {
      return {
        provider: "openai",
        status: "error",
        message: "API 金鑰無效",
        responseTime,
      };
    }

    return {
      provider: "openai",
      status: "error",
      message: `錯誤 ${response.status}: ${errorMessage.substring(0, 50)}`,
      responseTime,
    };
  } catch (error) {
    return {
      provider: "openai",
      status: "error",
      message: error instanceof Error ? error.message : "連線失敗",
    };
  }
}

async function checkLovable(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    return {
      provider: "lovable",
      status: "error",
      message: "系統金鑰未設定",
    };
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      }),
    });
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        provider: "lovable",
        status: "healthy",
        message: "連線正常",
        responseTime,
      };
    }

    if (response.status === 429) {
      return {
        provider: "lovable",
        status: "quota_exceeded",
        message: "請求過於頻繁",
        responseTime,
      };
    }

    if (response.status === 402) {
      return {
        provider: "lovable",
        status: "quota_exceeded",
        message: "額度已用盡",
        responseTime,
      };
    }

    return {
      provider: "lovable",
      status: "error",
      message: `錯誤 ${response.status}`,
      responseTime,
    };
  } catch (error) {
    return {
      provider: "lovable",
      status: "error",
      message: error instanceof Error ? error.message : "連線失敗",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider } = await req.json() as { provider?: string };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch AI settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('ai_settings')
      .select('setting_key, setting_value, is_enabled');

    if (settingsError) {
      throw new Error(`Failed to fetch settings: ${settingsError.message}`);
    }

    const geminiSetting = settings?.find((s: any) => s.setting_key === 'gemini_api_key');
    const openaiSetting = settings?.find((s: any) => s.setting_key === 'openai_api_key');

    const geminiKey = geminiSetting?.is_enabled ? geminiSetting?.setting_value : null;
    const openaiKey = openaiSetting?.is_enabled ? openaiSetting?.setting_value : null;

    const results: HealthCheckResult[] = [];

    // Check specific provider or all
    if (!provider || provider === 'lovable') {
      results.push(await checkLovable());
    }

    if (!provider || provider === 'gemini') {
      if (geminiKey) {
        results.push(await checkGemini(geminiKey));
      } else {
        results.push({
          provider: "gemini",
          status: "no_key",
          message: "未設定 API 金鑰",
        });
      }
    }

    if (!provider || provider === 'openai') {
      if (openaiKey) {
        results.push(await checkOpenAI(openaiKey));
      } else {
        results.push({
          provider: "openai",
          status: "no_key",
          message: "未設定 API 金鑰",
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("check-ai-health error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
