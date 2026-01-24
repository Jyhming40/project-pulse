import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * 時間軸里程碑定義（共 12 個節點）:
 * 0. 初步現勘 (projects.initial_survey_date)
 * 1. 與客戶簽訂合約 (projects.contract_signed_at)
 * 2. 台電審查意見書 (TPC_REVIEW issued_at)
 * 3. 能源署同意備案 (MOEA_CONSENT issued_at)
 * 4. 結構技師簽證 (projects.structural_cert_date，備用：BUILD_EXEMPT_APP submitted_at)
 * 5. 免雜項執照同意 (BUILD_EXEMPT_APP issued_at)
 * 6. 台電躉購合約 (TPC_CONTRACT issued_at)
 * 7. 電機技師簽證 (projects.electrical_cert_date，備用：TPC_CONTRACT submitted_at)
 * 8. 材料進場/施工 (projects.construction_start_date，備用：BUILD_EXEMPT_COMP submitted_at)
 * 9. 免雜項執照竣工 (BUILD_EXEMPT_COMP issued_at)
 * 10. 台電掛表(完工) (projects.actual_meter_date)
 * 11. 設備登記核准 (MOEA_REGISTER issued_at)
 * 
 * 注意：第4、7、8項有專屬日期欄位，若無則使用備用邏輯
 */

// Document type mappings for comparison timeline
// Each milestone maps to document type codes/labels and uses issued_at date
export const TIMELINE_DOC_MAPPING = [
  { 
    step: 0, 
    label: '初步現勘', 
    short: '現勘',
    doc_type_codes: ['__USE_INITIAL_SURVEY_DATE__'],
    doc_type_labels: ['初步現勘', '現勘', '場勘'],
    date_field: 'issued_at' as const,
    use_project_field: 'initial_survey_date' as const,
    color: '#78716c',
  },
  { 
    step: 1, 
    label: '與客戶簽訂合約', 
    short: '簽約',
    doc_type_codes: ['__USE_CONTRACT_SIGNED_AT__'],
    doc_type_labels: ['與客戶簽訂合約', '客戶簽約', '簽約'],
    date_field: 'issued_at' as const,
    use_project_field: 'contract_signed_at' as const,
    color: '#6366f1',
  },
  { 
    step: 2, 
    label: '台電審查意見書', 
    short: '審查意見',
    doc_type_codes: ['TPC_REVIEW'],
    doc_type_labels: ['審查意見書', '台電審查意見書'],
    date_field: 'issued_at' as const,
    color: '#3b82f6',
  },
  { 
    step: 3, 
    label: '能源署同意備案', 
    short: '同意備案',
    doc_type_codes: ['MOEA_CONSENT'],
    doc_type_labels: ['同意備案', '能源署同意備案', '能源署同意備案函', '綠能容許'],
    date_field: 'issued_at' as const,
    color: '#10b981',
  },
  { 
    step: 4, 
    label: '結構技師簽證', 
    short: '結構簽證',
    doc_type_codes: ['BUILD_EXEMPT_APP'],
    doc_type_labels: ['免雜項申請', '結構技師簽證', '結構簽證'],
    date_field: 'issued_at' as const,
    // Primary: use project field, Fallback: BUILD_EXEMPT_APP.submitted_at
    use_project_field: 'structural_cert_date' as const,
    fallback_doc_field: 'submitted_at' as const,
    color: '#8b5cf6',
  },
  { 
    step: 5, 
    label: '免雜項執照同意', 
    short: '免雜同意',
    doc_type_codes: ['BUILD_EXEMPT_APP'],
    doc_type_labels: ['免雜項執照同意函', '免雜項同意', '免雜同意', '免雜項執照', '免雜項申請'],
    date_field: 'issued_at' as const,
    color: '#06b6d4',
  },
  { 
    step: 6, 
    label: '台電躉購合約', 
    short: '躉購合約',
    doc_type_codes: ['TPC_CONTRACT'],
    doc_type_labels: ['躉售合約', '躉購合約', '台電躉購合約', '台電躉購合約蓋章完成'],
    date_field: 'issued_at' as const,
    color: '#f59e0b',
  },
  { 
    step: 7, 
    label: '電機技師簽證', 
    short: '電機簽證',
    doc_type_codes: ['TPC_CONTRACT'],
    doc_type_labels: ['躉售合約', '電機技師簽證', '電機簽證'],
    date_field: 'issued_at' as const,
    // Primary: use project field, Fallback: TPC_CONTRACT.submitted_at
    use_project_field: 'electrical_cert_date' as const,
    fallback_doc_field: 'submitted_at' as const,
    color: '#14b8a6',
  },
  { 
    step: 8, 
    label: '材料進場/施工', 
    short: '材料施工',
    doc_type_codes: ['BUILD_EXEMPT_COMP'],
    doc_type_labels: ['材料進場', '施工', '開工'],
    date_field: 'issued_at' as const,
    // Primary: use project field, Fallback: BUILD_EXEMPT_COMP.submitted_at
    use_project_field: 'construction_start_date' as const,
    fallback_doc_field: 'submitted_at' as const,
    color: '#ec4899',
  },
  { 
    step: 9, 
    label: '免雜項執照竣工', 
    short: '免雜竣工',
    doc_type_codes: ['BUILD_EXEMPT_COMP'],
    doc_type_labels: ['免雜項執照竣工函', '免雜項竣工', '免雜竣工', '免雜項執照竣工'],
    date_field: 'issued_at' as const,
    color: '#ef4444',
  },
  { 
    step: 10, 
    label: '台電掛表(完工)', 
    short: '報竣掛表',
    doc_type_codes: ['__USE_ACTUAL_METER_DATE__'],
    doc_type_labels: ['報竣掛表', '台電驗收掛表', '台電驗收掛表作業', '電表掛表', '掛表'],
    date_field: 'issued_at' as const,
    use_project_field: 'actual_meter_date' as const,
    color: '#f97316',
  },
  { 
    step: 11, 
    label: '設備登記核准', 
    short: '設備登記',
    doc_type_codes: ['MOEA_REGISTER'],
    doc_type_labels: ['設備登記', '能源署設備登記', '設備登記函', '設備登記核准'],
    date_field: 'issued_at' as const,
    color: '#a855f7',
  },
] as const;

