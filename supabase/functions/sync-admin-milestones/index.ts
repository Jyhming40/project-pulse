import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * 行政里程碑 SSOT 完成條件對應表
 * 
 * 每個里程碑的完成判斷依據唯一來源（SSOT）
 * - doc_type_code: 對應的文件類型代碼
 * - check_field: 判斷欄位 ('issued_at' = 已取得, 'submitted_at' = 已開始)
 * - prerequisite: 前置里程碑代碼（必須全部完成才能完成本里程碑）
 */
interface MilestoneRule {
  milestone_code: string;
  doc_type_code: string | null;  // null 表示非文件驅動
  doc_type_label: string | null; // 中文標籤（向後兼容）
  doc_type_labels?: string[];    // 多個可能的中文標籤（任一匹配即可）
  check_field: 'issued_at' | 'submitted_at' | 'project_exists' | 'all_previous';
  prerequisites: string[];  // 前置里程碑代碼
}

const ADMIN_MILESTONE_RULES: MilestoneRule[] = [
  // 頁次 1: 建檔完成 - 專案存在即完成
  {
    milestone_code: 'ADMIN_01_CREATED',
    doc_type_code: null,
    doc_type_label: null,
    check_field: 'project_exists',
    prerequisites: [],
  },
  // 頁次 2: 台電申請送件 - 審查意見書 submitted_at 有值
  {
    milestone_code: 'ADMIN_02_TAIPOWER_SUBMIT',
    doc_type_code: 'TPC_REVIEW',
    doc_type_label: '審查意見書',  // 中文標籤用於匹配
    check_field: 'submitted_at',
    prerequisites: ['ADMIN_01_CREATED'],
  },
  // 頁次 3: 取得台電審查意見書 - 審查意見書 issued_at 有值
  {
    milestone_code: 'ADMIN_03_TAIPOWER_OPINION',
    doc_type_code: 'TPC_REVIEW',
    doc_type_label: '審查意見書',
    check_field: 'issued_at',
    prerequisites: ['ADMIN_02_TAIPOWER_SUBMIT'],
  },
  // 頁次 4: 能源署同意備案 - 同意備案 issued_at 有值
  // 支援多種文件類型標籤：同意備案、綠能容許
  {
    milestone_code: 'ADMIN_04_ENERGY_APPROVAL',
    doc_type_code: 'MOEA_CONSENT',
    doc_type_label: '同意備案',
    doc_type_labels: ['同意備案', '綠能容許'],
    check_field: 'issued_at',
    prerequisites: ['ADMIN_03_TAIPOWER_OPINION'],
  },
  // 頁次 5: 免雜項執照完成/回函 - 免雜項竣工 issued_at 有值
  {
    milestone_code: 'ADMIN_05_MISC_EXEMPT',
    doc_type_code: 'BUILD_EXEMPT_COMP',
    doc_type_label: '免雜項竣工',
    check_field: 'issued_at',
    prerequisites: ['ADMIN_04_ENERGY_APPROVAL'],
  },
  // 頁次 6: 台電細部協商完成 - 細部協商 issued_at 有值
  {
    milestone_code: 'ADMIN_06_TAIPOWER_DETAIL',
    doc_type_code: 'TPC_NEGOTIATION',
    doc_type_label: '細部協商',
    check_field: 'issued_at',
    prerequisites: ['ADMIN_05_MISC_EXEMPT'],
  },
  // 頁次 7: 躉售合約完成 - 躉售合約 issued_at 有值
  {
    milestone_code: 'ADMIN_07_PPA_SIGNED',
    doc_type_code: 'TPC_CONTRACT',
    doc_type_label: '躉售合約',
    check_field: 'issued_at',
    prerequisites: ['ADMIN_06_TAIPOWER_DETAIL'],
  },
  // 頁次 8: 報竣掛表完成 - 報竣掛表 issued_at 有值
  // 支援多種文件類型標籤：報竣掛表、正式躉售、派員訪查併聯函、電表租約
  {
    milestone_code: 'ADMIN_08_METER_INSTALLED',
    doc_type_code: 'TPC_METER',
    doc_type_label: '報竣掛表',
    doc_type_labels: ['報竣掛表', '正式躉售', '派員訪查併聯函', '電表租約'],
    check_field: 'issued_at',
    prerequisites: ['ADMIN_07_PPA_SIGNED'],
  },
  // 頁次 9: 能源署設備登記完成 - 設備登記 issued_at 有值
  {
    milestone_code: 'ADMIN_09_EQUIPMENT_REG',
    doc_type_code: 'MOEA_REGISTER',
    doc_type_label: '設備登記',
    check_field: 'issued_at',
    prerequisites: ['ADMIN_08_METER_INSTALLED'],
  },
  // 頁次 10: 行政結案 - 頁次 1~9 全部完成
  {
    milestone_code: 'ADMIN_10_CLOSED',
    doc_type_code: null,
    doc_type_label: null,
    check_field: 'all_previous',
    prerequisites: [
      'ADMIN_01_CREATED',
      'ADMIN_02_TAIPOWER_SUBMIT',
      'ADMIN_03_TAIPOWER_OPINION',
      'ADMIN_04_ENERGY_APPROVAL',
      'ADMIN_05_MISC_EXEMPT',
      'ADMIN_06_TAIPOWER_DETAIL',
      'ADMIN_07_PPA_SIGNED',
      'ADMIN_08_METER_INSTALLED',
      'ADMIN_09_EQUIPMENT_REG',
    ],
  },
];

