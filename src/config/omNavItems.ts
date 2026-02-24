import {
  Wrench,
  FileText,
  ClipboardList,
  Users,
  HardHat,
  Zap,
  AlertTriangle,
  Shield,
  Calendar,
  TrendingUp,
  DollarSign,
  type LucideIcon,
} from 'lucide-react';

export interface OmNavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  description?: string;
}

// O&M 模組導覽項目
export const OM_NAV_ITEMS: OmNavItem[] = [
  { to: '/om', icon: Wrench, label: '維運總覽', description: '維運模組首頁' },
  { to: '/om/cleaning-report', icon: ClipboardList, label: '表 3-5 清洗報告' },
  { to: '/om/personnel-roster', icon: Users, label: '表 3-8 人員名冊' },
  { to: '/om/toolbox-meeting', icon: HardHat, label: '表 3-9 工具箱會議' },
  { to: '/om/site-access', icon: Shield, label: '表 3-7 進場申請' },
  { to: '/om/incident-report', icon: AlertTriangle, label: '表 3-6 異常處理' },
  { to: '/om/dc-test', icon: Zap, label: '表 3-3 DC 測試' },
  { to: '/om/ac-test', icon: Zap, label: '表 3-4 AC 測試' },
  { to: '/om/inspection', icon: FileText, label: '表 3-2 巡檢紀錄' },
];

// 未來擴充（Phase 2+）
export const OM_NAV_ITEMS_FUTURE: OmNavItem[] = [];
