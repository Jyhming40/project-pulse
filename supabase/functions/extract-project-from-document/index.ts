import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `你是一個太陽能案場文件辨識專家。使用者會上傳台電函文、同意備案函、審查意見書等官方文件的圖片。
請從文件中盡可能提取以下欄位資訊，以 JSON 格式回傳。若文件中找不到某個欄位的資訊，該欄位請設為 null。

注意事項：
- 容量通常以 kW 或 kWp 表示
- 地址可能包含縣市、區/鄉/鎮、詳細地址
- 台電 PV 編號格式通常為英數組合
- 饋線代號通常為英文字母加數字的組合
- 案場名稱可能出現在文件標題或正文中
- 併聯方式可能為「低壓」或「高壓」
- 供電電壓可能為「110V」「220V」「380V」「11.4kV」「22.8kV」等

回傳格式嚴格遵守以下 JSON 結構，不要加任何額外文字：`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "請從這份文件中提取太陽能案場相關資訊。",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_project_data",
                description:
                  "Extract solar project data from an official document image",
                parameters: {
                  type: "object",
                  properties: {
                    project_name: {
                      type: "string",
                      description: "案場名稱",
                    },
                    capacity_kwp: {
                      type: "number",
                      description: "裝置容量 (kWp)",
                    },
                    actual_installed_capacity: {
                      type: "number",
                      description: "實際裝置容量 (kWp)",
                    },
                    city: {
                      type: "string",
                      description:
                        "縣市（如台南市、高雄市等，需包含「市」或「縣」）",
                    },
                    district: {
                      type: "string",
                      description: "區/鄉/鎮",
                    },
                    address: {
                      type: "string",
                      description: "完整地址（不含縣市和區）",
                    },
                    feeder_code: {
                      type: "string",
                      description: "饋線代號",
                    },
                    taipower_pv_id: {
                      type: "string",
                      description: "台電 PV 編號",
                    },
                    grid_connection_type: {
                      type: "string",
                      description: "併聯方式（低壓/高壓）",
                    },
                    power_voltage: {
                      type: "string",
                      description: "供電電壓",
                    },
                    land_owner: {
                      type: "string",
                      description: "承租/所有權人",
                    },
                    land_owner_contact: {
                      type: "string",
                      description: "所有權人聯絡方式",
                    },
                    contact_person: {
                      type: "string",
                      description: "聯絡人",
                    },
                    contact_phone: {
                      type: "string",
                      description: "聯絡電話",
                    },
                    note: {
                      type: "string",
                      description:
                        "其他在文件中發現但無法歸類到上述欄位的重要資訊",
                    },
                  },
                  required: [],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_project_data" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI 服務請求過於頻繁，請稍後再試" }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI 額度不足，請聯繫管理員" }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI 辨識服務異常" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await response.json();

    // Extract tool call result
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    let extractedData = {};

    if (toolCall?.function?.arguments) {
      try {
        extractedData =
          typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
      } catch {
        console.error(
          "Failed to parse tool call arguments:",
          toolCall.function.arguments
        );
      }
    }

    // Clean null values
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(extractedData as Record<string, any>)) {
      if (value !== null && value !== undefined && value !== "") {
        cleaned[key] = value;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        extractedData: cleaned,
        fieldsFound: Object.keys(cleaned).length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("extract-project-from-document error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