interface DocumentRecord {
  id: string;
  doc_type: string | null;        // 中文標籤（向後兼容）
  doc_type_code: string | null;   // 文件類型代碼
  submitted_at: string | null;
  issued_at: string | null;
  is_current: boolean;
  is_deleted: boolean;
  file_count?: number;  // 上傳檔案數量（document_files）
  drive_file_id?: string | null;  // Google Drive 檔案 ID
}

interface ProjectMilestoneRecord {
  id: string;
  milestone_code: string;
  is_completed: boolean;
  note: string | null;
}

/**
 * 跨類型里程碑連動規則
 * 當行政里程碑完成時，自動完成對應的工程里程碑
 */
const CROSS_MILESTONE_TRIGGERS: { adminCode: string; engineeringCode: string }[] = [
  // === 保守的階段性連動規則 ===
  // 台電申請送件完成 → 現勘完成（送件前必須完成現勘）
  { adminCode: 'ADMIN_02_TAIPOWER_SUBMIT', engineeringCode: 'ENG_01_SITE_SURVEY' },
  
  // 台電審查意見書完成 → 現勘完成（同上）
  { adminCode: 'ADMIN_03_TAIPOWER_OPINION', engineeringCode: 'ENG_01_SITE_SURVEY' },
  
  // 同意備案完成 → 只觸發現勘完成（備案不代表工程開始）
  { adminCode: 'ADMIN_04_ENERGY_APPROVAL', engineeringCode: 'ENG_01_SITE_SURVEY' },
  
  // 報竣掛表完成 → 代表工程已完工，自動完成所有工程里程碑
  { adminCode: 'ADMIN_08_METER_INSTALLED', engineeringCode: 'ENG_01_SITE_SURVEY' },
  { adminCode: 'ADMIN_08_METER_INSTALLED', engineeringCode: 'ENG_02_DESIGN_FINAL' },
  { adminCode: 'ADMIN_08_METER_INSTALLED', engineeringCode: 'ENG_03_MATERIAL_ORDER' },
  { adminCode: 'ADMIN_08_METER_INSTALLED', engineeringCode: 'ENG_04_STRUCTURE' },
  { adminCode: 'ADMIN_08_METER_INSTALLED', engineeringCode: 'ENG_05_MODULE' },
  { adminCode: 'ADMIN_08_METER_INSTALLED', engineeringCode: 'ENG_06_ELECTRICAL' },
  { adminCode: 'ADMIN_08_METER_INSTALLED', engineeringCode: 'ENG_07_INVERTER' },
  { adminCode: 'ADMIN_08_METER_INSTALLED', engineeringCode: 'ENG_08_GRID_TEST' },
  { adminCode: 'ADMIN_08_METER_INSTALLED', engineeringCode: 'ENG_09_DEFECT_FIX' },
  { adminCode: 'ADMIN_08_METER_INSTALLED', engineeringCode: 'ENG_10_HANDOVER' },
];

