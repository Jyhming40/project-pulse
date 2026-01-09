import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  projectId: string;
  milestoneCode: string;
  milestoneName: string;
  completedBy?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const resend = new Resend(resendApiKey);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { projectId, milestoneCode, milestoneName, completedBy }: NotificationRequest = await req.json();

    console.log(`Processing notification for milestone: ${milestoneCode} on project: ${projectId}`);

    // Check if notifications are enabled
    const { data: enabledSetting } = await supabase
      .from("milestone_notification_settings")
      .select("setting_value")
      .eq("setting_key", "notification_enabled")
      .single();

    if (!enabledSetting?.setting_value?.enabled) {
      console.log("Notifications are disabled globally");
      return new Response(
        JSON.stringify({ success: true, message: "Notifications disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this milestone has notification enabled
    const { data: milestoneConfig } = await supabase
      .from("progress_milestones")
      .select("notify_on_complete, notify_recipients, milestone_name")
      .eq("milestone_code", milestoneCode)
      .single();

    if (!milestoneConfig?.notify_on_complete) {
      console.log(`Notification not enabled for milestone: ${milestoneCode}`);
      return new Response(
        JSON.stringify({ success: true, message: "Notification not enabled for this milestone" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get project info
    const { data: project } = await supabase
      .from("projects")
      .select("id, project_code, project_name, created_by, investor_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      console.error("Project not found:", projectId);
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get investor info separately if exists
    let investor: { id: string; company_name: string; investor_code: string } | null = null;
    if (project.investor_id) {
      const { data: investorData } = await supabase
        .from("investors")
        .select("id, company_name, investor_code")
        .eq("id", project.investor_id)
        .single();
      investor = investorData;
    }

    // Get notification settings
    const { data: emailSettings } = await supabase
      .from("milestone_notification_settings")
      .select("setting_value")
      .eq("setting_key", "notification_emails")
      .single();

    const settings = emailSettings?.setting_value || {};
    const recipients: string[] = [];

    // Collect recipients based on settings
    // 1. Custom email list
    if (settings.emails && Array.isArray(settings.emails)) {
      recipients.push(...settings.emails);
    }

    // 2. Milestone-specific recipients
    if (milestoneConfig.notify_recipients && Array.isArray(milestoneConfig.notify_recipients)) {
      recipients.push(...milestoneConfig.notify_recipients);
    }

    // 3. Admin users
    if (settings.notify_admin) {
      const { data: adminUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .eq("status", "active");

      if (adminUsers) {
        for (const user of adminUsers) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", user.user_id)
            .single();
          if (profile?.email) {
            recipients.push(profile.email);
          }
        }
      }
    }

    // 4. Project creator
    if (settings.notify_project_creator && project.created_by) {
      const { data: creator } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", project.created_by)
        .single();

      if (creator?.email) {
        recipients.push(creator.email);
      }
    }

    // 5. Investor primary contact
    if (settings.notify_investor_contact && investor?.id) {
      const { data: contacts } = await supabase
        .from("investor_contacts")
        .select("email")
        .eq("investor_id", investor.id)
        .eq("is_primary", true)
        .eq("is_deleted", false)
        .limit(1);

      if (contacts && contacts.length > 0 && contacts[0].email) {
        recipients.push(contacts[0].email);
      }
    }

    // Remove duplicates and empty values
    const uniqueRecipients = [...new Set(recipients.filter(email => email && email.trim()))];

    if (uniqueRecipients.length === 0) {
      console.log("No recipients configured for notification");
      return new Response(
        JSON.stringify({ success: true, message: "No recipients configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending notification to ${uniqueRecipients.length} recipients:`, uniqueRecipients);

    // Get completer name
    let completerName = "系統";
    if (completedBy) {
      const { data: completer } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", completedBy)
        .single();
      if (completer) {
        completerName = completer.full_name || completer.email || "未知使用者";
      }
    }

    // Get app settings for branding
    const { data: appSettings } = await supabase
      .from("app_settings")
      .select("system_name_zh, company_name_zh")
      .single();

    const systemName = appSettings?.system_name_zh || "專案管理系統";
    const companyName = appSettings?.company_name_zh || "";

    // Send email
    const emailResponse = await resend.emails.send({
      from: `${systemName} <onboarding@resend.dev>`,
      to: uniqueRecipients,
      subject: `【里程碑完成】${project.project_code} - ${milestoneName || milestoneConfig.milestone_name}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎉 里程碑完成通知</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
            <div style="background: white; padding: 24px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 18px;">案場資訊</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 120px;">案場代號：</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 600;">${project.project_code}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">案場名稱：</td>
                  <td style="padding: 8px 0; color: #111827;">${project.project_name}</td>
                </tr>
                ${investor ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">投資方：</td>
                  <td style="padding: 8px 0; color: #111827;">${investor.company_name}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <div style="background: #ecfdf5; padding: 24px; border-radius: 8px; border: 1px solid #a7f3d0;">
              <h2 style="color: #065f46; margin: 0 0 16px 0; font-size: 18px;">✅ 完成的里程碑</h2>
              <p style="color: #047857; font-size: 20px; font-weight: 600; margin: 0 0 8px 0;">
                ${milestoneName || milestoneConfig.milestone_name}
              </p>
              <p style="color: #6b7280; margin: 0; font-size: 14px;">
                完成者：${completerName}<br>
                完成時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
              </p>
            </div>
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
              此郵件由 ${systemName} 自動發送${companyName ? ` - ${companyName}` : ''}
            </p>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the notification
    await supabase
      .from("milestone_notification_logs")
      .insert({
        project_id: projectId,
        milestone_code: milestoneCode,
        recipients: uniqueRecipients,
        status: "sent",
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipientCount: uniqueRecipients.length,
        emailResponse 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending milestone notification:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);