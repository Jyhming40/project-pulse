import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Timeline milestones based on PDF comparison table:
 * 1. 台電審查意見書 (TPC_REVIEW issued_at)
 * 2. 能源署同意備案函 (MOEA_CONSENT issued_at)
 * 3. 台電躉購合約申請 (PPA_APPLY submitted_at or TPC_CONTRACT submitted_at)
 * 4. 台電檢驗與細部協商圖面函 (TPC_NEGOTIATION issued_at)
 * 5. 台電躉購合約蓋章完成 (TPC_CONTRACT issued_at)
 * 6. 免雜項執照同意函 (BUILD_EXEMPT issued_at)
 * 7. 免雜項執照竣工函 (BUILD_EXEMPT_COMP issued_at)
 * 8. 台電驗收掛表作業 (TPC_METER issued_at)
 * 9. 台電派員併聯函 (TPC_CONNECTION issued_at)
 * 10. 能源署設備登記 (MOEA_REGISTER issued_at)
 * 11. 台電正式躉售 (TPC_FIT_OFFICIAL issued_at)
 */

// Document type mappings for comparison timeline
// Each milestone maps to document type codes/labels and uses issued_at date
export const TIMELINE_DOC_MAPPING = [
  { 
    step: 1, 
    label: '台電審查意見書', 
    short: '審查意見',
    doc_type_codes: ['TPC_REVIEW'],
    doc_type_labels: ['審查意見書', '台電審查意見書'],
    date_field: 'issued_at' as const,
    color: '#3b82f6',
  },
  { 
    step: 2, 
    label: '能源署同意備案函', 
    short: '同意備案',
    doc_type_codes: ['MOEA_CONSENT'],
    doc_type_labels: ['同意備案', '能源署同意備案', '能源署同意備案函', '綠能容許'],
    date_field: 'issued_at' as const,
    color: '#10b981',
  },
  { 
    step: 3, 
    label: '台電躉購合約申請', 
    short: '躉購申請',
    doc_type_codes: ['TPC_CONTRACT'], // 躉售合約的submitted_at = 申請日
    doc_type_labels: ['躉售合約', '躉購合約申請', '台電躉購合約申請'],
    date_field: 'submitted_at' as const, // Uses submitted_at for application
    color: '#8b5cf6',
  },
  { 
    step: 4, 
    label: '台電檢驗與細部協商圖面函', 
    short: '細部協商',
    doc_type_codes: ['TPC_NEGOTIATION'],
    doc_type_labels: ['細部協商', '台電細部協商', '台電檢驗與細部協商圖面函', '細部協商圖面函'],
    date_field: 'issued_at' as const,
    color: '#14b8a6',
  },
  { 
    step: 5, 
    label: '台電躉購合約蓋章完成', 
    short: '躉售合約',
    doc_type_codes: ['TPC_CONTRACT'],
    doc_type_labels: ['躉售合約', '躉購合約', '台電躉購合約', '台電躉購合約蓋章完成'],
    date_field: 'issued_at' as const,
    color: '#f59e0b',
  },
  { 
    step: 6, 
    label: '免雜項執照同意函', 
    short: '免雜同意',
    doc_type_codes: ['BUILD_EXEMPT_APP'], // 免雜項申請
    doc_type_labels: ['免雜項執照同意函', '免雜項同意', '免雜同意', '免雜項執照', '免雜項申請'],
    date_field: 'issued_at' as const,
    color: '#06b6d4',
  },
  { 
    step: 7, 
    label: '免雜項執照竣工函', 
    short: '免雜竣工',
    doc_type_codes: ['BUILD_EXEMPT_COMP'], // 免雜項竣工
    doc_type_labels: ['免雜項執照竣工函', '免雜項竣工', '免雜竣工', '免雜項執照竣工'],
    date_field: 'issued_at' as const,
    color: '#ef4444',
  },
  { 
    step: 8, 
    label: '台電驗收掛表作業', 
    short: '報竣掛表',
    doc_type_codes: ['__USE_ACTUAL_METER_DATE__'], // 使用 projects.actual_meter_date
    doc_type_labels: ['報竣掛表', '台電驗收掛表', '台電驗收掛表作業', '電表掛表', '掛表'],
    date_field: 'issued_at' as const, // ignored, uses actual_meter_date
    use_project_field: 'actual_meter_date' as const, // special flag
    color: '#ec4899',
  },
  { 
    step: 9, 
    label: '台電派員併聯函', 
    short: '派員併聯',
    doc_type_codes: ['TPC_INSPECTION'], // 派員訪查併聯函
    doc_type_labels: ['派員訪查併聯函', '台電派員併聯函', '派員併聯', '併聯函'],
    date_field: 'issued_at' as const,
    color: '#6366f1',
  },
  { 
    step: 10, 
    label: '能源署設備登記', 
    short: '設備登記',
    doc_type_codes: ['MOEA_REGISTER'],
    doc_type_labels: ['設備登記', '能源署設備登記', '設備登記函'],
    date_field: 'issued_at' as const,
    color: '#f97316',
  },
  { 
    step: 11, 
    label: '台電正式躉售', 
    short: '正式躉售',
    doc_type_codes: ['TPC_FORMAL_FIT'], // 正式躉售
    doc_type_labels: ['正式躉售', '台電正式躉售', '躉售函'],
    date_field: 'issued_at' as const,
    color: '#a855f7',
  },
] as const;

