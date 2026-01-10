import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Engineering milestone codes in order (pages 11-20)
const ENGINEERING_MILESTONES = [
  { code: "ENG_01_SITE_SURVEY", name: "現勘完成", weight: 5, sortOrder: 1 },
  { code: "ENG_02_DESIGN_FINAL", name: "設計/圖說定稿", weight: 10, sortOrder: 2 },
  { code: "ENG_03_MATERIAL_ORDER", name: "材料採購下單", weight: 10, sortOrder: 3 },
  { code: "ENG_04_STRUCTURE", name: "鋼構/支架完成", weight: 15, sortOrder: 4 },
  { code: "ENG_05_MODULE", name: "模組安裝完成", weight: 15, sortOrder: 5 },
  { code: "ENG_06_ELECTRICAL", name: "機電配線完成", weight: 10, sortOrder: 6 },
  { code: "ENG_07_INVERTER", name: "逆變器/箱體完成", weight: 10, sortOrder: 7 },
  { code: "ENG_08_GRID_TEST", name: "併聯測試完成", weight: 10, sortOrder: 8 },
  { code: "ENG_09_DEFECT_FIX", name: "掛表前缺失改善完成", weight: 10, sortOrder: 9 },
  { code: "ENG_10_HANDOVER", name: "試運轉/工程交付", weight: 5, sortOrder: 10 },
];

// Derive construction_status from milestone completion (one-way, display only)
function deriveConstructionStatus(completedMilestones: Set<string>): string {
  // Page 20 complete → 已掛錶
  if (completedMilestones.has("ENG_10_HANDOVER")) {
    return "已掛錶";
  }
  
  // Page 19 complete → 待掛錶
  if (completedMilestones.has("ENG_09_DEFECT_FIX")) {
    return "待掛錶";
  }
  
  // Any of pages 11-18 complete → 已開工
  const startedMilestones = [
    "ENG_01_SITE_SURVEY",
    "ENG_02_DESIGN_FINAL", 
    "ENG_03_MATERIAL_ORDER",
    "ENG_04_STRUCTURE",
    "ENG_05_MODULE",
    "ENG_06_ELECTRICAL",
    "ENG_07_INVERTER",
    "ENG_08_GRID_TEST",
  ];
  
  if (startedMilestones.some(code => completedMilestones.has(code))) {
    return "已開工";
  }
  
  // No engineering milestones complete → 尚未開工
  return "尚未開工";
}

// Get current engineering stage based on highest completed milestone
function getEngineeringStage(completedMilestones: Set<string>): string | null {
  for (let i = ENGINEERING_MILESTONES.length - 1; i >= 0; i--) {
    if (completedMilestones.has(ENGINEERING_MILESTONES[i].code)) {
      return ENGINEERING_MILESTONES[i].name;
    }
  }
  return null;
}

// Calculate engineering progress based on completed milestone weights
function calculateEngineeringProgress(completedMilestones: Set<string>): number {
  const totalWeight = ENGINEERING_MILESTONES.reduce((sum, m) => sum + m.weight, 0);
  const completedWeight = ENGINEERING_MILESTONES
    .filter(m => completedMilestones.has(m.code))
    .reduce((sum, m) => sum + m.weight, 0);
  
  return Math.round((completedWeight / totalWeight) * 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { project_id } = await req.json();

    if (!project_id) {
      return new Response(
        JSON.stringify({ error: "project_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-engineering-milestones] Processing project: ${project_id}`);

    // Fetch current project milestones for engineering type
    const { data: projectMilestones, error: milestonesError } = await supabase
      .from("project_milestones")
      .select("milestone_code, is_completed, completed_at")
      .eq("project_id", project_id);

    if (milestonesError) {
      console.error("[sync-engineering-milestones] Error fetching milestones:", milestonesError);
      throw milestonesError;
    }

    // Build set of completed engineering milestones
    const completedMilestones = new Set<string>();
    const milestoneMap = new Map<string, { is_completed: boolean; completed_at: string | null }>();

    for (const pm of projectMilestones || []) {
      if (pm.milestone_code.startsWith("ENG_")) {
        milestoneMap.set(pm.milestone_code, {
          is_completed: pm.is_completed,
          completed_at: pm.completed_at,
        });
        if (pm.is_completed) {
          completedMilestones.add(pm.milestone_code);
        }
      }
    }

    console.log(`[sync-engineering-milestones] Found ${completedMilestones.size} completed engineering milestones`);

    // Validate prerequisite chain and enforce rules
    // Each milestone requires all previous milestones to be completed
    const validatedCompletedMilestones = new Set<string>();
    
    for (let i = 0; i < ENGINEERING_MILESTONES.length; i++) {
      const milestone = ENGINEERING_MILESTONES[i];
      const currentData = milestoneMap.get(milestone.code);
      
      if (!currentData?.is_completed) {
        // This milestone is not completed, so all subsequent cannot be valid
        break;
      }
      
      // Check if all prerequisites are met
      let prerequisitesMet = true;
      for (let j = 0; j < i; j++) {
        if (!validatedCompletedMilestones.has(ENGINEERING_MILESTONES[j].code)) {
          prerequisitesMet = false;
          break;
        }
      }
      
      if (prerequisitesMet) {
        validatedCompletedMilestones.add(milestone.code);
      } else {
        console.log(`[sync-engineering-milestones] Milestone ${milestone.code} marked complete but prerequisites not met`);
        break;
      }
    }

    // Special check for ENG_10_HANDOVER: ALL previous must be complete
    if (completedMilestones.has("ENG_10_HANDOVER")) {
      const allPreviousComplete = ENGINEERING_MILESTONES
        .slice(0, -1)
        .every(m => validatedCompletedMilestones.has(m.code));
      
      if (!allPreviousComplete) {
        console.log("[sync-engineering-milestones] ENG_10_HANDOVER invalid: not all previous milestones complete");
        validatedCompletedMilestones.delete("ENG_10_HANDOVER");
      }
    }

    // Calculate derived values
    const constructionStatus = deriveConstructionStatus(validatedCompletedMilestones);
    const engineeringStage = getEngineeringStage(validatedCompletedMilestones);
    const engineeringProgress = calculateEngineeringProgress(validatedCompletedMilestones);

    console.log(`[sync-engineering-milestones] Derived values:`, {
      constructionStatus,
      engineeringStage,
      engineeringProgress,
      validatedCount: validatedCompletedMilestones.size,
    });

    // Fetch current project data to get admin_progress
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("admin_progress")
      .eq("id", project_id)
      .single();

    if (projectError) {
      console.error("[sync-engineering-milestones] Error fetching project:", projectError);
      throw projectError;
    }

    const adminProgress = projectData?.admin_progress || 0;
    
    // Calculate overall progress (average of admin and engineering)
    const overallProgress = Math.round((adminProgress + engineeringProgress) / 2);

    // Update project with derived values
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        construction_status: constructionStatus,
        engineering_stage: engineeringStage,
        engineering_progress: engineeringProgress,
        overall_progress: overallProgress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project_id);

    if (updateError) {
      console.error("[sync-engineering-milestones] Error updating project:", updateError);
      throw updateError;
    }

    console.log(`[sync-engineering-milestones] Project updated successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        project_id,
        construction_status: constructionStatus,
        engineering_stage: engineeringStage,
        engineering_progress: engineeringProgress,
        overall_progress: overallProgress,
        completed_milestones: Array.from(validatedCompletedMilestones),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[sync-engineering-milestones] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
