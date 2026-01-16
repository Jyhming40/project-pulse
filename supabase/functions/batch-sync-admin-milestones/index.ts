import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Batch sync admin milestones for ALL projects
 * Uses optimized bulk operations to handle large project counts
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: '未授權' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: '無效的授權' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`Batch sync initiated by user: ${userId}`);

    // Get all non-deleted projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, project_code, project_name, created_at')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (projectsError) {
      throw new Error('無法取得專案列表');
    }

    const projectIds = (projects || []).map(p => p.id);
    console.log(`Found ${projectIds.length} projects to sync`);

    // Bulk fetch: Get ALL documents for ALL projects
    const { data: allDocuments } = await supabase
      .from('documents')
      .select('id, project_id, doc_type, doc_type_code, submitted_at, issued_at, drive_file_id, document_files(id)')
      .in('project_id', projectIds)
      .eq('is_current', true)
      .eq('is_deleted', false);

    // Bulk fetch: Get ALL existing milestones
    const { data: allMilestones } = await supabase
      .from('project_milestones')
      .select('id, project_id, milestone_code, is_completed')
      .in('project_id', projectIds);

    // Build lookup maps
    const docsByProject: Record<string, typeof allDocuments> = {};
    const milestonesByProject: Record<string, Record<string, { id: string; is_completed: boolean }>> = {};

    for (const doc of (allDocuments || [])) {
      if (!docsByProject[doc.project_id]) {
        docsByProject[doc.project_id] = [];
      }
      docsByProject[doc.project_id]!.push(doc);
    }

    for (const ms of (allMilestones || [])) {
      if (!milestonesByProject[ms.project_id]) {
        milestonesByProject[ms.project_id] = {};
      }
      milestonesByProject[ms.project_id][ms.milestone_code] = {
        id: ms.id,
        is_completed: ms.is_completed,
      };
    }

    // Prepare bulk inserts and updates
    const milestonesToInsert: Array<{
      project_id: string;
      milestone_code: string;
      is_completed: boolean;
      completed_at: string | null;
      completed_by: string | null;
      note: string | null;
    }> = [];

    const milestonesToUpdate: Array<{
      id: string;
      is_completed: boolean;
      completed_at: string;
      completed_by: string;
      note: string;
      updated_at: string;
    }> = [];

    let changesCount = 0;

    // Process each project
    for (const project of (projects || [])) {
      const docs = docsByProject[project.id] || [];
      const existingMilestones = milestonesByProject[project.id] || {};

      // Build doc lookup
      const docByCode: Record<string, typeof docs[0]> = {};
      const docByLabel: Record<string, typeof docs[0]> = {};
      for (const doc of docs) {
        if (doc.doc_type_code) docByCode[doc.doc_type_code] = doc;
        if (doc.doc_type) docByLabel[doc.doc_type] = doc;
      }

      const completedCodes = new Set<string>();

      // Check each milestone rule
      for (const rule of ADMIN_MILESTONE_RULES) {
        const prereqsMet = rule.prerequisites.every(prereq => completedCodes.has(prereq));
        let shouldComplete = false;
        let completionDate: string | null = null;
        let matchedDocLabel = '';

        const findMatchingDoc = () => {
          if (rule.doc_type_code && docByCode[rule.doc_type_code]) {
            return docByCode[rule.doc_type_code];
          }
          if (rule.doc_type_labels) {
            for (const label of rule.doc_type_labels) {
              if (docByLabel[label]) return docByLabel[label];
            }
          }
          if (rule.doc_type_label && docByLabel[rule.doc_type_label]) {
            return docByLabel[rule.doc_type_label];
          }
          return null;
        };

        if (prereqsMet) {
          switch (rule.check_field) {
            case 'project_exists':
              shouldComplete = true;
              completionDate = project.created_at;
              break;

            case 'submitted_at': {
              const doc = findMatchingDoc();
              if (doc) {
                const hasFile = (Array.isArray(doc.document_files) && doc.document_files.length > 0) || !!doc.drive_file_id;
                const isIssued = !!doc.issued_at || hasFile;
                shouldComplete = !!doc.submitted_at || isIssued;
                if (shouldComplete) {
                  completionDate = doc.submitted_at || doc.issued_at;
                  matchedDocLabel = doc.doc_type || doc.doc_type_code || '';
                }
              }
              break;
            }

            case 'issued_at': {
              const doc = findMatchingDoc();
              if (doc) {
                const hasFile = (Array.isArray(doc.document_files) && doc.document_files.length > 0) || !!doc.drive_file_id;
                shouldComplete = !!doc.issued_at || hasFile;
                if (shouldComplete) {
                  completionDate = doc.issued_at;
                  matchedDocLabel = doc.doc_type || doc.doc_type_code || '';
                }
              }
              break;
            }

            case 'all_previous':
              shouldComplete = rule.prerequisites.every(prereq => completedCodes.has(prereq));
              break;
          }
        }

        // Track completion status
        if (shouldComplete) {
          completedCodes.add(rule.milestone_code);
        }

        // Check existing milestone status
        const existing = existingMilestones[rule.milestone_code];
        const currentCompleted = existing?.is_completed ?? false;

        // Preserve already completed milestones
        if (currentCompleted) {
          completedCodes.add(rule.milestone_code);
          continue;
        }

        // Need to create or update
        if (!existing) {
          // Create new milestone record
          milestonesToInsert.push({
            project_id: project.id,
            milestone_code: rule.milestone_code,
            is_completed: shouldComplete,
            completed_at: shouldComplete ? (completionDate || new Date().toISOString()) : null,
            completed_by: shouldComplete ? userId : null,
            note: shouldComplete 
              ? (completionDate ? `依據文件 ${matchedDocLabel} 日期自動完成 (SSOT)` : '依據文件狀態自動完成 (SSOT)')
              : null,
          });
          if (shouldComplete) changesCount++;
        } else if (shouldComplete && !currentCompleted) {
          // Update to completed
          milestonesToUpdate.push({
            id: existing.id,
            is_completed: true,
            completed_at: completionDate || new Date().toISOString(),
            completed_by: userId,
            note: completionDate 
              ? `依據文件 ${matchedDocLabel} 日期自動完成 (SSOT)` 
              : '依據文件狀態自動完成 (SSOT)',
            updated_at: new Date().toISOString(),
          });
          changesCount++;
        }
      }
    }

    console.log(`Preparing to insert ${milestonesToInsert.length} milestones, update ${milestonesToUpdate.length}`);

    // Execute bulk insert
    if (milestonesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('project_milestones')
        .upsert(milestonesToInsert, { 
          onConflict: 'project_id,milestone_code',
          ignoreDuplicates: false 
        });

      if (insertError) {
        console.error('Insert error:', insertError);
      }
    }

    // Execute updates one by one (no bulk update in Supabase)
    for (const update of milestonesToUpdate) {
      await supabase
        .from('project_milestones')
        .update({
          is_completed: update.is_completed,
          completed_at: update.completed_at,
          completed_by: update.completed_by,
          note: update.note,
          updated_at: update.updated_at,
        })
        .eq('id', update.id);
    }

    console.log(`Batch sync completed: ${changesCount} milestones changed`);

    return new Response(
      JSON.stringify({
        success: true,
        results: {
          total: projects?.length || 0,
          synced: projects?.length || 0,
          failed: 0,
          details: [{
            projectId: 'batch',
            projectCode: 'all',
            success: true,
            changesCount,
          }],
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Batch sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Milestone rules (same as sync-admin-milestones)
interface MilestoneRule {
  milestone_code: string;
  doc_type_code: string | null;
  doc_type_label: string | null;
  doc_type_labels?: string[];
  check_field: 'issued_at' | 'submitted_at' | 'project_exists' | 'all_previous';
  prerequisites: string[];
}

const ADMIN_MILESTONE_RULES: MilestoneRule[] = [
  { milestone_code: 'ADMIN_01_CREATED', doc_type_code: null, doc_type_label: null, check_field: 'project_exists', prerequisites: [] },
  { milestone_code: 'ADMIN_02_TAIPOWER_SUBMIT', doc_type_code: 'TPC_REVIEW', doc_type_label: '審查意見書', check_field: 'submitted_at', prerequisites: ['ADMIN_01_CREATED'] },
  { milestone_code: 'ADMIN_03_TAIPOWER_OPINION', doc_type_code: 'TPC_REVIEW', doc_type_label: '審查意見書', check_field: 'issued_at', prerequisites: ['ADMIN_02_TAIPOWER_SUBMIT'] },
  { milestone_code: 'ADMIN_04_ENERGY_APPROVAL', doc_type_code: 'MOEA_CONSENT', doc_type_label: '同意備案', doc_type_labels: ['同意備案', '綠能容許'], check_field: 'issued_at', prerequisites: ['ADMIN_03_TAIPOWER_OPINION'] },
  { milestone_code: 'ADMIN_05_MISC_EXEMPT', doc_type_code: 'BUILD_EXEMPT_COMP', doc_type_label: '免雜項竣工', check_field: 'issued_at', prerequisites: ['ADMIN_04_ENERGY_APPROVAL'] },
  { milestone_code: 'ADMIN_06_TAIPOWER_DETAIL', doc_type_code: 'TPC_NEGOTIATION', doc_type_label: '細部協商', check_field: 'issued_at', prerequisites: ['ADMIN_05_MISC_EXEMPT'] },
  { milestone_code: 'ADMIN_07_PPA_SIGNED', doc_type_code: 'TPC_CONTRACT', doc_type_label: '躉售合約', check_field: 'issued_at', prerequisites: ['ADMIN_06_TAIPOWER_DETAIL'] },
  { milestone_code: 'ADMIN_08_METER_INSTALLED', doc_type_code: 'TPC_METER', doc_type_label: '報竣掛表', doc_type_labels: ['報竣掛表', '正式躉售', '派員訪查併聯函', '電表租約'], check_field: 'issued_at', prerequisites: ['ADMIN_07_PPA_SIGNED'] },
  { milestone_code: 'ADMIN_09_EQUIPMENT_REG', doc_type_code: 'MOEA_REGISTER', doc_type_label: '設備登記', check_field: 'issued_at', prerequisites: ['ADMIN_08_METER_INSTALLED'] },
  { milestone_code: 'ADMIN_09B_FIT_OFFICIAL', doc_type_code: 'TPC_FIT_OFFICIAL', doc_type_label: '正式躉售', check_field: 'issued_at', prerequisites: ['ADMIN_08_METER_INSTALLED'] },
  { milestone_code: 'ADMIN_10_CLOSED', doc_type_code: null, doc_type_label: null, check_field: 'all_previous', prerequisites: ['ADMIN_01_CREATED', 'ADMIN_02_TAIPOWER_SUBMIT', 'ADMIN_03_TAIPOWER_OPINION', 'ADMIN_04_ENERGY_APPROVAL', 'ADMIN_05_MISC_EXEMPT', 'ADMIN_06_TAIPOWER_DETAIL', 'ADMIN_07_PPA_SIGNED', 'ADMIN_08_METER_INSTALLED', 'ADMIN_09_EQUIPMENT_REG'] },
];
