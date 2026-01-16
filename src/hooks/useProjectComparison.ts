import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Milestone comparison pairs - hardcoded for MVP
// Uses actual milestone_code from progress_milestones table
export const COMPARISON_PAIRS = [
  {
    id: 'construction',
    label: '施工期',
    description: '能源署同意備案 → 報竣掛表',
    from: 'ADMIN_04_ENERGY_APPROVAL',
    to: 'ADMIN_08_METER_INSTALLED',
    fitOnly: false,
  },
  {
    id: 'closing',
    label: '收尾期',
    description: '報竣掛表 → 設備登記完成',
    from: 'ADMIN_08_METER_INSTALLED',
    to: 'ADMIN_09_EQUIPMENT_REG',
    fitOnly: false,
  },
  {
    id: 'fit_final',
    label: 'FIT 後段',
    description: '設備登記完成 → 正式躉售函',
    from: 'ADMIN_09_EQUIPMENT_REG',
    to: 'ADMIN_09B_FIT_OFFICIAL',
    fitOnly: true,
  },
  {
    id: 'full_process',
    label: '完整流程',
    description: '台電審查意見書 → 正式躉售函',
    from: 'ADMIN_03_TAIPOWER_OPINION',
    to: 'ADMIN_09B_FIT_OFFICIAL',
    fitOnly: true,
  },
] as const;

export type ComparisonPair = typeof COMPARISON_PAIRS[number];

export interface ProjectForComparison {
  id: string;
  project_name: string;
  project_code: string;
  created_at: string;
  revenue_model: string | null;
  installation_type: string | null;
}

export interface ProjectMilestoneData {
  project_id: string;
  milestone_code: string;
  completed_at: string | null;
  is_completed: boolean;
}

