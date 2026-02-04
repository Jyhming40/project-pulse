import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 文件狀態連動 Edge Function
 * 
 * 從資料庫讀取連動規則並執行
 */

interface DocumentUpdate {
  documentId: string;
  docTypeCode: string;
  docType: string;
  projectId: string;
  issuedAt: string | null;
  submittedAt: string | null;
  previousIssuedAt?: string | null;
  previousSubmittedAt?: string | null;
}

interface LinkageRule {
  id: string;
  rule_name: string;
  trigger_doc_type_code: string;
  trigger_field: 'issued_at' | 'submitted_at';
  trigger_condition: 'set_new' | 'any_change';
  target_type: 'project_status' | 'construction_status' | 'milestone' | 'project_field' | 'document_field';
  target_value: string | null;
  target_field: string | null;
  use_trigger_value: boolean;
  is_active: boolean;
}

/**
 * Parse target_value for document_field type
 * Format: "DOC_TYPE_CODE:+N" where N is days offset
 * Example: "ENG_ELECTRICAL:+14" means set ENG_ELECTRICAL's field to trigger date + 14 days
 */
function parseDocumentFieldTarget(targetValue: string): { docTypeCode: string; daysOffset: number } | null {
  if (!targetValue) return null;
  
  const match = targetValue.match(/^([A-Z_]+):([+-]?\d+)$/);
  if (!match) return null;
  
  return {
    docTypeCode: match[1],
    daysOffset: parseInt(match[2], 10),
  };
}

