import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received notification email request");
    
    const { to, subject, html, text, from, replyTo }: NotificationEmailRequest = await req.json();

    // Validate required fields
    if (!to || !subject) {
      console.error("Missing required fields: to or subject");
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!html && !text) {
      console.error("Missing email content: html or text required");
      return new Response(
        JSON.stringify({ error: "Missing email content: html or text required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Build email options
    const emailOptions: any = {
      from: from || "系統通知 <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : [to],
      subject: subject,
    };

    if (html) {
      emailOptions.html = html;
    }
    if (text) {
      emailOptions.text = text;
    }
    if (replyTo) {
      emailOptions.reply_to = replyTo;
    }

    // Send email via Resend
    const emailResponse = await resend.emails.send(emailOptions);

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-notification-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