// deno-lint-ignore no-explicit-any
async function syncAdminMilestones(supabase: any, projectId: string, userId: string): Promise<{
  synced: string[];
  unsynced: string[];
  changes: { code: string; from: boolean; to: boolean }[];
}> {
  console.log(`Syncing admin milestones for project: ${projectId}`);
  
  const synced: string[] = [];
  const unsynced: string[] = [];
  const changes: { code: string; from: boolean; to: boolean }[] = [];

  // 1. 取得專案的所有當前文件（is_current=true, is_deleted=false）及其檔案數量
  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('id, doc_type, doc_type_code, submitted_at, issued_at, is_current, is_deleted, drive_file_id, document_files(id)')
    .eq('project_id', projectId)
    .eq('is_current', true)
    .eq('is_deleted', false)
    .eq('document_files.is_deleted', false);

  if (docError) {
    console.error('Failed to fetch documents:', docError);
    throw new Error('無法取得文件資料');
  }

  // 計算每個文件的檔案數量
  const docs: DocumentRecord[] = (documents || []).map((doc: Record<string, unknown>) => ({
    id: doc.id as string,
    doc_type: doc.doc_type as string | null,
    doc_type_code: doc.doc_type_code as string | null,
    submitted_at: doc.submitted_at as string | null,
    issued_at: doc.issued_at as string | null,
    is_current: doc.is_current as boolean,
    is_deleted: doc.is_deleted as boolean,
    file_count: Array.isArray(doc.document_files) ? doc.document_files.length : 0,
    drive_file_id: doc.drive_file_id as string | null,
  }));
  console.log(`Found ${docs.length} current documents`);

  // 建立文件代碼和標籤到文件的映射（方便查詢）
  // 同時支援 doc_type_code（新）和 doc_type（舊中文標籤）匹配
  const docByCode: Record<string, DocumentRecord> = {};
  const docByLabel: Record<string, DocumentRecord> = {};
  for (const doc of docs) {
    if (doc.doc_type_code) {
      // 如果同類型有多筆，取最新的（這裡假設 is_current=true 已經處理）
      docByCode[doc.doc_type_code] = doc;
    }
    if (doc.doc_type) {
      docByLabel[doc.doc_type] = doc;
    }
  }
  console.log(`DocByCode keys: ${Object.keys(docByCode).join(', ')}`);
  console.log(`DocByLabel keys: ${Object.keys(docByLabel).join(', ')}`);

  // 2. 取得專案現有的里程碑記錄（包含工程里程碑，用於跨類型連動）
  const { data: existingMilestones, error: msError } = await supabase
    .from('project_milestones')
    .select('id, milestone_code, is_completed, note')
    .eq('project_id', projectId);

  if (msError) {
    console.error('Failed to fetch milestones:', msError);
    throw new Error('無法取得里程碑資料');
  }

  const milestoneMap: Record<string, ProjectMilestoneRecord> = {};
  for (const m of (existingMilestones || []) as ProjectMilestoneRecord[]) {
    milestoneMap[m.milestone_code] = m;
  }

  // 3. 逐一檢查每個行政里程碑的完成條件
  const completedCodes = new Set<string>();

  for (const rule of ADMIN_MILESTONE_RULES) {
    let shouldComplete = false;

    // 檢查前置條件
    const prereqsMet = rule.prerequisites.every(prereq => completedCodes.has(prereq));

    if (prereqsMet) {
      // 查找匹配的文件：
      // 1. 先用 doc_type_code（新系統）
      // 2. 若無則用 doc_type_labels（多標籤匹配）
      // 3. 最後用 doc_type_label（單標籤匹配，向後兼容）
      const findMatchingDoc = (): DocumentRecord | null => {
        // 優先用 doc_type_code 匹配
        if (rule.doc_type_code && docByCode[rule.doc_type_code]) {
          return docByCode[rule.doc_type_code];
        }
        // 多標籤匹配：任一標籤匹配即可
        if (rule.doc_type_labels && rule.doc_type_labels.length > 0) {
          for (const label of rule.doc_type_labels) {
            if (docByLabel[label]) {
              console.log(`[${rule.milestone_code}] Matched via multi-label: ${label}`);
              return docByLabel[label];
            }
          }
        }
        // 單標籤匹配（向後兼容）
        if (rule.doc_type_label && docByLabel[rule.doc_type_label]) {
          return docByLabel[rule.doc_type_label];
        }
        return null;
      };

      switch (rule.check_field) {
        case 'project_exists':
          // 專案存在即完成
          shouldComplete = true;
          break;

        case 'submitted_at': {
          // 檢查對應文件的 submitted_at 是否有值
          // 注意：如果文件已取得（issued_at 有值或有上傳檔案），則 submitted_at 也視為完成
          const doc = findMatchingDoc();
          if (doc) {
            const hasFile = (doc.file_count !== undefined && doc.file_count > 0) || !!doc.drive_file_id;
            const isIssued = !!doc.issued_at || hasFile;
            // 如果已送件或已取得，都算完成
            shouldComplete = !!doc.submitted_at || isIssued;
            console.log(`[${rule.milestone_code}] submitted_at check: doc found (type: ${doc.doc_type || doc.doc_type_code}), submitted_at=${doc.submitted_at}, isIssued=${isIssued}, result=${shouldComplete}`);
          } else {
            console.log(`[${rule.milestone_code}] submitted_at check: no matching doc for code=${rule.doc_type_code} or label=${rule.doc_type_label}`);
          }
          break;
        }

        case 'issued_at': {
          // 檢查對應文件的 issued_at 是否有值，或是否有上傳檔案（document_files 或 Google Drive）
          const doc = findMatchingDoc();
          if (doc) {
            // 有 issued_at 或有上傳檔案（document_files 或 drive_file_id）都算「已取得」
            const hasFile = (doc.file_count !== undefined && doc.file_count > 0) || !!doc.drive_file_id;
            shouldComplete = !!doc.issued_at || hasFile;
            console.log(`[${rule.milestone_code}] issued_at check: doc found (type: ${doc.doc_type || doc.doc_type_code}), issued_at=${doc.issued_at}, file_count=${doc.file_count}, drive_file_id=${doc.drive_file_id}, hasFile=${hasFile}, result=${shouldComplete}`);
          } else {
            console.log(`[${rule.milestone_code}] issued_at check: no matching doc for code=${rule.doc_type_code} or label=${rule.doc_type_label}`);
          }
          break;
        }

        case 'all_previous':
          // 所有前置里程碑都必須完成
          shouldComplete = rule.prerequisites.every(prereq => completedCodes.has(prereq));
          break;
      }
    }

    // 更新完成狀態集合
    if (shouldComplete) {
      completedCodes.add(rule.milestone_code);
      synced.push(rule.milestone_code);
    } else {
      unsynced.push(rule.milestone_code);
    }

    // 比對現有狀態，決定是否需要更新
    const existing = milestoneMap[rule.milestone_code];
    const currentCompleted = existing?.is_completed ?? false;
    
    // 檢查是否為手動完成（note 不包含 "SSOT" 或 "自動"）
    const isManuallyCompleted = currentCompleted && existing?.note && 
      !existing.note.includes('SSOT') && 
      !existing.note.includes('自動');

    // 如果是手動完成的，則保留原狀態，不自動取消
    // 但如果文件也符合條件，則仍標記為 synced
    if (isManuallyCompleted && !shouldComplete) {
      console.log(`[${rule.milestone_code}] Preserving manual completion (note: ${existing?.note})`);
      // 即使文件條件不符，也保留手動完成狀態
      completedCodes.add(rule.milestone_code);
      synced.push(rule.milestone_code);
      continue; // 跳過此里程碑，不做任何更新
    }

    if (shouldComplete !== currentCompleted) {
      changes.push({
        code: rule.milestone_code,
        from: currentCompleted,
        to: shouldComplete,
      });

      if (existing) {
        // 更新現有記錄
        await supabase
          .from('project_milestones')
          .update({
            is_completed: shouldComplete,
            completed_at: shouldComplete ? new Date().toISOString() : null,
            completed_by: shouldComplete ? userId : null,
            note: shouldComplete 
              ? '依據文件狀態自動完成 (SSOT)' 
              : '文件狀態不符，自動取消完成',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else if (shouldComplete) {
        // 新增記錄（僅在需要完成時）
        await supabase
          .from('project_milestones')
          .insert({
            project_id: projectId,
            milestone_code: rule.milestone_code,
            is_completed: true,
            completed_at: new Date().toISOString(),
            completed_by: userId,
            note: '依據文件狀態自動完成 (SSOT)',
          });
      }
    }
  }

  // 4. 處理跨類型里程碑連動（行政 → 工程）
  for (const trigger of CROSS_MILESTONE_TRIGGERS) {
    // 檢查行政里程碑是否已完成
    if (completedCodes.has(trigger.adminCode)) {
      const engMilestone = milestoneMap[trigger.engineeringCode];
      const engCurrentCompleted = engMilestone?.is_completed ?? false;

      // 如果工程里程碑尚未完成，則自動完成
      if (!engCurrentCompleted) {
        console.log(`[Cross-trigger] ${trigger.adminCode} completed → auto-complete ${trigger.engineeringCode}`);
        
        changes.push({
          code: trigger.engineeringCode,
          from: false,
          to: true,
        });
        synced.push(trigger.engineeringCode);

        if (engMilestone) {
          // 更新現有記錄
          await supabase
            .from('project_milestones')
            .update({
              is_completed: true,
              completed_at: new Date().toISOString(),
              completed_by: userId,
              note: `依據 ${trigger.adminCode} 完成自動連動完成`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', engMilestone.id);
        } else {
          // 新增記錄
          await supabase
            .from('project_milestones')
            .insert({
              project_id: projectId,
              milestone_code: trigger.engineeringCode,
              is_completed: true,
              completed_at: new Date().toISOString(),
              completed_by: userId,
              note: `依據 ${trigger.adminCode} 完成自動連動完成`,
            });
        }
      }
    }
  }

  console.log(`Sync complete: ${synced.length} completed, ${unsynced.length} incomplete, ${changes.length} changes`);
  return { synced, unsynced, changes };
}

// 重新計算專案進度
// deno-lint-ignore no-explicit-any
async function recalculateProgress(supabase: any, projectId: string): Promise<{
  admin_progress: number;
  engineering_progress: number;
  overall_progress: number;
  admin_stage: string | null;
  engineering_stage: string | null;
}> {
  // Fetch all active progress milestones
  const { data: milestonesRaw } = await supabase
    .from('progress_milestones')
    .select('milestone_code, milestone_type, weight, is_active, milestone_name, sort_order')
    .eq('is_active', true);

  const milestones = (milestonesRaw || []) as {
    milestone_code: string;
    milestone_type: string;
    weight: number;
    is_active: boolean;
    milestone_name: string;
    sort_order: number;
  }[];

  // Fetch project's completed milestones
  const { data: projectMilestonesRaw } = await supabase
    .from('project_milestones')
    .select('milestone_code, is_completed')
    .eq('project_id', projectId)
    .eq('is_completed', true);

  const completedCodes = new Set(
    (projectMilestonesRaw || []).map((m: { milestone_code: string }) => m.milestone_code)
  );

  // Fetch weight settings
  const { data: settingsRaw } = await supabase
    .from('progress_settings')
    .select('setting_key, setting_value')
    .eq('setting_key', 'weights')
    .single();

  const weights = {
    admin_weight: settingsRaw?.setting_value?.admin_weight ?? 50,
    engineering_weight: settingsRaw?.setting_value?.engineering_weight ?? 50,
  };

  // Calculate admin progress
  const adminMilestones = milestones.filter(m => m.milestone_type === 'admin');
  const adminTotalWeight = adminMilestones.reduce((sum, m) => sum + m.weight, 0);
  const adminCompletedWeight = adminMilestones
    .filter(m => completedCodes.has(m.milestone_code))
    .reduce((sum, m) => sum + m.weight, 0);
  const adminProgress = adminTotalWeight > 0
    ? (adminCompletedWeight / adminTotalWeight) * 100
    : 0;

  // Calculate engineering progress
  const engMilestones = milestones.filter(m => m.milestone_type === 'engineering');
  const engTotalWeight = engMilestones.reduce((sum, m) => sum + m.weight, 0);
  const engCompletedWeight = engMilestones
    .filter(m => completedCodes.has(m.milestone_code))
    .reduce((sum, m) => sum + m.weight, 0);
  const engineeringProgress = engTotalWeight > 0
    ? (engCompletedWeight / engTotalWeight) * 100
    : 0;

  // Calculate overall progress
  const overallProgress =
    (adminProgress * weights.admin_weight / 100) +
    (engineeringProgress * weights.engineering_weight / 100);

  // Find current stage
  const adminStage = (() => {
    const sorted = milestones
      .filter(m => m.milestone_code.startsWith('ADMIN'))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const next = sorted.find(m => !completedCodes.has(m.milestone_code));
    return next?.milestone_name || (sorted.length > 0 ? '已完成' : null);
  })();

  const engineeringStage = (() => {
    const sorted = milestones
      .filter(m => m.milestone_code.startsWith('ENG'))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const next = sorted.find(m => !completedCodes.has(m.milestone_code));
    return next?.milestone_name || (sorted.length > 0 ? '已完成' : null);
  })();

  return {
    admin_progress: Math.round(adminProgress * 100) / 100,
    engineering_progress: Math.round(engineeringProgress * 100) / 100,
    overall_progress: Math.round(overallProgress * 100) / 100,
    admin_stage: adminStage,
    engineering_stage: engineeringStage,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授權' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '無效的認證令牌' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { projectId } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: '缺少 projectId 參數' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. 同步行政里程碑
    const syncResult = await syncAdminMilestones(supabase, projectId, user.id);

    // 2. 重新計算進度
    const progressResult = await recalculateProgress(supabase, projectId);

    // 3. 更新專案進度欄位
    await supabase
      .from('projects')
      .update({
        admin_progress: progressResult.admin_progress,
        engineering_progress: progressResult.engineering_progress,
        overall_progress: progressResult.overall_progress,
        admin_stage: progressResult.admin_stage,
        engineering_stage: progressResult.engineering_stage,
      })
      .eq('id', projectId);

    console.log('Project progress updated:', progressResult);

    return new Response(
      JSON.stringify({
        success: true,
        sync: syncResult,
        progress: progressResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Sync error:', error);

    return new Response(
      JSON.stringify({ error: error?.message || '未知錯誤' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
