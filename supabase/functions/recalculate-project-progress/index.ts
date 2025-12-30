import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProgressMilestone {
  milestone_code: string;
  milestone_type: 'admin' | 'engineering';
  weight: number;
  is_active: boolean;
}

interface ProjectMilestone {
  milestone_code: string;
  is_completed: boolean;
}

interface WeightSettings {
  admin_weight: number;
  engineering_weight: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { project_id } = await req.json();

    if (!project_id) {
      return new Response(
        JSON.stringify({ error: 'project_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all active progress milestones
    const { data: milestones, error: milestonesError } = await supabase
      .from('progress_milestones')
      .select('milestone_code, milestone_type, weight, is_active')
      .eq('is_active', true);

    if (milestonesError) throw milestonesError;

    // Fetch project's completed milestones
    const { data: projectMilestones, error: pmError } = await supabase
      .from('project_milestones')
      .select('milestone_code, is_completed')
      .eq('project_id', project_id)
      .eq('is_completed', true);

    if (pmError) throw pmError;

    const completedCodes = new Set((projectMilestones || []).map(m => m.milestone_code));

    // Fetch weight settings
    const { data: settings, error: settingsError } = await supabase
      .from('progress_settings')
      .select('setting_key, setting_value')
      .eq('setting_key', 'weights')
      .single();

    // Default weights if not configured
    const weights: WeightSettings = {
      admin_weight: (settings?.setting_value as any)?.admin_weight ?? 50,
      engineering_weight: (settings?.setting_value as any)?.engineering_weight ?? 50,
    };

    // Calculate admin progress
    const adminMilestones = (milestones || []).filter(m => m.milestone_type === 'admin');
    const adminTotalWeight = adminMilestones.reduce((sum, m) => sum + m.weight, 0);
    const adminCompletedWeight = adminMilestones
      .filter(m => completedCodes.has(m.milestone_code))
      .reduce((sum, m) => sum + m.weight, 0);
    const adminProgress = adminTotalWeight > 0 
      ? (adminCompletedWeight / adminTotalWeight) * 100 
      : 0;

    // Calculate engineering progress
    const engMilestones = (milestones || []).filter(m => m.milestone_type === 'engineering');
    const engTotalWeight = engMilestones.reduce((sum, m) => sum + m.weight, 0);
    const engCompletedWeight = engMilestones
      .filter(m => completedCodes.has(m.milestone_code))
      .reduce((sum, m) => sum + m.weight, 0);
    const engineeringProgress = engTotalWeight > 0 
      ? (engCompletedWeight / engTotalWeight) * 100 
      : 0;

    // Calculate overall progress using configured weights
    const overallProgress = 
      (adminProgress * weights.admin_weight / 100) + 
      (engineeringProgress * weights.engineering_weight / 100);

    // Find current stage for admin and engineering
    const sortedAdminMilestones = adminMilestones
      .sort((a, b) => a.milestone_code.localeCompare(b.milestone_code));
    const sortedEngMilestones = engMilestones
      .sort((a, b) => a.milestone_code.localeCompare(b.milestone_code));

    // Get milestone names for stages
    const { data: allMilestoneDetails } = await supabase
      .from('progress_milestones')
      .select('milestone_code, milestone_name, sort_order')
      .eq('is_active', true);

    const milestoneNameMap = new Map(
      (allMilestoneDetails || []).map(m => [m.milestone_code, m])
    );

    // Find next incomplete milestone as current stage
    const adminStage = (() => {
      const sortedAdmin = (allMilestoneDetails || [])
        .filter(m => m.milestone_code.startsWith('ADMIN'))
        .sort((a, b) => a.sort_order - b.sort_order);
      const nextIncomplete = sortedAdmin.find(m => !completedCodes.has(m.milestone_code));
      return nextIncomplete?.milestone_name || (sortedAdmin.length > 0 ? '已完成' : null);
    })();

    const engineeringStage = (() => {
      const sortedEng = (allMilestoneDetails || [])
        .filter(m => m.milestone_code.startsWith('ENG'))
        .sort((a, b) => a.sort_order - b.sort_order);
      const nextIncomplete = sortedEng.find(m => !completedCodes.has(m.milestone_code));
      return nextIncomplete?.milestone_name || (sortedEng.length > 0 ? '已完成' : null);
    })();

    // Update project with new progress values
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        admin_progress: Math.round(adminProgress * 100) / 100,
        engineering_progress: Math.round(engineeringProgress * 100) / 100,
        overall_progress: Math.round(overallProgress * 100) / 100,
        admin_stage: adminStage,
        engineering_stage: engineeringStage,
      })
      .eq('id', project_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        admin_progress: Math.round(adminProgress * 100) / 100,
        engineering_progress: Math.round(engineeringProgress * 100) / 100,
        overall_progress: Math.round(overallProgress * 100) / 100,
        admin_stage: adminStage,
        engineering_stage: engineeringStage,
        weights: weights,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
