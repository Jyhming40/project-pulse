import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface DuplicateGroup {
  id: string;
  confidenceLevel: ConfidenceLevel;
  criteria: string[];
  projects: ProjectForComparison[];
}

export interface ProjectForComparison {
  id: string;
  project_code: string;
  project_name: string;
  site_code_display: string | null;
  investor_id: string | null;
  investor_code: string | null;
  investor_name: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  capacity_kwp: number | null;
  intake_year: number | null;
  seq: number | null;
  created_at: string;
  status: string;
  document_count: number;
}

// Utility function to normalize strings for comparison
function normalizeString(str: string | null): string {
  if (!str) return '';
  // Remove common punctuation and whitespace, convert to lowercase
  return str
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]/g, '') // Keep alphanumeric and Chinese characters
    .trim();
}

// Calculate string similarity (Dice coefficient)
function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  // Create bigrams
  const bigrams1 = new Set<string>();
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.substring(i, i + 2));
  }
  
  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    if (bigrams1.has(s2.substring(i, i + 2))) {
      intersection++;
    }
  }
  
  return (2 * intersection) / (s1.length - 1 + s2.length - 1);
}

// Check if capacity is similar (within 10%)
function isCapacitySimilar(cap1: number | null, cap2: number | null): boolean {
  if (!cap1 || !cap2) return false;
  const diff = Math.abs(cap1 - cap2);
  const avg = (cap1 + cap2) / 2;
  return diff / avg <= 0.1;
}