// Comparison pairs based on PDF intervals
export const COMPARISON_PAIRS = [
  {
    id: 'interval_01_02',
    label: '審查意見→同意備案',
    description: '台電審查意見書 → 能源署同意備案函',
    fromStep: 1,
    toStep: 2,
    fitOnly: false,
  },
  {
    id: 'interval_02_03',
    label: '同意備案→躉購申請',
    description: '能源署同意備案函 → 台電躉購合約申請',
    fromStep: 2,
    toStep: 3,
    fitOnly: false,
  },
  {
    id: 'interval_03_04',
    label: '躉購申請→細部協商',
    description: '台電躉購合約申請 → 台電檢驗與細部協商圖面函',
    fromStep: 3,
    toStep: 4,
    fitOnly: false,
  },
  {
    id: 'interval_04_05',
    label: '細部協商→躉售合約',
    description: '台電檢驗與細部協商圖面函 → 台電躉購合約蓋章完成',
    fromStep: 4,
    toStep: 5,
    fitOnly: false,
  },
  {
    id: 'interval_05_06',
    label: '躉售合約→免雜同意',
    description: '台電躉購合約蓋章完成 → 免雜項執照同意函',
    fromStep: 5,
    toStep: 6,
    fitOnly: false,
  },
  {
    id: 'interval_06_07',
    label: '免雜同意→免雜竣工',
    description: '免雜項執照同意函 → 免雜項執照竣工函',
    fromStep: 6,
    toStep: 7,
    fitOnly: false,
  },
  {
    id: 'interval_07_08',
    label: '免雜竣工→報竣掛表',
    description: '免雜項執照竣工函 → 台電驗收掛表作業',
    fromStep: 7,
    toStep: 8,
    fitOnly: false,
  },
  {
    id: 'interval_08_09',
    label: '報竣掛表→派員併聯',
    description: '台電驗收掛表作業 → 台電派員併聯函',
    fromStep: 8,
    toStep: 9,
    fitOnly: false,
  },
  {
    id: 'interval_09_10',
    label: '派員併聯→設備登記',
    description: '台電派員併聯函 → 能源署設備登記',
    fromStep: 9,
    toStep: 10,
    fitOnly: false,
  },
  {
    id: 'interval_10_11',
    label: '設備登記→正式躉售',
    description: '能源署設備登記 → 台電正式躉售',
    fromStep: 10,
    toStep: 11,
    fitOnly: false,
  },
  // Summary intervals (from PDF)
  {
    id: 'interval_total',
    label: '完整流程',
    description: '台電審查意見書 → 台電正式躉售 (項次11-項次1)',
    fromStep: 1,
    toStep: 11,
    fitOnly: false,
  },
  {
    id: 'interval_02_08',
    label: '同備到掛表',
    description: '能源署同意備案函 → 台電驗收掛表作業 (項次8-項次2)',
    fromStep: 2,
    toStep: 8,
    fitOnly: false,
  },
  {
    id: 'interval_05_08',
    label: '簽約到掛表',
    description: '台電躉購合約蓋章完成 → 台電驗收掛表作業 (項次8-項次5)',
    fromStep: 5,
    toStep: 8,
    fitOnly: false,
  },
  {
    id: 'interval_08_10',
    label: '掛表到設備登記',
    description: '台電驗收掛表作業 → 能源署設備登記 (項次10-項次8)',
    fromStep: 8,
    toStep: 10,
    fitOnly: false,
  },
] as const;

