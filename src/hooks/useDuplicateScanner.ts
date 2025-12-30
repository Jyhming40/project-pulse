import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ReviewDecision = 'dismiss' | 'confirm' | 'merged';

export interface MatchCriteria {
  name: string;
  matched: boolean;
  value?: string;
  score?: number;
}

export interface DuplicateGroup {
  id: string;
  confidenceLevel: ConfidenceLevel;
  matchedCriteria: MatchCriteria[];
  unmatchedCriteria: MatchCriteria[];
  projects: ProjectForComparison[];
  addressSimilarity: number;
  nameSimilarity: number;
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
  status_history_count: number;
}

// Utility function to normalize strings for comparison
function normalizeString(str: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]/g, '')
    .trim();
}

// Calculate string similarity (Dice coefficient)
function stringSimilarity(str1: string | null, str2: string | null): number {
  if (!str1 || !str2) return 0;
  
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

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

// Extract address tokens for comparison
function extractAddressTokens(address: string | null): Set<string> {
  if (!address) return new Set();
  
  const tokens = new Set<string>();
  const normalized = address.replace(/\s+/g, '');
  
  // Extract road/street names (路、街、巷、弄、段)
  const roadMatch = normalized.match(/[\u4e00-\u9fff]+[路街]/);
  if (roadMatch) tokens.add(roadMatch[0]);
  
  // Extract section (段)
  const sectionMatch = normalized.match(/[\u4e00-\u9fff一二三四五六七八九十]+段/);
  if (sectionMatch) tokens.add(sectionMatch[0]);
  
  // Extract lot numbers (地號)
  const lotMatch = normalized.match(/\d+(-\d+)?地號/);
  if (lotMatch) tokens.add(lotMatch[0]);
  
  // Extract lane (巷)
  const laneMatch = normalized.match(/\d+巷/);
  if (laneMatch) tokens.add(laneMatch[0]);
  
  // Extract alley (弄)
  const alleyMatch = normalized.match(/\d+弄/);
  if (alleyMatch) tokens.add(alleyMatch[0]);
  
  return tokens;
}

// Check address token overlap
function getAddressTokenOverlap(addr1: string | null, addr2: string | null): number {
  const tokens1 = extractAddressTokens(addr1);
  const tokens2 = extractAddressTokens(addr2);
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  let overlap = 0;
  tokens1.forEach(t => {
    if (tokens2.has(t)) overlap++;
  });
  
  return overlap / Math.max(tokens1.size, tokens2.size);
}

// Check if capacity is similar (within percentage threshold)
function capacityDifferencePercent(cap1: number | null, cap2: number | null): number {
  if (!cap1 || !cap2) return 100;
  const diff = Math.abs(cap1 - cap2);
  const avg = (cap1 + cap2) / 2;
  return (diff / avg) * 100;
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

      const projectIds = (data || []).map(p => p.id);
      
      // Fetch document counts
      const { data: docCounts, error: docError } = await supabase
        .from('documents')
        .select('project_id')
        .eq('is_deleted', false)
        .in('project_id', projectIds);

      if (docError) throw docError;

      // Fetch status history counts
      const { data: statusCounts, error: statusError } = await supabase
        .from('project_status_history')
        .select('project_id')
        .in('project_id', projectIds);

      if (statusError) throw statusError;

      const docCountMap: Record<string, number> = {};
      (docCounts || []).forEach(doc => {
        docCountMap[doc.project_id] = (docCountMap[doc.project_id] || 0) + 1;
      });

      const statusCountMap: Record<string, number> = {};
      (statusCounts || []).forEach(s => {
        statusCountMap[s.project_id] = (statusCountMap[s.project_id] || 0) + 1;
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
        status_history_count: statusCountMap[p.id] || 0,
      })) as ProjectForComparison[];
    },
  });

  // Fetch reviewed pairs (both from duplicate_reviews and duplicate_ignore_pairs)
  const { data: reviewedPairs = [], isLoading: isLoadingReviewed } = useQuery({
    queryKey: ['duplicate-reviewed-pairs'],
    queryFn: async () => {
      // Fetch from duplicate_reviews
      const { data: reviews, error: reviewError } = await (supabase as any)
        .from('duplicate_reviews')
        .select('project_id_a, project_id_b, decision');

      if (reviewError) throw reviewError;

      // Fetch from legacy duplicate_ignore_pairs
      const { data: ignorePairs, error: ignoreError } = await (supabase as any)
        .from('duplicate_ignore_pairs')
        .select('project_id_a, project_id_b');

      if (ignoreError) throw ignoreError;

      const pairs: { a: string; b: string; decision?: string }[] = [];
      
      (reviews || []).forEach((r: any) => {
        pairs.push({ a: r.project_id_a, b: r.project_id_b, decision: r.decision });
      });

      (ignorePairs || []).forEach((p: any) => {
        // Check if not already in reviews
        const exists = pairs.some(pair => pair.a === p.project_id_a && pair.b === p.project_id_b);
        if (!exists) {
          pairs.push({ a: p.project_id_a, b: p.project_id_b, decision: 'dismiss' });
        }
      });

      return pairs;
    },
  });

  // Check if a pair has been reviewed
  const isPairReviewed = (id1: string, id2: string): boolean => {
    const [a, b] = id1 < id2 ? [id1, id2] : [id2, id1];
    return reviewedPairs.some(pair => pair.a === a && pair.b === b);
  };

  // Scan for duplicates with improved rules
  const scanForDuplicates = (): DuplicateGroup[] => {
    const groups: DuplicateGroup[] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const p1 = projects[i];
        const p2 = projects[j];
        
        // Skip if this pair has been reviewed
        if (isPairReviewed(p1.id, p2.id)) continue;

        const pairKey = `${p1.id}-${p2.id}`;
        if (processedPairs.has(pairKey)) continue;

        // Calculate similarities
        const addressSimilarity = stringSimilarity(p1.address, p2.address) * 100;
        const nameSimilarity = stringSimilarity(p1.project_name, p2.project_name) * 100;
        const addressTokenOverlap = getAddressTokenOverlap(p1.address, p2.address);
        const capacityDiff = capacityDifferencePercent(p1.capacity_kwp, p2.capacity_kwp);
        
        const sameInvestor = !!(p1.investor_id && p2.investor_id && p1.investor_id === p2.investor_id);
        const sameCity = !!(p1.city && p2.city && p1.city === p2.city);
        const sameTownship = !!(p1.district && p2.district && p1.district === p2.district);
        
        // ===== NULL SAFETY: Only match if BOTH values are non-null =====
        const sameSiteCode = !!(
          p1.site_code_display && 
          p2.site_code_display && 
          p1.site_code_display === p2.site_code_display
        );
        
        // For investor+year+seq, ALL THREE fields must be non-null on BOTH projects
        const hasValidInvestorYearSeq1 = !!(p1.investor_code && p1.intake_year != null && p1.seq != null);
        const hasValidInvestorYearSeq2 = !!(p2.investor_code && p2.intake_year != null && p2.seq != null);
        const sameInvestorYearSeq = hasValidInvestorYearSeq1 && hasValidInvestorYearSeq2 &&
          p1.investor_code === p2.investor_code &&
          p1.intake_year === p2.intake_year &&
          p1.seq === p2.seq;

        // Track why high confidence is not available
        const highConfidenceBlockers: string[] = [];
        if (!p1.site_code_display || !p2.site_code_display) {
          highConfidenceBlockers.push('案場代碼有空值');
        }
        if (!hasValidInvestorYearSeq1 || !hasValidInvestorYearSeq2) {
          if (!p1.seq || !p2.seq) {
            highConfidenceBlockers.push('序號為空');
          }
          if (!p1.investor_code || !p2.investor_code) {
            highConfidenceBlockers.push('投資代碼為空');
          }
          if (p1.intake_year == null || p2.intake_year == null) {
            highConfidenceBlockers.push('年份為空');
          }
        }

        // ======= HARD EXCLUSIONS (A, B rules) =======
        // Rule 1: If BOTH address_similarity < 40 AND name_similarity < 40 → EXCLUDE
        if (addressSimilarity < 40 && nameSimilarity < 40) {
          continue;
        }

        // Rule 2: Capacity difference > 50% → EXCLUDE
        if (capacityDiff > 50) {
          continue;
        }

        // Rule 3: Different township → EXCLUDE
        if (!sameTownship) {
          continue;
        }

        // Rule 4: Any identifier field is null on either side → cannot be high confidence
        // (handled by null checks above, but we continue if no other criteria can match)

        // ======= CONFIDENCE LEVEL DETERMINATION =======
        const matchedCriteria: MatchCriteria[] = [];
        const unmatchedCriteria: MatchCriteria[] = [];
        let confidenceLevel: ConfidenceLevel | null = null;

        // --- HIGH CONFIDENCE CHECKS (C rules) ---
        // High confidence ONLY for strong identifiers with non-null values
        if (sameSiteCode) {
          matchedCriteria.push({ name: '案場代碼完全相同', matched: true, value: p1.site_code_display! });
          confidenceLevel = 'high';
        }

        if (sameInvestorYearSeq) {
          matchedCriteria.push({ 
            name: '投資代碼 + 年份 + 序號相同', 
            matched: true, 
            value: `${p1.investor_code}-${p1.intake_year}-${p1.seq}`
          });
          confidenceLevel = 'high';
        }

        // Add blockers to unmatched criteria for UI display
        if (!sameSiteCode) {
          unmatchedCriteria.push({ name: '案場代碼相同', matched: false });
        }
        if (!sameInvestorYearSeq) {
          const reason = highConfidenceBlockers.length > 0 
            ? highConfidenceBlockers.join('、') 
            : '值不相同';
          unmatchedCriteria.push({ 
            name: '投資代碼+年份+序號相同', 
            matched: false,
            value: reason
          });
        }

        // --- MEDIUM CONFIDENCE CHECKS (D rules) ---
        // Must satisfy at least one PRIMARY condition: address_similarity >= 80 OR name_similarity >= 75
        if (!confidenceLevel) {
          const hasAddressPrimary = addressSimilarity >= 80;
          const hasNamePrimary = nameSimilarity >= 75;
          const hasPrimaryCondition = hasAddressPrimary || hasNamePrimary;
          
          if (hasPrimaryCondition) {
            if (hasAddressPrimary) {
              matchedCriteria.push({ 
                name: '地址高度相似', 
                matched: true, 
                score: Math.round(addressSimilarity),
                value: `${Math.round(addressSimilarity)}%`
              });
            }
            
            if (hasNamePrimary) {
              matchedCriteria.push({ 
                name: '名稱高度相似', 
                matched: true, 
                score: Math.round(nameSimilarity),
                value: `${Math.round(nameSimilarity)}%`
              });
            }

            // Auxiliary conditions (add to matched list but don't determine confidence alone)
            if (sameInvestor) {
              matchedCriteria.push({ name: '同投資方', matched: true, value: p1.investor_name || p1.investor_code || '' });
            }

            if (sameTownship) {
              matchedCriteria.push({ name: '同鄉鎮市區', matched: true, value: `${p1.city}${p1.district}` });
            }

            if (capacityDiff <= 15) {
              matchedCriteria.push({ 
                name: '容量接近', 
                matched: true, 
                value: `差距 ${capacityDiff.toFixed(1)}%` 
              });
            }

            confidenceLevel = 'medium';
          }
        }

        // --- LOW CONFIDENCE CHECKS ---
        if (!confidenceLevel) {
          // Low confidence: same investor + same township + capacity within 15%
          // But must NOT have extremely low similarity (already filtered by hard exclusion)
          if (sameInvestor && sameTownship && capacityDiff <= 15) {
            matchedCriteria.push({ name: '同投資方', matched: true, value: p1.investor_name || '' });
            matchedCriteria.push({ name: '同鄉鎮市區', matched: true, value: `${p1.city}${p1.district}` });
            matchedCriteria.push({ name: '容量接近', matched: true, value: `差距 ${capacityDiff.toFixed(1)}%` });
            
            // Add similarity scores as unmatched since they didn't meet threshold
            unmatchedCriteria.push({ 
              name: '地址相似度', 
              matched: false, 
              value: `${Math.round(addressSimilarity)}% (需≥80%)`
            });
            unmatchedCriteria.push({ 
              name: '名稱相似度', 
              matched: false, 
              value: `${Math.round(nameSimilarity)}% (需≥75%)`
            });
            
            confidenceLevel = 'low';
          }
        }

        // Add remaining unmatched criteria for display
        if (confidenceLevel) {
          if (!sameInvestor && !matchedCriteria.some(c => c.name === '同投資方')) {
            unmatchedCriteria.push({ name: '同投資方', matched: false });
          }
          if (capacityDiff > 15 && !matchedCriteria.some(c => c.name === '容量接近')) {
            unmatchedCriteria.push({ name: '容量接近', matched: false, value: `差距 ${capacityDiff.toFixed(1)}%` });
          }
          if (addressSimilarity < 80 && !matchedCriteria.some(c => c.name === '地址高度相似') && !unmatchedCriteria.some(c => c.name === '地址相似度')) {
            unmatchedCriteria.push({ 
              name: '地址相似度', 
              matched: false, 
              value: `${Math.round(addressSimilarity)}%`
            });
          }
          if (nameSimilarity < 75 && !matchedCriteria.some(c => c.name === '名稱高度相似') && !unmatchedCriteria.some(c => c.name === '名稱相似度')) {
            unmatchedCriteria.push({ 
              name: '名稱相似度', 
              matched: false, 
              value: `${Math.round(nameSimilarity)}%`
            });
          }

          processedPairs.add(pairKey);
          
          groups.push({
            id: `group-${groups.length + 1}`,
            confidenceLevel,
            matchedCriteria,
            unmatchedCriteria,
            projects: [p1, p2],
            addressSimilarity,
            nameSimilarity,
          });
        }
      }
    }

    // Sort by confidence level (high first)
    const order: Record<ConfidenceLevel, number> = { high: 0, medium: 1, low: 2 };
    return groups.sort((a, b) => order[a.confidenceLevel] - order[b.confidenceLevel]);
  };

  // Dismiss pair (mark as not duplicate)
  const dismissPairMutation = useMutation({
    mutationFn: async ({ projectIds, reason }: { projectIds: string[]; reason?: string }) => {
      const pairs: any[] = [];
      
      for (let i = 0; i < projectIds.length; i++) {
        for (let j = i + 1; j < projectIds.length; j++) {
          const [a, b] = projectIds[i] < projectIds[j] 
            ? [projectIds[i], projectIds[j]] 
            : [projectIds[j], projectIds[i]];
          pairs.push({
            project_id_a: a,
            project_id_b: b,
            decision: 'dismiss',
            reason: reason || '使用者判斷非重複',
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString(),
          });
        }
      }

      const { error } = await (supabase as any)
        .from('duplicate_reviews')
        .upsert(pairs, { onConflict: 'project_id_a,project_id_b' });

      if (error) throw error;

      // Log audit action for each pair
      for (const pair of pairs) {
        await supabase.rpc('log_audit_action', {
          p_table_name: 'duplicate_reviews',
          p_record_id: pair.project_id_a,
          p_action: 'CREATE',
          p_reason: `DEDUP_DISMISS: ${reason || '使用者判斷非重複'}`,
          p_new_data: pair,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-reviewed-pairs'] });
      toast.success('已標記為非重複，此組合不會再出現');
    },
    onError: (error: Error) => {
      toast.error('標記失敗', { description: error.message });
    },
  });

  // Confirm duplicate and soft delete
  const confirmAndDeleteMutation = useMutation({
    mutationFn: async ({ 
      keepProjectId, 
      deleteProjectId, 
      reason 
    }: { 
      keepProjectId: string; 
      deleteProjectId: string; 
      reason?: string;
    }) => {
      // Soft delete the duplicate project
      const { error: deleteError } = await supabase
        .from('projects')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
          delete_reason: reason || '確認重複資料清理',
        })
        .eq('id', deleteProjectId);

      if (deleteError) throw deleteError;

      // Record the review decision
      const [a, b] = keepProjectId < deleteProjectId 
        ? [keepProjectId, deleteProjectId] 
        : [deleteProjectId, keepProjectId];

      const { error: reviewError } = await (supabase as any)
        .from('duplicate_reviews')
        .upsert({
          project_id_a: a,
          project_id_b: b,
          decision: 'confirm',
          reason: reason || `保留 ${keepProjectId}，刪除 ${deleteProjectId}`,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        }, { onConflict: 'project_id_a,project_id_b' });

      if (reviewError) throw reviewError;

      // Log audit action
      await supabase.rpc('log_audit_action', {
        p_table_name: 'projects',
        p_record_id: deleteProjectId,
        p_action: 'DELETE',
        p_reason: `DEDUP_CONFIRM: 確認重複，保留案場 ${keepProjectId}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-scanner-projects'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-reviewed-pairs'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('已確認重複並刪除案場');
    },
    onError: (error: Error) => {
      toast.error('處理失敗', { description: error.message });
    },
  });

  // Merge projects
  const mergeProjectsMutation = useMutation({
    mutationFn: async ({ 
      keepProjectId, 
      mergeProjectId,
      mergeDocuments,
      mergeStatusHistory,
      reason,
    }: { 
      keepProjectId: string; 
      mergeProjectId: string;
      mergeDocuments: boolean;
      mergeStatusHistory: boolean;
      reason?: string;
    }) => {
      // Merge documents if requested
      if (mergeDocuments) {
        const { error: docError } = await supabase
          .from('documents')
          .update({ project_id: keepProjectId })
          .eq('project_id', mergeProjectId)
          .eq('is_deleted', false);

        if (docError) throw docError;
      }

      // Merge status history if requested
      if (mergeStatusHistory) {
        const { error: histError } = await supabase
          .from('project_status_history')
          .update({ project_id: keepProjectId })
          .eq('project_id', mergeProjectId);

        if (histError) throw histError;
      }

      // Soft delete the merged project
      const { error: deleteError } = await supabase
        .from('projects')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
          delete_reason: `已合併至案場 ${keepProjectId}`,
        })
        .eq('id', mergeProjectId);

      if (deleteError) throw deleteError;

      // Record the review decision
      const [a, b] = keepProjectId < mergeProjectId 
        ? [keepProjectId, mergeProjectId] 
        : [mergeProjectId, keepProjectId];

      const { error: reviewError } = await (supabase as any)
        .from('duplicate_reviews')
        .upsert({
          project_id_a: a,
          project_id_b: b,
          decision: 'merged',
          reason: reason || `已合併至 ${keepProjectId}`,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        }, { onConflict: 'project_id_a,project_id_b' });

      if (reviewError) throw reviewError;

      // Log audit action
      await supabase.rpc('log_audit_action', {
        p_table_name: 'projects',
        p_record_id: mergeProjectId,
        p_action: 'UPDATE',
        p_reason: `DEDUP_MERGE: 已合併至案場 ${keepProjectId}${mergeDocuments ? '，含文件' : ''}${mergeStatusHistory ? '，含狀態歷史' : ''}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-scanner-projects'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-reviewed-pairs'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('案場合併完成');
    },
    onError: (error: Error) => {
      toast.error('合併失敗', { description: error.message });
    },
  });

  return {
    projects,
    isLoading: isLoadingProjects || isLoadingReviewed,
    scanForDuplicates,
    dismissPair: dismissPairMutation.mutateAsync,
    confirmAndDelete: confirmAndDeleteMutation.mutateAsync,
    mergeProjects: mergeProjectsMutation.mutateAsync,
    isDismissing: dismissPairMutation.isPending,
    isConfirming: confirmAndDeleteMutation.isPending,
    isMerging: mergeProjectsMutation.isPending,
  };
}
