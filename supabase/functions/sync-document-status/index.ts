import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 文件狀態連動 Edge Function
 * 
 * 規則：
 * 1. 同意備案 (MOEA_CONSENT) issued_at 設定 → 案場狀態改為「同意備案」，設定 approval_date
 * 2. 躉購合約 (TPC_CONTRACT) issued_at 設定 → 觸發相關里程碑完成
 * 3. 正式躉售 (TPC_OFFICIAL_FIT) issued_at 設定 → 案場狀態改為「運維中」
 */

interface DocumentUpdate {
  documentId: string;
  docTypeCode: string;
  docType: string;
  projectId: string;
  issuedAt: string | null;
  submittedAt: string | null;
  previousIssuedAt?: string | null;
}

interface LinkageResult {
  rule: string;
  success: boolean;
  message: string;
  changes?: Record<string, unknown>;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授權' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '驗證失敗' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: DocumentUpdate = await req.json();
    const { documentId, docTypeCode, docType, projectId, issuedAt, previousIssuedAt } = body;

    if (!documentId || !projectId) {
      return new Response(
        JSON.stringify({ error: '缺少必要參數' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip if issued_at was not changed (from null to a value)
    const isNewlyIssued = issuedAt && !previousIssuedAt;
    if (!isNewlyIssued) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: '無需連動（非新核發）',
          linkages: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const linkages: LinkageResult[] = [];
    const effectiveCode = docTypeCode || docType;

    console.log(`[SyncDocStatus] Processing: ${effectiveCode} for project ${projectId}`);

    // Rule 1: 同意備案 → 案場狀態「同意備案」+ approval_date
    if (effectiveCode === 'MOEA_CONSENT' || docType === '同意備案') {
      try {
        const { error } = await supabase
          .from('projects')
          .update({
            status: '同意備案',
            approval_date: issuedAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);

        if (error) throw error;

        // Log audit
        await supabase.from('audit_logs').insert({
          action: 'UPDATE',
          record_id: projectId,
          table_name: 'projects',
          actor_user_id: user.id,
          new_data: {
            trigger: 'document_status_sync',
            rule: 'MOEA_CONSENT_issued',
            document_id: documentId,
            status: '同意備案',
            approval_date: issuedAt,
          },
        });

        linkages.push({
          rule: '同意備案 → 案場狀態',
          success: true,
          message: '案場狀態已更新為「同意備案」',
          changes: { status: '同意備案', approval_date: issuedAt },
        });

        console.log(`[SyncDocStatus] Rule 1 applied: status → 同意備案`);
      } catch (err) {
        const error = err as Error;
        linkages.push({
          rule: '同意備案 → 案場狀態',
          success: false,
          message: error.message,
        });
      }
    }

    // Rule 2: 躉購合約 → 完成相關里程碑
    if (effectiveCode === 'TPC_CONTRACT' || docType === '躉購合約' || docType === '台電躉售合約') {
      try {
        // Mark TPC_CONTRACT milestone as completed
        const { data: existingMilestone } = await supabase
          .from('project_milestones')
          .select('id, is_completed')
          .eq('project_id', projectId)
          .eq('milestone_code', 'TPC_CONTRACT')
          .single();

        if (existingMilestone && !existingMilestone.is_completed) {
          await supabase
            .from('project_milestones')
            .update({
              is_completed: true,
              completed_at: new Date().toISOString(),
              completed_by: user.id,
            })
            .eq('id', existingMilestone.id);

          linkages.push({
            rule: '躉購合約 → 里程碑完成',
            success: true,
            message: '躉購合約里程碑已標記完成',
            changes: { milestone: 'TPC_CONTRACT', is_completed: true },
          });
        } else if (!existingMilestone) {
          // Create new milestone record
          await supabase.from('project_milestones').insert({
            project_id: projectId,
            milestone_code: 'TPC_CONTRACT',
            is_completed: true,
            completed_at: new Date().toISOString(),
            completed_by: user.id,
          });

          linkages.push({
            rule: '躉購合約 → 里程碑建立',
            success: true,
            message: '躉購合約里程碑已建立並標記完成',
          });
        }

        console.log(`[SyncDocStatus] Rule 2 applied: TPC_CONTRACT milestone`);
      } catch (err) {
        const error = err as Error;
        linkages.push({
          rule: '躉購合約 → 里程碑',
          success: false,
          message: error.message,
        });
      }
    }

    // Rule 3: 正式躉售 → 案場狀態「運維中」
    if (effectiveCode === 'TPC_OFFICIAL_FIT' || docType === '正式躉售' || docType === '台電正式躉售') {
      try {
        const { error } = await supabase
          .from('projects')
          .update({
            status: '運維中',
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);

        if (error) throw error;

        // Also update construction_status to completed
        await supabase
          .from('projects')
          .update({
            construction_status: '已完工',
          })
          .eq('id', projectId);

        // Log audit
        await supabase.from('audit_logs').insert({
          action: 'UPDATE',
          record_id: projectId,
          table_name: 'projects',
          actor_user_id: user.id,
          new_data: {
            trigger: 'document_status_sync',
            rule: 'TPC_OFFICIAL_FIT_issued',
            document_id: documentId,
            status: '運維中',
            construction_status: '已完工',
          },
        });

        linkages.push({
          rule: '正式躉售 → 運維狀態',
          success: true,
          message: '案場已進入運維階段',
          changes: { status: '運維中', construction_status: '已完工' },
        });

        console.log(`[SyncDocStatus] Rule 3 applied: status → 運維中`);
      } catch (err) {
        const error = err as Error;
        linkages.push({
          rule: '正式躉售 → 運維狀態',
          success: false,
          message: error.message,
        });
      }
    }

    // Trigger progress recalculation if any linkage was applied
    if (linkages.some(l => l.success)) {
      try {
        const recalcUrl = `${supabaseUrl}/functions/v1/recalculate-project-progress`;
        await fetch(recalcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({ projectId }),
        });
        console.log(`[SyncDocStatus] Progress recalculation triggered`);
      } catch (err) {
        console.error('[SyncDocStatus] Progress recalc failed:', err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: linkages.length > 0 ? '文件狀態連動完成' : '無適用的連動規則',
        linkages,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('[SyncDocStatus] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || '處理失敗' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