// For backward compatibility with chart
export const TIMELINE_MILESTONES = TIMELINE_DOC_MAPPING.map(m => ({
  code: `STEP_${m.step.toString().padStart(2, '0')}`,
  label: m.short,
  color: m.color,
  step: m.step,
}));

export type ComparisonPair = typeof COMPARISON_PAIRS[number];

export interface ProjectForComparison {
  id: string;
  project_name: string;
  project_code: string;
  created_at: string;
  revenue_model: string | null;
  installation_type: string | null;
  intake_year: number | null;
}

export interface DocumentDate {
  step: number;
  date: string | null;
  doc_type: string | null;
}

export interface ComparisonResult {
  project: ProjectForComparison;
  documentDates: Record<number, DocumentDate>; // step -> date info
  intervals: Record<string, IntervalResult>; // pair.id -> result
  isBaseline: boolean;
}

export interface IntervalResult {
  fromDate: string | null;
  toDate: string | null;
  days: number | null;
  delta: number | null; // difference from baseline
  status: 'complete' | 'incomplete' | 'na';
}

export interface ComparisonStats {
  pairId: string;
  count: number;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
}

// Extract year from project_code
export function extractProjectYear(project: ProjectForComparison): number {
  const codeMatch = project.project_code.match(/-(\d{4})$/);
  if (codeMatch) return parseInt(codeMatch[1], 10);
  
  const startMatch = project.project_code.match(/^(\d{4})/);
  if (startMatch) return parseInt(startMatch[1], 10);
  
  if (project.intake_year) return project.intake_year;
  
  return new Date(project.created_at).getFullYear();
}

// Fetch all projects for selector
export function useProjectsForComparison() {
  return useQuery({
    queryKey: ['projects-for-comparison'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, project_code, created_at, revenue_model, installation_type, intake_year')
        .eq('is_deleted', false)
        .order('project_name', { ascending: true });

      if (error) throw error;
      return data as ProjectForComparison[];
    },
  });
}

// Get unique years from projects
export function useProjectYears() {
  return useQuery({
    queryKey: ['project-years'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('intake_year, created_at')
        .eq('is_deleted', false);

      if (error) throw error;

      const years = new Set<number>();
      data?.forEach(p => {
        if (p.intake_year) {
          years.add(p.intake_year);
        } else if (p.created_at) {
          years.add(new Date(p.created_at).getFullYear());
        }
      });

      return Array.from(years).sort((a, b) => b - a);
    },
  });
}

