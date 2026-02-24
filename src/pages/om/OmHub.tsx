import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Wrench,
  ClipboardList,
  Users,
  HardHat,
  FileText,
  Zap,
  AlertTriangle,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const AVAILABLE_FORMS = [
  {
    to: '/om/cleaning-report',
    icon: ClipboardList,
    label: '表 3-5：模組清洗報告',
    description: '每月清洗驗收紀錄，含照片區與簽章',
    status: 'ready' as const,
  },
  {
    to: '/om/personnel-roster',
    icon: Users,
    label: '表 3-8：工程進場施作人員名冊',
    description: '進場人員資料（最多 20 人），含職稱與緊急聯絡',
    status: 'ready' as const,
  },
  {
    to: '/om/toolbox-meeting',
    icon: HardHat,
    label: '表 3-9：工具箱會議紀錄表',
    description: '勤前教育、危害告知與安全宣導',
    status: 'ready' as const,
  },
  {
    to: '/om/site-access',
    icon: Shield,
    label: '表 3-7：工程進場施作申請單',
    description: '進場申請與核准紀錄',
    status: 'ready' as const,
  },
  {
    to: '/om/incident-report',
    icon: AlertTriangle,
    label: '表 3-6：電廠異常處理單',
    description: '異常通報、處理追蹤與結案紀錄',
    status: 'ready' as const,
  },
  {
    to: '/om/dc-test',
    icon: Zap,
    label: '表 3-3：DC 開路電壓測試自主檢查表',
    description: 'DC 端串列開路電壓測試數據',
    status: 'ready' as const,
  },
  {
    to: '/om/ac-test',
    icon: Zap,
    label: '表 3-4：AC 測試自主檢查表',
    description: 'AC 端電壓、電流、頻率、接地及絕緣測試',
    status: 'ready' as const,
  },
  {
    to: '/om/inspection',
    icon: FileText,
    label: '表 3-2：維護保養檢查表',
    description: '太陽光電系統 11 大檢查區塊巡檢紀錄',
    status: 'ready' as const,
  },
];

const UPCOMING_FORMS: { icon: typeof FileText; label: string; description: string }[] = [];

export default function OmHub() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <Wrench className="w-7 h-7 text-orange-500" />
          </div>
          維運管理 O&M
        </h1>
        <p className="text-muted-foreground mt-2">
          維護保養合約表格數位化 — 填寫後產生與中租合約格式一致的 PDF
        </p>
      </div>

      {/* Available Forms */}
      <div>
        <h2 className="text-lg font-semibold mb-4">可用表格</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AVAILABLE_FORMS.map((form) => (
            <button
              key={form.to}
              onClick={() => navigate(form.to)}
              className="group text-left p-5 rounded-xl border border-border bg-card hover:border-orange-500/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                  <form.icon className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      {form.label}
                    </h3>
                    <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600 dark:text-green-400">
                      可用
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {form.description}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Upcoming Forms */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-muted-foreground">即將推出</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {UPCOMING_FORMS.map((form) => (
            <div
              key={form.label}
              className="p-5 rounded-xl border border-dashed border-border/60 bg-muted/30 opacity-60"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <form.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{form.label}</h3>
                    <Badge variant="outline" className="text-[10px]">開發中</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{form.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