export function useDuplicateScanner() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch all projects for scanning
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['duplicate-scanner-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          project_code,
          project_name,
          site_code_display,
          investor_id,
          address,
          city,
          district,
          capacity_kwp,
          intake_year,
          seq,
          created_at,
          status,
          investors:investor_id (
            investor_code,
            company_name
          )
        `)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Also fetch document counts for each project
      const projectIds = (data || []).map(p => p.id);
      const { data: docCounts, error: docError } = await supabase
        .from('documents')
        .select('project_id')
        .eq('is_deleted', false)
        .in('project_id', projectIds);

      if (docError) throw docError;

      const docCountMap: Record<string, number> = {};
      (docCounts || []).forEach(doc => {
        docCountMap[doc.project_id] = (docCountMap[doc.project_id] || 0) + 1;
      });

      return (data || []).map(p => ({
        id: p.id,
        project_code: p.project_code,
        project_name: p.project_name,
        site_code_display: p.site_code_display,
        investor_id: p.investor_id,
        investor_code: (p.investors as any)?.investor_code || null,
        investor_name: (p.investors as any)?.company_name || null,
        address: p.address,
        city: p.city,
        district: p.district,
        capacity_kwp: p.capacity_kwp,
        intake_year: p.intake_year,
        seq: p.seq,
        created_at: p.created_at,
        status: p.status,
        document_count: docCountMap[p.id] || 0,
      })) as ProjectForComparison[];
    },
  });

  // Fetch ignored pairs
  const { data: ignoredPairs = [], isLoading: isLoadingIgnored } = useQuery({
    queryKey: ['duplicate-ignore-pairs'],
    queryFn: async () => {
      // Use any cast since table was just created and types aren't regenerated yet
      const { data, error } = await (supabase as any)
        .from('duplicate_ignore_pairs')
        .select('project_id_a, project_id_b');

      if (error) throw error;
      return (data || []).map((p: { project_id_a: string; project_id_b: string }) => ({
        a: p.project_id_a,
        b: p.project_id_b,
      }));
    },
  });

  // Check if a pair is ignored
  const isPairIgnored = (id1: string, id2: string): boolean => {
    const [a, b] = id1 < id2 ? [id1, id2] : [id2, id1];
    return ignoredPairs.some(pair => pair.a === a && pair.b === b);
  };

  // Scan for duplicates
  const scanForDuplicates = (): DuplicateGroup[] => {
    const groups: DuplicateGroup[] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const p1 = projects[i];
        const p2 = projects[j];
        
        // Skip if this pair is ignored
        if (isPairIgnored(p1.id, p2.id)) continue;

        const pairKey = `${p1.id}-${p2.id}`;
        if (processedPairs.has(pairKey)) continue;

        const criteria: string[] = [];
        let confidenceLevel: ConfidenceLevel | null = null;

        // High confidence checks
        // 1. Same site_code_display
        if (p1.site_code_display && p2.site_code_display && 
            p1.site_code_display === p2.site_code_display) {
          criteria.push('案場代碼完全相同');
          confidenceLevel = 'high';
        }

        // 2. Same investor_code + year + seq
        if (p1.investor_code && p2.investor_code &&
            p1.investor_code === p2.investor_code &&
            p1.intake_year === p2.intake_year &&
            p1.seq === p2.seq) {
          criteria.push('投資代碼 + 年份 + 序號相同');
          confidenceLevel = 'high';
        }

        // Medium confidence checks (only if not already high)
        if (!confidenceLevel) {
          // Same investor + similar address
          if (p1.investor_id && p2.investor_id && 
              p1.investor_id === p2.investor_id) {
            const addressSimilarity = stringSimilarity(p1.address, p2.address);
            if (addressSimilarity > 0.7) {
              criteria.push('同投資方 + 地址相似');
              confidenceLevel = 'medium';
            }
          }

          // Same investor + similar project name
          if (p1.investor_id && p2.investor_id && 
              p1.investor_id === p2.investor_id) {
            const nameSimilarity = stringSimilarity(p1.project_name, p2.project_name);
            if (nameSimilarity > 0.7) {
              criteria.push('同投資方 + 案場名稱相似');
              if (!confidenceLevel) confidenceLevel = 'medium';
            }
          }
        }

        // Low confidence checks (only if not already high or medium)
        if (!confidenceLevel) {
          if (p1.investor_id && p2.investor_id && 
              p1.investor_id === p2.investor_id &&
              p1.city === p2.city && p1.district === p2.district &&
              isCapacitySimilar(p1.capacity_kwp, p2.capacity_kwp)) {
            criteria.push('同投資方 + 同區域 + 容量相近');
            confidenceLevel = 'low';
          }
        }

        if (confidenceLevel && criteria.length > 0) {
          processedPairs.add(pairKey);
          
          // Check if we can add to an existing group
          const existingGroup = groups.find(g => 
            g.confidenceLevel === confidenceLevel &&
            g.projects.some(p => p.id === p1.id || p.id === p2.id)
          );

          if (existingGroup) {
            if (!existingGroup.projects.some(p => p.id === p1.id)) {
              existingGroup.projects.push(p1);
            }
            if (!existingGroup.projects.some(p => p.id === p2.id)) {
              existingGroup.projects.push(p2);
            }
            criteria.forEach(c => {
              if (!existingGroup.criteria.includes(c)) {
                existingGroup.criteria.push(c);
              }
            });
          } else {
            groups.push({
              id: `group-${groups.length + 1}`,
              confidenceLevel,
              criteria,
              projects: [p1, p2],
            });
          }
        }
      }
    }

    // Sort by confidence level (high first)
    const order: Record<ConfidenceLevel, number> = { high: 0, medium: 1, low: 2 };
    return groups.sort((a, b) => order[a.confidenceLevel] - order[b.confidenceLevel]);
  };

  // Mark as not duplicate
  const markNotDuplicateMutation = useMutation({
    mutationFn: async ({ projectIds, note }: { projectIds: string[]; note?: string }) => {
      // Create pairs from all projects in the group
      const pairs: { project_id_a: string; project_id_b: string; created_by: string | undefined; note: string | undefined }[] = [];
      
      for (let i = 0; i < projectIds.length; i++) {
        for (let j = i + 1; j < projectIds.length; j++) {
          const [a, b] = projectIds[i] < projectIds[j] 
            ? [projectIds[i], projectIds[j]] 
            : [projectIds[j], projectIds[i]];
          pairs.push({
            project_id_a: a,
            project_id_b: b,
            created_by: user?.id,
            note,
          });
        }
      }

      // Use any cast since table was just created and types aren't regenerated yet
      const { error } = await (supabase as any)
        .from('duplicate_ignore_pairs')
        .upsert(pairs, { onConflict: 'project_id_a,project_id_b' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-ignore-pairs'] });
      toast.success('已標記為非重複');
    },
    onError: (error: Error) => {
      toast.error('標記失敗', { description: error.message });
    },
  });

  // Soft delete a project as duplicate
  const softDeleteDuplicateMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('projects')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
          delete_reason: '重複資料清理',
        })
        .eq('id', projectId);

      if (error) throw error;

      // Log to audit
      await supabase.rpc('log_audit_action', {
        p_table_name: 'projects',
        p_record_id: projectId,
        p_action: 'DELETE',
        p_reason: '重複資料清理',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-scanner-projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('案場已移至回收區');
    },
    onError: (error: Error) => {
      toast.error('刪除失敗', { description: error.message });
    },
  });

  return {
    projects,
    isLoading: isLoadingProjects || isLoadingIgnored,
    scanForDuplicates,
    markNotDuplicate: markNotDuplicateMutation.mutateAsync,
    softDeleteDuplicate: softDeleteDuplicateMutation.mutateAsync,
    isMarkingNotDuplicate: markNotDuplicateMutation.isPending,
    isSoftDeleting: softDeleteDuplicateMutation.isPending,
  };
}
