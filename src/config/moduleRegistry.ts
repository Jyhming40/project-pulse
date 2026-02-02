import {
  Briefcase,
  HardHat,
  FileText,
  TrendingUp,
  AlertTriangle,
  Building2,
  FileCheck,
  Users,
  Calculator,
  Scale,
  ClipboardList,
  Truck,
  FolderOpen,
  Search,
  DollarSign,
  PiggyBank,
  ShieldAlert,
  Gavel,
  LucideIcon,
} from 'lucide-react';
import { MODULES, ModuleName } from '@/hooks/usePermissions';

// ==========================================
// Workspace 定義
// ==========================================
export type WorkspaceId = 'sales' | 'execution' | 'governance' | 'finance' | 'risk';

export interface WorkspaceNavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  description?: string;
}

export interface WorkspaceDefinition {
  id: WorkspaceId;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string; // Tailwind color class
  requiredPermission: ModuleName;
  hubRoute: string;
  navItems: WorkspaceNavItem[];
}

// ==========================================
// 模組註冊表 - 單一來源
// ==========================================
export const WORKSPACE_REGISTRY: Record<WorkspaceId, WorkspaceDefinition> = {
  sales: {
    id: 'sales',
    label: '接案與報價',
    description: '客戶開發、案場評估、報價管理',
    icon: Briefcase,
    color: 'text-blue-600 dark:text-blue-400',
    requiredPermission: MODULES.PROJECTS,
    hubRoute: '/w/sales',
    navItems: [
      { to: '/w/sales', icon: Briefcase, label: '接案儀表板', description: '待辦與 KPI' },
      { to: '/projects', icon: Building2, label: '案場列表', description: '所有案場總覽' },
      { to: '/quotes', icon: Calculator, label: '報價管理', description: '報價單列表' },
      { to: '/investors', icon: Users, label: '投資人', description: '投資人管理' },
      { to: '/partners', icon: Truck, label: '協力商', description: '協力商管理' },
    ],
  },
  execution: {
    id: 'execution',
    label: '工程與行政',
    description: '施工進度、行政流程、里程碑追蹤',
    icon: HardHat,
    color: 'text-amber-600 dark:text-amber-400',
    requiredPermission: MODULES.PROJECTS,
    hubRoute: '/w/execution',
    navItems: [
      { to: '/w/execution', icon: HardHat, label: '執行儀表板', description: '待辦與 KPI' },
      { to: '/projects', icon: Building2, label: '案場列表', description: '所有案場總覽' },
      { to: '/projects/compare', icon: ClipboardList, label: '案場比較', description: '多案場對比分析' },
    ],
  },
  governance: {
    id: 'governance',
    label: '文件治理',
    description: '文件管理、版本控制、合規審查',
    icon: FileText,
    color: 'text-emerald-600 dark:text-emerald-400',
    requiredPermission: MODULES.DOCUMENTS,
    hubRoute: '/w/governance',
    navItems: [
      { to: '/w/governance', icon: FileText, label: '治理儀表板', description: '待辦與 KPI' },
      { to: '/documents', icon: FolderOpen, label: '文件總覽', description: '所有文件' },
      { to: '/import-batch', icon: FileCheck, label: '批次匯入', description: '批次上傳文件' },
      { to: '/duplicate-scanner', icon: Search, label: '重複掃描', description: '偵測重複案件' },
    ],
  },
  finance: {
    id: 'finance',
    label: '財務與投資',
    description: '收支追蹤、投資報酬、財務分析',
    icon: TrendingUp,
    color: 'text-violet-600 dark:text-violet-400',
    requiredPermission: MODULES.INVESTORS,
    hubRoute: '/w/finance',
    navItems: [
      { to: '/w/finance', icon: TrendingUp, label: '財務儀表板', description: '待辦與 KPI' },
      { to: '/investors', icon: PiggyBank, label: '投資人', description: '投資人管理' },
      { to: '/quotes', icon: DollarSign, label: '報價單', description: '財務試算' },
    ],
  },
  risk: {
    id: 'risk',
    label: '風險與爭議',
    description: '風險評估、爭議處理、法務追蹤',
    icon: AlertTriangle,
    color: 'text-rose-600 dark:text-rose-400',
    requiredPermission: MODULES.PROJECTS,
    hubRoute: '/w/risk',
    navItems: [
      { to: '/w/risk', icon: AlertTriangle, label: '風險儀表板', description: '待辦與 KPI' },
      { to: '/projects', icon: ShieldAlert, label: '風險案場', description: '高風險案場' },
      { to: '/projects', icon: Gavel, label: '爭議追蹤', description: '爭議案件' },
    ],
  },
};

// ==========================================
// 共用導覽項目（不受 Workspace 影響）
// ==========================================
export const COMMON_NAV_ITEMS: WorkspaceNavItem[] = [
  { to: '/hub', icon: Briefcase, label: '營運中心', description: '系統主入口' },
  { to: '/', icon: TrendingUp, label: 'KPI 儀表板', description: '總覽數據' },
];

// ==========================================
// 輔助函數
// ==========================================
export const getWorkspaceById = (id: WorkspaceId): WorkspaceDefinition => {
  return WORKSPACE_REGISTRY[id];
};

export const getAllWorkspaces = (): WorkspaceDefinition[] => {
  return Object.values(WORKSPACE_REGISTRY);
};

export const getWorkspaceIds = (): WorkspaceId[] => {
  return Object.keys(WORKSPACE_REGISTRY) as WorkspaceId[];
};