export interface ComparisonResult {
  project: ProjectForComparison;
  milestones: Record<string, string | null>; // milestone_code -> completed_at
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

// Fetch all projects for selector
export function useProjectsForComparison() {
  return useQuery({
    queryKey: ['projects-for-comparison'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, project_code, created_at, revenue_model, installation_type')
        .eq('is_deleted', false)
        .order('project_name', { ascending: true });

      if (error) throw error;
      return data as ProjectForComparison[];
    },
  });
}

// Fetch comparison data
export function useComparisonData(
  baselineProjectId: string | null,
  sameYearRange: number, // ± days
  limit: number
) {
  return useQuery({
    queryKey: ['comparison-data', baselineProjectId, sameYearRange, limit],
    queryFn: async () => {
      if (!baselineProjectId) return null;

      // 1. Get baseline project
      const { data: baselineProject, error: baselineError } = await supabase
        .from('projects')
        .select('id, project_name, project_code, created_at, revenue_model, installation_type')
        .eq('id', baselineProjectId)
        .single();

      if (baselineError) throw baselineError;

      const baselineDate = new Date(baselineProject.created_at);
      const baselineYear = baselineDate.getFullYear();
      const minDate = new Date(baselineDate);
      minDate.setDate(minDate.getDate() - sameYearRange);
      const maxDate = new Date(baselineDate);
      maxDate.setDate(maxDate.getDate() + sameYearRange);

      // 2. Get comparison projects (same year + within range)
      const { data: comparisonProjects, error: compError } = await supabase
        .from('projects')
        .select('id, project_name, project_code, created_at, revenue_model, installation_type')
        .eq('is_deleted', false)
        .gte('created_at', minDate.toISOString())
        .lte('created_at', maxDate.toISOString())
        .neq('id', baselineProjectId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (compError) throw compError;

      // Filter by same year
      const sameYearProjects = comparisonProjects.filter(p => {
        const year = new Date(p.created_at).getFullYear();
        return year === baselineYear;
      });

      const allProjects = [baselineProject, ...sameYearProjects] as ProjectForComparison[];
      const projectIds = allProjects.map(p => p.id);

      // 3. Get all milestones for these projects
      const { data: milestones, error: milestoneError } = await supabase
        .from('project_milestones')
        .select('project_id, milestone_code, completed_at, is_completed')
        .in('project_id', projectIds);

      if (milestoneError) throw milestoneError;

      // 4. Build milestone map per project
      const milestonesMap: Record<string, Record<string, string | null>> = {};
      for (const m of milestones || []) {
        if (!milestonesMap[m.project_id]) {
          milestonesMap[m.project_id] = {};
        }
        milestonesMap[m.project_id][m.milestone_code] = m.is_completed ? m.completed_at : null;
      }

      // 5. Calculate intervals for each project
      const calculateIntervals = (
        project: ProjectForComparison,
        baselineMilestones: Record<string, string | null> | undefined
      ): Record<string, IntervalResult> => {
        const projectMilestones = milestonesMap[project.id] || {};
        const intervals: Record<string, IntervalResult> = {};

        for (const pair of COMPARISON_PAIRS) {
          // Skip FIT-only pairs for non-FIT projects
          if (pair.fitOnly && project.revenue_model !== 'FIT') {
            intervals[pair.id] = {
              fromDate: null,
              toDate: null,
              days: null,
              delta: null,
              status: 'na',
            };
            continue;
          }

          const fromDate = projectMilestones[pair.from] || null;
          const toDate = projectMilestones[pair.to] || null;

          if (fromDate && toDate) {
            const from = new Date(fromDate);
            const to = new Date(toDate);
            const days = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

            // Calculate delta from baseline
            let delta: number | null = null;
            if (baselineMilestones) {
              const baselineFrom = baselineMilestones[pair.from];
              const baselineTo = baselineMilestones[pair.to];
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
      const baselineMilestones = milestonesMap[baselineProject.id];
      const results: ComparisonResult[] = allProjects.map((project, index) => ({
        project,
        milestones: milestonesMap[project.id] || {},
        intervals: calculateIntervals(
          project,
          index === 0 ? undefined : baselineMilestones
        ),
        isBaseline: index === 0,
      }));

      // Calculate statistics
      const stats: ComparisonStats[] = COMPARISON_PAIRS.map(pair => {
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
        totalCompared: sameYearProjects.length,
      };
    },
    enabled: !!baselineProjectId,
  });
}

// Generate CSV export
export function generateComparisonCSV(
  results: ComparisonResult[],
  baseline: ProjectForComparison
): string {
  const headers = [
    '案場代碼',
    '案場名稱',
    '建立日期',
    '收益模式',
    ...COMPARISON_PAIRS.flatMap(pair => [
      `${pair.label}_起始日`,
      `${pair.label}_結束日`,
      `${pair.label}_天數`,
      `${pair.label}_差異`,
    ]),
  ];

  const rows = results.map(r => {
    const row = [
      r.project.project_code,
      r.project.project_name,
      r.project.created_at.split('T')[0],
      r.project.revenue_model || '',
    ];

    for (const pair of COMPARISON_PAIRS) {
      const interval = r.intervals[pair.id];
      row.push(interval.fromDate?.split('T')[0] || '');
      row.push(interval.toDate?.split('T')[0] || '');
      row.push(interval.days !== null ? String(interval.days) : 'N/A');
      row.push(
        r.isBaseline
          ? '基準'
          : interval.delta !== null
          ? (interval.delta >= 0 ? '+' : '') + interval.delta
          : 'N/A'
      );
    }

    return row;
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

// Generate legal summary
export function generateLegalSummary(
  baseline: ProjectForComparison,
  results: ComparisonResult[],
  stats: ComparisonStats[],
  sameYearRange: number
): string {
  const baselineYear = new Date(baseline.created_at).getFullYear();
  const totalCompared = results.length - 1; // exclude baseline

  const baselineResult = results.find(r => r.isBaseline);
  if (!baselineResult) return '';

  let summary = `## 案件進度比較分析報告

### 一、比較目的
本分析使用系統里程碑紀錄，比較基準案件與同期案件在各重要階段的時程差異，作為法務說明參考。

### 二、比較母體定義
- **基準案件**：${baseline.project_name}（${baseline.project_code}）
- **同年度**：${baselineYear} 年
- **同期範圍**：±${sameYearRange} 天
- **納入案件數**：${totalCompared} 件

### 三、比較方法
- 使用系統里程碑紀錄（project_milestones.completed_at）
- 以指定里程碑區間計算天數差（to - from）
- 里程碑代碼依據 progress_milestones 定義

### 四、里程碑區間定義
`;

  for (const pair of COMPARISON_PAIRS) {
    summary += `- **${pair.label}**：\`${pair.from}\` → \`${pair.to}\`\n`;
  }

  summary += `
### 五、主要結果摘要
`;

  for (const pair of COMPARISON_PAIRS) {
    const stat = stats.find(s => s.pairId === pair.id);
    const baselineInterval = baselineResult.intervals[pair.id];

    if (baselineInterval.status === 'na') {
      summary += `\n#### ${pair.label}（${pair.description}）\n`;
      summary += `- 不適用（非 FIT 案件）\n`;
      continue;
    }

    summary += `\n#### ${pair.label}（${pair.description}）\n`;
    
    if (baselineInterval.status === 'complete') {
      summary += `- 基準案天數：**${baselineInterval.days}** 天\n`;
      summary += `- 起始：${baselineInterval.fromDate?.split('T')[0]} → 結束：${baselineInterval.toDate?.split('T')[0]}\n`;
    } else {
      summary += `- 基準案狀態：**未完成**\n`;
    }

    if (stat && stat.count > 0) {
      summary += `- 同期案件統計（n=${stat.count}）：\n`;
      summary += `  - 平均：${stat.average} 天\n`;
      summary += `  - 中位數：${stat.median} 天\n`;
      summary += `  - 範圍：${stat.min} ~ ${stat.max} 天\n`;

      if (baselineInterval.status === 'complete' && stat.median !== null) {
        const diff = baselineInterval.days! - stat.median;
        const diffText = diff > 0 ? `較中位數多 ${diff} 天` : diff < 0 ? `較中位數少 ${Math.abs(diff)} 天` : '與中位數相同';
        summary += `- 基準案相對差異：**${diffText}**\n`;
      }
    } else {
      summary += `- 同期案件：無可比較資料\n`;
    }
  }

  summary += `
### 六、注意事項
- 若部分案件缺少里程碑日期，於表格中標示「未完成」，不納入統計
- 天數計算採整天計算（to - from）
- FIT 後段區間僅適用於 FIT 案件
`;

  return summary;
}

// Generate markdown table
export function generateLegalTable(
  results: ComparisonResult[],
  pairId: string
): string {
  const pair = COMPARISON_PAIRS.find(p => p.id === pairId);
  if (!pair) return '';

  const headers = ['案場名稱', '起始日期', '結束日期', '天數', '差異 Δ', '備註'];
  const separator = headers.map(() => '---');

  const rows = results
    .filter(r => r.intervals[pairId].status !== 'na')
    .map(r => {
      const interval = r.intervals[pairId];
      return [
        r.project.project_name,
        interval.fromDate?.split('T')[0] || '-',
        interval.toDate?.split('T')[0] || '-',
        interval.days !== null ? String(interval.days) : '-',
        r.isBaseline
          ? '基準'
          : interval.delta !== null
          ? (interval.delta >= 0 ? '+' : '') + interval.delta
          : 'N/A',
        r.isBaseline
          ? '🔶 基準案件'
          : interval.status === 'incomplete'
          ? '未完成'
          : '',
      ];
    });

  const table = [
    `### ${pair.label}（${pair.description}）`,
    '',
    `| ${headers.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n');

  return table;
}