// Main comparison hook - fetches document dates directly
export function useComparisonDataManual(
  baselineProjectId: string | null,
  comparisonProjectIds: string[]
) {
  return useQuery({
    queryKey: ['comparison-data-manual', baselineProjectId, comparisonProjectIds],
    queryFn: async () => {
      if (!baselineProjectId) return null;

      // 1. Get baseline project (include actual_meter_date)
      const { data: baselineProject, error: baselineError } = await supabase
        .from('projects')
        .select('id, project_name, project_code, created_at, revenue_model, installation_type, intake_year, actual_meter_date')
        .eq('id', baselineProjectId)
        .single();

      if (baselineError) throw baselineError;

      // 2. Get all comparison projects (include actual_meter_date)
      const allProjectIds = [baselineProjectId, ...comparisonProjectIds];
      const { data: allProjectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, project_name, project_code, created_at, revenue_model, installation_type, intake_year, actual_meter_date')
        .in('id', allProjectIds);

      if (projectsError) throw projectsError;

      const projectsMap = new Map(allProjectsData?.map(p => [p.id, p]));
      const allProjects = [
        baselineProject,
        ...comparisonProjectIds.map(id => projectsMap.get(id)).filter(Boolean),
      ] as (ProjectForComparison & { actual_meter_date?: string | null })[];

      const baselineYear = extractProjectYear(baselineProject as ProjectForComparison);

      // 3. Get ALL documents for these projects
      const { data: allDocuments, error: docError } = await supabase
        .from('documents')
        .select('id, project_id, doc_type, doc_type_code, submitted_at, issued_at')
        .in('project_id', allProjectIds)
        .eq('is_current', true)
        .eq('is_deleted', false);

      if (docError) throw docError;

      // 4. Build document date lookup per project per step
      const docDatesMap: Record<string, Record<number, DocumentDate>> = {};
      
      for (const projectId of allProjectIds) {
        docDatesMap[projectId] = {};
        const projectDocs = (allDocuments || []).filter(d => d.project_id === projectId);
        const projectData = projectsMap.get(projectId);
        
        // For each step, find matching document and extract date
        for (const mapping of TIMELINE_DOC_MAPPING) {
          // Special case: use project field instead of document
          if ('use_project_field' in mapping && mapping.use_project_field) {
            const fieldValue = (projectData as any)?.[mapping.use_project_field];
            docDatesMap[projectId][mapping.step] = {
              step: mapping.step,
              date: fieldValue || null,
              doc_type: mapping.label,
            };
            continue;
          }
          
          let matchedDoc = null;
          
          // Search by doc_type_code first
          for (const code of mapping.doc_type_codes) {
            const found = projectDocs.find(d => d.doc_type_code === code);
            if (found) {
              matchedDoc = found;
              break;
            }
          }
          
          // Search by doc_type label if not found
          if (!matchedDoc) {
            for (const label of mapping.doc_type_labels) {
              const found = projectDocs.find(d => 
                d.doc_type?.includes(label) || d.doc_type === label
              );
              if (found) {
                matchedDoc = found;
                break;
              }
            }
          }
          
          // Extract date based on date_field
          let date: string | null = null;
          if (matchedDoc) {
            date = mapping.date_field === 'submitted_at' 
              ? (matchedDoc.submitted_at || matchedDoc.issued_at)
              : matchedDoc.issued_at;
          }
          
          docDatesMap[projectId][mapping.step] = {
            step: mapping.step,
            date,
            doc_type: matchedDoc?.doc_type || null,
          };
        }
      }

      // 5. Calculate intervals for each project
      const calculateIntervals = (
        projectId: string,
        baselineDates: Record<number, DocumentDate> | undefined
      ): Record<string, IntervalResult> => {
        const projectDates = docDatesMap[projectId] || {};
        const intervals: Record<string, IntervalResult> = {};

        for (const pair of COMPARISON_PAIRS) {
          const fromDate = projectDates[pair.fromStep]?.date || null;
          const toDate = projectDates[pair.toStep]?.date || null;

          if (fromDate && toDate) {
            const from = new Date(fromDate);
            const to = new Date(toDate);
            const days = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

            // Calculate delta from baseline
            let delta: number | null = null;
            if (baselineDates) {
              const baselineFrom = baselineDates[pair.fromStep]?.date;
              const baselineTo = baselineDates[pair.toStep]?.date;
              if (baselineFrom && baselineTo) {
                const baseFromDate = new Date(baselineFrom);
                const baseToDate = new Date(baselineTo);
                const baselineDays = Math.floor(
                  (baseToDate.getTime() - baseFromDate.getTime()) / (1000 * 60 * 60 * 24)
                );
                delta = days - baselineDays;
              }
            }

            intervals[pair.id] = {
              fromDate,
              toDate,
              days,
              delta,
              status: 'complete',
            };
          } else {
            intervals[pair.id] = {
              fromDate,
              toDate,
              days: null,
              delta: null,
              status: 'incomplete',
            };
          }
        }

        return intervals;
      };

      // Process baseline first
      const baselineDates = docDatesMap[baselineProject.id];
      const results: ComparisonResult[] = allProjects.map((project, index) => ({
        project,
        documentDates: docDatesMap[project.id] || {},
        intervals: calculateIntervals(
          project.id,
          index === 0 ? undefined : baselineDates
        ),
        isBaseline: index === 0,
      }));

      // Calculate statistics (only for first 10 pairs, exclude summary intervals)
      const statPairs = COMPARISON_PAIRS.slice(0, 10);
      const stats: ComparisonStats[] = statPairs.map(pair => {
        const validDays = results
          .filter(r => !r.isBaseline && r.intervals[pair.id]?.status === 'complete')
          .map(r => r.intervals[pair.id].days!)
          .filter(d => d !== null);

        if (validDays.length === 0) {
          return {
            pairId: pair.id,
            count: 0,
            average: null,
            median: null,
            min: null,
            max: null,
          };
        }

        const sorted = [...validDays].sort((a, b) => a - b);
        const sum = validDays.reduce((a, b) => a + b, 0);
        const median =
          sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];

        return {
          pairId: pair.id,
          count: validDays.length,
          average: Math.round(sum / validDays.length),
          median: Math.round(median),
          min: sorted[0],
          max: sorted[sorted.length - 1],
        };
      });

      return {
        baseline: baselineProject,
        baselineYear,
        results,
        stats,
        totalCompared: comparisonProjectIds.length,
        docDatesMap,
      };
    },
    enabled: !!baselineProjectId,
  });
}