/**
 * Calculate date with offset
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

interface LinkageResult {
  rule: string;
  success: boolean;
  message: string;
  changes?: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
async function applyRule(
  supabase: any,
  rule: LinkageRule,
  projectId: string,
  documentId: string,
  triggerValue: string,
  userId: string,
  linkages: LinkageResult[]
): Promise<void> {
  try {
    switch (rule.target_type) {
      case 'project_status': {
        const { error } = await supabase
          .from('projects')
          .update({
            status: rule.target_value,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);

        if (error) throw error;

        // Log audit
        await supabase.from('audit_logs').insert({
          action: 'UPDATE',
          record_id: projectId,
          table_name: 'projects',
          actor_user_id: userId,
          new_data: {
            trigger: 'document_linkage_rule',
            rule_id: rule.id,
            rule_name: rule.rule_name,
            document_id: documentId,
            status: rule.target_value,
          },
        });

        linkages.push({
          rule: rule.rule_name,
          success: true,
          message: `案場狀態已更新為「${rule.target_value}」`,
          changes: { status: rule.target_value },
        });
        break;
      }

      case 'construction_status': {
        const { error } = await supabase
          .from('projects')
          .update({
            construction_status: rule.target_value,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          action: 'UPDATE',
          record_id: projectId,
          table_name: 'projects',
          actor_user_id: userId,
          new_data: {
            trigger: 'document_linkage_rule',
            rule_id: rule.id,
            rule_name: rule.rule_name,
            document_id: documentId,
            construction_status: rule.target_value,
          },
        });

        linkages.push({
          rule: rule.rule_name,
          success: true,
          message: `工程狀態已更新為「${rule.target_value}」`,
          changes: { construction_status: rule.target_value },
        });
        break;
      }

      case 'milestone': {
        const milestoneCode = rule.target_value;
        if (!milestoneCode) break;

        const { data: existingMilestone } = await supabase
          .from('project_milestones')
          .select('id, is_completed')
          .eq('project_id', projectId)
          .eq('milestone_code', milestoneCode)
          .maybeSingle();

        if (existingMilestone && !existingMilestone.is_completed) {
          await supabase
            .from('project_milestones')
            .update({
              is_completed: true,
              completed_at: new Date().toISOString(),
              completed_by: userId,
            })
            .eq('id', existingMilestone.id);

          linkages.push({
            rule: rule.rule_name,
            success: true,
            message: `里程碑已標記完成`,
            changes: { milestone: milestoneCode, is_completed: true },
          });
        } else if (!existingMilestone) {
          await supabase.from('project_milestones').insert({
            project_id: projectId,
            milestone_code: milestoneCode,
            is_completed: true,
            completed_at: new Date().toISOString(),
            completed_by: userId,
          });

          linkages.push({
            rule: rule.rule_name,
            success: true,
            message: `里程碑已建立並標記完成`,
            changes: { milestone: milestoneCode, is_completed: true },
          });
        }
        break;
      }

      case 'project_field': {
        const fieldName = rule.target_field;
        if (!fieldName) break;

        const fieldValue = rule.use_trigger_value ? triggerValue : rule.target_value;
        
        const updateData: Record<string, unknown> = {
          [fieldName]: fieldValue,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', projectId);

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          action: 'UPDATE',
          record_id: projectId,
          table_name: 'projects',
          actor_user_id: userId,
          new_data: {
            trigger: 'document_linkage_rule',
            rule_id: rule.id,
            rule_name: rule.rule_name,
            document_id: documentId,
            [fieldName]: fieldValue,
          },
        });

        linkages.push({
          rule: rule.rule_name,
          success: true,
          message: `欄位 ${fieldName} 已更新`,
          changes: { [fieldName]: fieldValue },
        });
        break;
      }

      case 'document_field': {
        // Update another document's field (e.g., set ENG_ELECTRICAL.submitted_at)
        const targetField = rule.target_field;
        if (!targetField || !rule.target_value) break;

        const parsed = parseDocumentFieldTarget(rule.target_value);
        if (!parsed) {
          console.error(`[SyncDocStatus] Invalid document_field target: ${rule.target_value}`);
          break;
        }

        const { docTypeCode, daysOffset } = parsed;
        const calculatedValue = addDays(triggerValue, daysOffset);

        // Find or create target document
        const { data: targetDoc } = await supabase
          .from('documents')
          .select('id, ' + targetField)
          .eq('project_id', projectId)
          .eq('doc_type_code', docTypeCode)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (targetDoc) {
          // Update existing document
          const updateData: Record<string, unknown> = {
            [targetField]: calculatedValue,
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from('documents')
            .update(updateData)
            .eq('id', targetDoc.id);

          if (error) throw error;

          linkages.push({
            rule: rule.rule_name,
            success: true,
            message: `${docTypeCode}.${targetField} 已設為 ${calculatedValue}`,
            changes: { document: docTypeCode, [targetField]: calculatedValue },
          });
        } else {
          // Create new document with the field set
          const { data: typeConfig } = await supabase
            .from('document_type_config')
            .select('label, agency_code')
            .eq('code', docTypeCode)
            .maybeSingle();

          const { data: newDoc, error: createError } = await supabase
            .from('documents')
            .insert({
              project_id: projectId,
              doc_type: typeConfig?.label || docTypeCode,
              doc_type_code: docTypeCode,
              agency_code: typeConfig?.agency_code || null,
              doc_status: 'pending',
              [targetField]: calculatedValue,
              note: `由 ${rule.trigger_doc_type_code} 自動建立`,
            })
            .select('id')
            .single();

          if (createError) throw createError;

          linkages.push({
            rule: rule.rule_name,
            success: true,
            message: `已建立 ${docTypeCode}，${targetField} = ${calculatedValue}`,
            changes: { document: docTypeCode, created: true, [targetField]: calculatedValue },
          });
        }
        break;
      }
    }

    console.log(`[SyncDocStatus] Rule applied: ${rule.rule_name}`);
  } catch (err) {
    const error = err as Error;
    linkages.push({
      rule: rule.rule_name,
      success: false,
      message: error.message,
    });
    console.error(`[SyncDocStatus] Rule failed: ${rule.rule_name}`, error);
  }
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
    const { documentId, docTypeCode, docType, projectId, issuedAt, submittedAt, previousIssuedAt, previousSubmittedAt } = body;

    if (!documentId || !projectId) {
      return new Response(
        JSON.stringify({ error: '缺少必要參數' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveCode = docTypeCode || docType;
    console.log(`[SyncDocStatus] Processing: ${effectiveCode} for project ${projectId}`);

    // Fetch active linkage rules for this document type
    const { data: rules, error: rulesError } = await supabase
      .from('document_linkage_rules')
      .select('*')
      .eq('trigger_doc_type_code', effectiveCode)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (rulesError) {
      console.error('[SyncDocStatus] Error fetching rules:', rulesError);
      throw rulesError;
    }

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: '無適用的連動規則',
          linkages: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const linkages: LinkageResult[] = [];

    // Process each rule
    for (const rule of rules as LinkageRule[]) {
      // Check trigger condition
      let shouldTrigger = false;
      let triggerValue = '';

      if (rule.trigger_field === 'issued_at') {
        if (rule.trigger_condition === 'set_new') {
          shouldTrigger = !!issuedAt && !previousIssuedAt;
        } else if (rule.trigger_condition === 'any_change') {
          shouldTrigger = issuedAt !== previousIssuedAt;
        }
        triggerValue = issuedAt || '';
      } else if (rule.trigger_field === 'submitted_at') {
        if (rule.trigger_condition === 'set_new') {
          shouldTrigger = !!submittedAt && !previousSubmittedAt;
        } else if (rule.trigger_condition === 'any_change') {
          shouldTrigger = submittedAt !== previousSubmittedAt;
        }
        triggerValue = submittedAt || '';
      }

      if (shouldTrigger) {
        await applyRule(supabase, rule, projectId, documentId, triggerValue, user.id, linkages);
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
        message: linkages.length > 0 ? '文件狀態連動完成' : '無需連動',
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