// Comparison pairs based on new 12-milestone timeline (step 0-11)
export const COMPARISON_PAIRS = [
  // 連續節點區間（11個）
  {
    id: 'interval_00_01',
    label: '現勘→簽約',
    description: '初步現勘 → 與客戶簽訂合約',
    fromStep: 0,
    toStep: 1,
    fitOnly: false,
  },
  {
    id: 'interval_01_02',
    label: '簽約→審查意見',
    description: '與客戶簽訂合約 → 台電審查意見書',
    fromStep: 1,
    toStep: 2,
    fitOnly: false,
  },
  {
    id: 'interval_02_03',
    label: '審查意見→同意備案',
    description: '台電審查意見書 → 能源署同意備案',
    fromStep: 2,
    toStep: 3,
    fitOnly: false,
  },
  {
    id: 'interval_03_04',
    label: '同意備案→結構簽證',
    description: '能源署同意備案 → 結構技師簽證',
    fromStep: 3,
    toStep: 4,
    fitOnly: false,
  },
  {
    id: 'interval_04_05',
    label: '結構簽證→免雜同意',
    description: '結構技師簽證 → 免雜項執照同意',
    fromStep: 4,
    toStep: 5,
    fitOnly: false,
  },
  {
    id: 'interval_05_06',
    label: '免雜同意→躉購合約',
    description: '免雜項執照同意 → 台電躉購合約',
    fromStep: 5,
    toStep: 6,
    fitOnly: false,
  },
  {
    id: 'interval_06_07',
    label: '躉購合約→電機簽證',
    description: '台電躉購合約 → 電機技師簽證',
    fromStep: 6,
    toStep: 7,
    fitOnly: false,
  },
  {
    id: 'interval_07_08',
    label: '電機簽證→材料施工',
    description: '電機技師簽證 → 材料進場/施工',
    fromStep: 7,
    toStep: 8,
    fitOnly: false,
  },
  {
    id: 'interval_08_09',
    label: '材料施工→免雜竣工',
    description: '材料進場/施工 → 免雜項執照竣工',
    fromStep: 8,
    toStep: 9,
    fitOnly: false,
  },
  {
    id: 'interval_09_10',
    label: '免雜竣工→掛表完工',
    description: '免雜項執照竣工 → 台電掛表(完工)',
    fromStep: 9,
    toStep: 10,
    fitOnly: false,
  },
  {
    id: 'interval_10_11',
    label: '掛表完工→設備登記',
    description: '台電掛表(完工) → 設備登記核准',
    fromStep: 10,
    toStep: 11,
    fitOnly: false,
  },
  // 跨流程區間（重要分析指標）
  {
    id: 'interval_total',
    label: '完整流程',
    description: '與客戶簽訂合約 → 設備登記核准 (全流程)',
    fromStep: 1,
    toStep: 11,
    fitOnly: false,
  },
  {
    id: 'interval_01_03',
    label: '簽約到同備',
    description: '與客戶簽訂合約 → 能源署同意備案 (前期行政)',
    fromStep: 1,
    toStep: 3,
    fitOnly: false,
  },
  {
    id: 'interval_03_06',
    label: '同備到躉購',
    description: '能源署同意備案 → 台電躉購合約 (中期簽約)',
    fromStep: 3,
    toStep: 6,
    fitOnly: false,
  },
  {
    id: 'interval_06_10',
    label: '躉購到掛表',
    description: '台電躉購合約 → 台電掛表(完工) (工程期)',
    fromStep: 6,
    toStep: 10,
    fitOnly: false,
  },
  {
    id: 'interval_04_07',
    label: '結構到電機',
    description: '結構技師簽證 → 電機技師簽證 (技師簽證期)',
    fromStep: 4,
    toStep: 7,
    fitOnly: false,
  },
  {
    id: 'interval_08_10',
    label: '施工到掛表',
    description: '材料進場/施工 → 台電掛表(完工) (純施工期)',
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

      // 1. Get baseline project (include all milestone date fields)
      const projectSelectFields = 'id, project_name, project_code, created_at, revenue_model, installation_type, intake_year, actual_meter_date, contract_signed_at, initial_survey_date, structural_cert_date, electrical_cert_date, construction_start_date';
      
      const { data: baselineProject, error: baselineError } = await supabase
        .from('projects')
        .select(projectSelectFields)
        .eq('id', baselineProjectId)
        .single() as { data: any; error: any };

      if (baselineError) throw baselineError;

      // 2. Get all comparison projects (include all milestone date fields)
      const allProjectIds = [baselineProjectId, ...comparisonProjectIds];
      const { data: allProjectsData, error: projectsError } = await supabase
        .from('projects')
        .select(projectSelectFields)
        .in('id', allProjectIds) as { data: any[]; error: any };

      if (projectsError) throw projectsError;

      const projectsMap = new Map((allProjectsData as any[])?.map(p => [p.id, p]));
      const allProjects = [
        baselineProject,
        ...comparisonProjectIds.map(id => projectsMap.get(id)).filter(Boolean),
      ] as (ProjectForComparison & { 
        actual_meter_date?: string | null; 
        contract_signed_at?: string | null;
        initial_survey_date?: string | null;
        structural_cert_date?: string | null;
        electrical_cert_date?: string | null;
        construction_start_date?: string | null;
      })[];

      const baselineYear = extractProjectYear(baselineProject as any as ProjectForComparison);

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
          let date: string | null = null;
          let docType: string | null = mapping.label;
          
          // Check for use_project_field (primary source)
          if ('use_project_field' in mapping && mapping.use_project_field) {
            const fieldValue = (projectData as any)?.[mapping.use_project_field];
            
            if (fieldValue) {
              // Use project field value directly
              date = fieldValue;
            } else if ('fallback_doc_field' in mapping && mapping.fallback_doc_field) {
              // Fallback to document field if project field is empty
              let matchedDoc = null;
              
              // Search by doc_type_code first
              for (const code of mapping.doc_type_codes) {
                if (code.startsWith('__USE_')) continue;
                const found = projectDocs.find(d => d.doc_type_code === code);
                if (found) {
                  matchedDoc = found;
                  break;
                }
              }
              
              if (matchedDoc) {
                const fallbackField = mapping.fallback_doc_field as 'submitted_at' | 'issued_at';
                date = matchedDoc[fallbackField] || null;
                docType = matchedDoc.doc_type || mapping.label;
              }
            }
            
            docDatesMap[projectId][mapping.step] = {
              step: mapping.step,
              date,
              doc_type: docType,
            };
            continue;
          }
          
          // Standard document lookup
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
          if (matchedDoc) {
            const dateField = mapping.date_field as 'submitted_at' | 'issued_at';
            date = dateField === 'submitted_at' 
              ? (matchedDoc.submitted_at || matchedDoc.issued_at)
              : matchedDoc.issued_at;
            docType = matchedDoc.doc_type || mapping.label;
          }
          
          docDatesMap[projectId][mapping.step] = {
            step: mapping.step,
            date,
            doc_type: docType,
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
export function generateLegalSummary(
  results: ComparisonResult[],
  selectedIntervals?: string[]
): string {
  const baseline = results.find(r => r.isBaseline);
  if (!baseline) return '';
  
  // Use all intervals if none selected
  const intervals = selectedIntervals && selectedIntervals.length > 0 
    ? selectedIntervals 
    : COMPARISON_PAIRS.map(p => p.id);
  
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
  
  // Add stage-by-step analysis table - only include selected intervals
  const stepPairs = COMPARISON_PAIRS.slice(0, 10).filter(p => intervals.includes(p.id));
  
  if (stepPairs.length > 0) {
    summary += `\n### 四、階段耗時差異表\n\n`;
    summary += `此表計算各階段的「耗費天數」，日期來源為文件的發文日或送件日。\n`;
    summary += `(+)代表落後基準案件，(-)代表領先基準案件。\n\n`;
    
    // Table header
    summary += `| 步驟 | 比較階段 | `;
    for (const r of results) {
      const label = r.isBaseline ? `${r.project.project_name} (基準)` : r.project.project_name;
      summary += `${label} | `;
    }
    summary += `同期平均 |\n`;
    
    summary += `| --- | --- | ${results.map(() => '---').join(' | ')} | --- |\n`;
    
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
  }
  
  // Add summary intervals - only include selected
  const summaryPairs = COMPARISON_PAIRS.slice(10).filter(p => intervals.includes(p.id));
  
  if (summaryPairs.length > 0) {
    summary += `\n### 五、總結區間\n\n`;
    
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
