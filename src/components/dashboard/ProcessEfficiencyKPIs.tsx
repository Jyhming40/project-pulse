import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, CheckCircle, FileCheck, Zap } from 'lucide-react';

interface ProcessEfficiencyKPIsProps {
  projects: Array<{
    id: string;
    project_code?: string | null;
    actual_meter_date?: string | null;
    target_meter_date?: string | null;
  }>;
  documents: Array<{
    project_id: string;
    doc_type_code?: string | null;
    submitted_at?: string | null;
    issued_at?: string | null;
  }>;
  isLoading?: boolean;
}

interface KPIData {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

export function ProcessEfficiencyKPIs({ 
  projects, 
  documents,
  isLoading = false 
}: ProcessEfficiencyKPIsProps) {
  const kpis = useMemo((): KPIData[] => {
    if (projects.length === 0) {
      return [];
    }

    // 計算各階段平均天數
    const calculateAverageDays = (
      getStartDate: (projectId: string) => Date | null,
      getEndDate: (projectId: string) => Date | null
    ): number | null => {
      const validDurations: number[] = [];

      projects.forEach(p => {
        const start = getStartDate(p.id);
        const end = getEndDate(p.id);
        if (start && end && end > start) {
          const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (days > 0 && days < 365) { // 排除異常值
            validDurations.push(days);
          }
        }
      });

      if (validDurations.length === 0) return null;
      return Math.round(validDurations.reduce((a, b) => a + b, 0) / validDurations.length);
    };

    // 建立文件查詢索引
    const docsByProject: Record<string, typeof documents> = {};
    documents.forEach(doc => {
      if (!docsByProject[doc.project_id]) {
        docsByProject[doc.project_id] = [];
      }
      docsByProject[doc.project_id].push(doc);
    });

    const getDocDate = (projectId: string, docType: string, field: 'submitted_at' | 'issued_at'): Date | null => {
      const projectDocs = docsByProject[projectId] || [];
      const doc = projectDocs.find(d => d.doc_type_code === docType);
      const dateStr = doc?.[field];
      return dateStr ? new Date(dateStr) : null;
    };

    // 審查意見書 → 綠能容許 (TPC_REVIEW → LAND_PERMIT)
    const reviewToPermitDays = calculateAverageDays(
      (pid) => getDocDate(pid, 'TPC_REVIEW', 'issued_at'),
      (pid) => getDocDate(pid, 'LAND_PERMIT', 'issued_at')
    );

    // 審查意見書 → 同意備案 (TPC_REVIEW → MOEA_CONSENT)
    const reviewToConsentDays = calculateAverageDays(
      (pid) => getDocDate(pid, 'TPC_REVIEW', 'issued_at'),
      (pid) => getDocDate(pid, 'MOEA_CONSENT', 'issued_at')
    );

    // 審查意見書 → 掛錶 (TPC_REVIEW → actual_meter_date)
    const reviewToMeterDays = calculateAverageDays(
      (pid) => getDocDate(pid, 'TPC_REVIEW', 'issued_at'),
      (pid) => {
        const p = projects.find(proj => proj.id === pid);
        return p?.actual_meter_date ? new Date(p.actual_meter_date) : null;
      }
    );

    // 掛表日 vs 表定掛表日
    const meterDateDiffs: number[] = [];
    projects.forEach(p => {
      if (p.actual_meter_date && p.target_meter_date) {
        const actual = new Date(p.actual_meter_date);
        const target = new Date(p.target_meter_date);
        const diff = Math.round((target.getTime() - actual.getTime()) / (1000 * 60 * 60 * 24));
        if (Math.abs(diff) < 365) { // 排除異常值
          meterDateDiffs.push(diff);
        }
      }
    });
    const avgMeterDiff = meterDateDiffs.length > 0
      ? Math.round(meterDateDiffs.reduce((a, b) => a + b, 0) / meterDateDiffs.length)
      : null;

    return [
      {
        label: '審查 → 綠能容許',
        value: reviewToPermitDays !== null ? `${reviewToPermitDays} 天` : '-',
        description: '平均取得綠能容許函文時間',
        icon: <FileCheck className="w-4 h-4 text-primary" />,
      },
      {
        label: '審查 → 同意備案',
        value: reviewToConsentDays !== null ? `${reviewToConsentDays} 天` : '-',
        description: '平均取得同意備案時間',
        icon: <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />,
      },
      {
        label: '審查 → 掛錶',
        value: reviewToMeterDays !== null ? `${reviewToMeterDays} 天` : '-',
        description: '平均完成掛錶時間',
        icon: <Zap className="w-4 h-4 text-warning" />,
      },
      {
        label: '掛表提前/延後',
        value: avgMeterDiff !== null 
          ? avgMeterDiff >= 0 
            ? `提早 ${avgMeterDiff} 天` 
            : `延後 ${Math.abs(avgMeterDiff)} 天`
          : '-',
        description: '實際掛表與表定日期差異',
        icon: <Clock className="w-4 h-4 text-primary" />,
        trend: avgMeterDiff !== null ? (avgMeterDiff >= 0 ? 'up' : 'down') : 'neutral',
      },
    ];
  }, [projects, documents]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (kpis.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Clock className="w-4 h-4" />
          行政流程效率指標
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi, index) => (
            <div 
              key={index} 
              className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                {kpi.icon}
                <span className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </span>
              </div>
              <div className={`text-2xl font-bold ${
                kpi.trend === 'up' ? 'text-green-600' : 
                kpi.trend === 'down' ? 'text-red-600' : 
                'text-foreground'
              }`}>
                {kpi.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {kpi.description}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
