import { useMemo } from 'react';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'] & {
  investors?: { company_name: string } | null;
};

interface DuplicateWarning {
  hasPotentialDuplicates: boolean;
  duplicateProjectIds: string[];
  reason: string;
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

// Check if two projects are potential duplicates (high/medium confidence only)
function isPotentialDuplicate(project1: Project, project2: Project): { isDuplicate: boolean; reason: string } {
  // Skip if same project
  if (project1.id === project2.id) {
    return { isDuplicate: false, reason: '' };
  }
  
  // High confidence: exact site_code_display match (non-null)
  const siteCode1 = (project1 as any).site_code_display;
  const siteCode2 = (project2 as any).site_code_display;
  if (siteCode1 && siteCode2 && siteCode1 === siteCode2) {
    return { isDuplicate: true, reason: '案場編號相同' };
  }
  
  // High confidence: investor_code + year + seq all match (all non-null)
  const inv1 = project1.investor_id;
  const inv2 = project2.investor_id;
  const year1 = (project1 as any).intake_year;
  const year2 = (project2 as any).intake_year;
  const seq1 = (project1 as any).seq;
  const seq2 = (project2 as any).seq;
  
  if (inv1 && inv2 && inv1 === inv2 &&
      year1 != null && year2 != null && year1 === year2 &&
      seq1 != null && seq2 != null && seq1 === seq2) {
    return { isDuplicate: true, reason: '投資方+年份+序號相同' };
  }
  
  // Calculate similarity scores for medium confidence
  const addressSimilarity = stringSimilarity(project1.address, project2.address);
  const nameSimilarity = stringSimilarity(project1.project_name, project2.project_name);
  
  // Hard exclusion: both address and name similarity too low
  if (addressSimilarity < 0.4 && nameSimilarity < 0.4) {
    return { isDuplicate: false, reason: '' };
  }
  
  // Hard exclusion: different townships
  const district1 = (project1 as any).district;
  const district2 = (project2 as any).district;
  if (district1 && district2 && district1 !== district2) {
    return { isDuplicate: false, reason: '' };
  }
  
  // Hard exclusion: capacity difference > 50%
  const capacity1 = (project1 as any).capacity_kwp;
  const capacity2 = (project2 as any).capacity_kwp;
  if (capacity1 && capacity2) {
    const maxCap = Math.max(capacity1, capacity2);
    const minCap = Math.min(capacity1, capacity2);
    if (maxCap > 0 && (maxCap - minCap) / maxCap > 0.5) {
      return { isDuplicate: false, reason: '' };
    }
  }
  
  // Medium confidence: address >= 80% OR name >= 75%
  if (addressSimilarity >= 0.8) {
    return { isDuplicate: true, reason: `地址相似度 ${Math.round(addressSimilarity * 100)}%` };
  }
  if (nameSimilarity >= 0.75) {
    return { isDuplicate: true, reason: `名稱相似度 ${Math.round(nameSimilarity * 100)}%` };
  }
  
  return { isDuplicate: false, reason: '' };
}

/**
 * Hook to check for potential duplicates for all projects
 * Returns a map of projectId -> DuplicateWarning
 */
export function useDuplicateWarnings(projects: Project[]): Map<string, DuplicateWarning> {
  return useMemo(() => {
    const warningMap = new Map<string, DuplicateWarning>();
    
    if (!projects || projects.length < 2) {
      return warningMap;
    }
    
    // Check each pair of projects
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const result = isPotentialDuplicate(projects[i], projects[j]);
        
        if (result.isDuplicate) {
          // Add warning for project i
          const warningI = warningMap.get(projects[i].id) || {
            hasPotentialDuplicates: false,
            duplicateProjectIds: [],
            reason: '',
          };
          warningI.hasPotentialDuplicates = true;
          warningI.duplicateProjectIds.push(projects[j].id);
          if (!warningI.reason) warningI.reason = result.reason;
          warningMap.set(projects[i].id, warningI);
          
          // Add warning for project j
          const warningJ = warningMap.get(projects[j].id) || {
            hasPotentialDuplicates: false,
            duplicateProjectIds: [],
            reason: '',
          };
          warningJ.hasPotentialDuplicates = true;
          warningJ.duplicateProjectIds.push(projects[i].id);
          if (!warningJ.reason) warningJ.reason = result.reason;
          warningMap.set(projects[j].id, warningJ);
        }
      }
    }
    
    return warningMap;
  }, [projects]);
}