// Generate CSV export
export function generateComparisonCSV(results: ComparisonResult[]): string {
  const headers = ['案件名稱', '案件編號'];
  
  // Add step headers
  for (const mapping of TIMELINE_DOC_MAPPING) {
    headers.push(`${mapping.step}.${mapping.short}`);
  }
  
  // Add interval headers
  headers.push('完整流程(天)', '同備到掛表(天)', '簽約到掛表(天)', '掛表到設備登記(天)');
  
  const rows: string[][] = [];
  
  for (const r of results) {
    const row: string[] = [
      r.project.project_name,
      r.project.project_code,
    ];
    
    // Add dates for each step
    for (const mapping of TIMELINE_DOC_MAPPING) {
      const date = r.documentDates[mapping.step]?.date;
      row.push(date ? date.split('T')[0] : '');
    }
    
    // Add summary intervals
    row.push(
      r.intervals['interval_total']?.days?.toString() || '',
      r.intervals['interval_02_08']?.days?.toString() || '',
      r.intervals['interval_05_08']?.days?.toString() || '',
      r.intervals['interval_08_10']?.days?.toString() || '',
    );
    
    rows.push(row);
  }
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  return csv;
}

// Generate legal summary with charts and analysis
export function generateLegalSummary(results: ComparisonResult[]): string {
  const baseline = results.find(r => r.isBaseline);
  if (!baseline) return '';
  
  const others = results.filter(r => !r.isBaseline && r.intervals['interval_total']?.status === 'complete');
  
  const baselineTotal = baseline.intervals['interval_total']?.days;
  const avgTotal = others.length > 0 
    ? Math.round(others.reduce((sum, r) => sum + (r.intervals['interval_total']?.days || 0), 0) / others.length)
    : null;
  
  let summary = `## 案件進度比較分析報告\n\n`;
  summary += `### 一、基準案件資訊\n\n`;
  summary += `- **案件名稱：** ${baseline.project.project_name}\n`;
  summary += `- **案件編號：** ${baseline.project.project_code}\n`;
  summary += `- **完整流程耗時：** ${baselineTotal !== null ? `${baselineTotal} 天` : '未完成'}\n`;
  summary += `- **同期案件平均：** ${avgTotal !== null ? `${avgTotal} 天` : 'N/A'}\n`;
  
  if (baselineTotal !== null && avgTotal !== null) {
    const diff = baselineTotal - avgTotal;
    summary += `\n**差異分析：** 基準案件${diff > 0 ? `落後同期平均 ${diff} 天` : diff < 0 ? `領先同期平均 ${Math.abs(diff)} 天` : '與同期平均相當'}\n`;
  }
  
  // Add comparison projects list
  summary += `\n### 二、比較案件清單\n\n`;
  for (const r of results) {
    if (r.isBaseline) continue;
    const total = r.intervals['interval_total']?.days;
    summary += `- ${r.project.project_name} (${r.project.project_code}): ${total !== null ? `${total} 天` : '未完成'}\n`;
  }
  
  // Add stage duration analysis (text-based bar chart)
  summary += `\n### 三、階段耗時差異分析圖（長條圖）\n\n`;
  summary += `以下為各案件完整流程耗時的視覺化比較：\n\n`;
  summary += `\`\`\`\n`;
  
  // Find max days for scaling
  const allTotals = results
    .map(r => r.intervals['interval_total']?.days)
    .filter((d): d is number => d !== null);
  const maxDays = Math.max(...allTotals, 1);
  const barWidth = 40;
  
  for (const r of results) {
    const total = r.intervals['interval_total']?.days;
    const nameWidth = 20;
    const name = r.project.project_name.length > nameWidth 
      ? r.project.project_name.substring(0, nameWidth - 2) + '..'
      : r.project.project_name.padEnd(nameWidth);
    
    if (total !== null) {
      const barLength = Math.round((total / maxDays) * barWidth);
      const bar = '█'.repeat(barLength);
      const isBaseline = r.isBaseline ? ' [基準]' : '';
      summary += `${name} │${bar} ${total}天${isBaseline}\n`;
    } else {
      summary += `${name} │ (未完成)\n`;
    }
  }
  summary += `\`\`\`\n`;
  
  // Add stage-by-step analysis table
  summary += `\n### 四、階段耗時差異表\n\n`;
  summary += `此表計算各階段的「耗費天數」，日期來源為文件的發文日或送件日。\n`;
  summary += `紅色(+)代表落後基準案件，綠色(-)代表領先基準案件。\n\n`;
  
  // Table header
  summary += `| 步驟 | 比較階段 | `;
  for (const r of results) {
    const label = r.isBaseline ? `${r.project.project_name} (基準)` : r.project.project_name;
    summary += `${label} | `;
  }
  summary += `同期平均 |\n`;
  
  summary += `| --- | --- | ${results.map(() => '---').join(' | ')} | --- |\n`;
  
  // Get step pairs for analysis
  const stepPairs = COMPARISON_PAIRS.slice(0, 10);
  
  for (const pair of stepPairs) {
    const stepNum = parseInt(pair.id.split('_')[1]) + 1;
    summary += `| ${stepNum} | ${pair.label} | `;
    
    // Get baseline days for this pair
    const baselineInterval = baseline.intervals[pair.id];
    const baselineDays = baselineInterval?.status === 'complete' ? baselineInterval.days : null;
    
    // Calculate average
    const validDays = results
      .filter(r => !r.isBaseline && r.intervals[pair.id]?.status === 'complete')
      .map(r => r.intervals[pair.id].days!)
      .filter(d => d !== null);
    const average = validDays.length > 0 
      ? Math.round(validDays.reduce((a, b) => a + b, 0) / validDays.length)
      : null;
    
    for (const r of results) {
      const interval = r.intervals[pair.id];
      if (!interval || interval.status !== 'complete') {
        summary += `- | `;
      } else {
        const days = interval.days;
        if (r.isBaseline) {
          summary += `${days}天 (基準) | `;
        } else {
          const delta = baselineDays !== null ? days! - baselineDays : null;
          if (delta !== null && delta !== 0) {
            const sign = delta > 0 ? '+' : '';
            summary += `${days}天 (${sign}${delta}) | `;
          } else {
            summary += `${days}天 | `;
          }
        }
      }
    }
    
    summary += `${average !== null ? `${average}天` : '-'} |\n`;
  }
  
  // Add summary intervals
  summary += `\n### 五、總結區間\n\n`;
  const summaryPairs = COMPARISON_PAIRS.slice(10);
  
  for (const pair of summaryPairs) {
    summary += `**${pair.label}** (${pair.description})：\n`;
    for (const r of results) {
      const interval = r.intervals[pair.id];
      const days = interval?.status === 'complete' ? interval.days : null;
      const label = r.isBaseline ? `[基準] ${r.project.project_name}` : r.project.project_name;
      summary += `  - ${label}: ${days !== null ? `${days} 天` : '未完成'}\n`;
    }
    summary += '\n';
  }
  
  return summary;
}

// Generate legal table (milestone dates)
export function generateLegalTable(results: ComparisonResult[]): string {
  let table = `### 六、里程碑日期詳細對照表\n\n`;
  table += `| 項次 | 里程碑 | `;
  
  for (const r of results) {
    const label = r.isBaseline ? `${r.project.project_name} (基準)` : r.project.project_name;
    table += `${label} | `;
  }
  table += '\n';
  
  table += `| --- | --- | ${results.map(() => '---').join(' | ')} |\n`;
  
  for (const mapping of TIMELINE_DOC_MAPPING) {
    table += `| ${mapping.step} | ${mapping.label} | `;
    for (const r of results) {
      const date = r.documentDates[mapping.step]?.date;
      table += `${date ? date.split('T')[0] : '-'} | `;
    }
    table += '\n';
  }
  
  return table;
}
