import { 
  Activity, 
  FileText, 
  CheckCircle2,
  Building2,
  Zap,
  CircuitBoard,
  Gauge,
  Construction,
  Wrench,
  Users,
  CreditCard,
  Hammer,
  ClipboardList,
  HardHat,
  MapPin,
  FolderOpen,
  UserCheck,
  LucideIcon
} from 'lucide-react';

// All categories that can be managed in the Codebook
// doc_type_code removed - managed in dedicated DocumentTypeConfig page (/document-type-config)
export type CodebookCategory = 
  | 'project_status'
  | 'doc_status'
  | 'agency'
  | 'subfolder_code'
  | 'installation_type'
  | 'grid_connection_type'
  | 'power_phase_type'
  | 'power_voltage'
  | 'pole_status'
  | 'construction_status'
  | 'investor_type'
  | 'payment_method_type'
  | 'construction_work_type'
  | 'construction_assignment_status'
  | 'partner_type'
  | 'city'
  | 'contact_role_tag';

export interface CategoryConfig {
  label: string;
  icon: LucideIcon;
  description: string;
  // Which table and column references this category
  usageMapping: {
    table: string;
    column: string;
  }[];
  // If true, cannot add or delete options, only edit labels and toggle active
  isSystemControlled?: boolean;
}

// Complete category configuration with usage mappings
export const codebookCategoryConfig: Record<CodebookCategory, CategoryConfig> = {
  project_status: {
    label: '專案狀態',
    icon: Activity,
    description: '專案進度的狀態選項',
    usageMapping: [
      { table: 'projects', column: 'status' },
    ],
  },
  doc_status: {
    label: '文件狀態',
    icon: CheckCircle2,
    description: '文件處理的狀態選項',
    usageMapping: [
      { table: 'documents', column: 'doc_status' },
    ],
  },
  agency: {
    label: '發證機關',
    icon: Building2,
    description: '文件發證機關選項',
    usageMapping: [
      { table: 'documents', column: 'agency' },
    ],
  },
  subfolder_code: {
    label: '資料夾代碼',
    icon: FolderOpen,
    description: 'Google Drive 文件分類資料夾代碼',
    usageMapping: [],
    // Mark as system-controlled: cannot add or delete, only edit labels
    isSystemControlled: true,
  },
  installation_type: {
    label: '裝置類型',
    icon: Building2,
    description: '案場安裝類型（畜牧舍、農業設施等）',
    usageMapping: [
      { table: 'projects', column: 'installation_type' },
    ],
  },
  grid_connection_type: {
    label: '併聯方式',
    icon: Zap,
    description: '電網併聯類型（高壓、低壓等）',
    usageMapping: [
      { table: 'projects', column: 'grid_connection_type' },
    ],
  },
  power_phase_type: {
    label: '供電模式',
    icon: CircuitBoard,
    description: '供電相位類型（單相/三相）',
    usageMapping: [
      { table: 'projects', column: 'power_phase_type' },
    ],
  },
  power_voltage: {
    label: '供電電壓',
    icon: Gauge,
    description: '電壓規格選項',
    usageMapping: [
      { table: 'projects', column: 'power_voltage' },
    ],
  },
  pole_status: {
    label: '立桿狀態',
    icon: Construction,
    description: '電線桿施工狀態',
    usageMapping: [
      { table: 'projects', column: 'pole_status' },
    ],
  },
  construction_status: {
    label: '施工進度',
    icon: Wrench,
    description: '案場施工進度狀態',
    usageMapping: [
      { table: 'projects', column: 'construction_status' },
    ],
  },
  investor_type: {
    label: '投資方類型',
    icon: Users,
    description: '投資方分類（自有投資、租賃等）',
    usageMapping: [
      { table: 'investors', column: 'investor_type' },
    ],
  },
  payment_method_type: {
    label: '付款方式',
    icon: CreditCard,
    description: '付款方式類型',
    usageMapping: [
      { table: 'investor_payment_methods', column: 'method_type' },
    ],
  },
  construction_work_type: {
    label: '工程項目',
    icon: Hammer,
    description: '案場工程項目分類（模組支架、機電、土建等）',
    usageMapping: [
      { table: 'project_construction_assignments', column: 'construction_work_type' },
      { table: 'partners', column: 'work_capabilities' },
    ],
  },
  construction_assignment_status: {
    label: '工班指派狀態',
    icon: ClipboardList,
    description: '工班指派進度狀態',
    usageMapping: [
      { table: 'project_construction_assignments', column: 'assignment_status' },
    ],
  },
  partner_type: {
    label: '外包夥伴類型',
    icon: HardHat,
    description: '外包夥伴分類（工班、廠商、個人）',
    usageMapping: [
      { table: 'partners', column: 'partner_type' },
    ],
  },
  city: {
    label: '縣市',
    icon: MapPin,
    description: '台灣縣市選項',
    usageMapping: [
      { table: 'projects', column: 'city' },
    ],
  },
  contact_role_tag: {
    label: '聯絡人角色',
    icon: UserCheck,
    description: '投資方聯絡人角色標籤',
    usageMapping: [
      { table: 'investor_contacts', column: 'role_tags' },
    ],
  },
};

// Get all category keys
export const allCategories = Object.keys(codebookCategoryConfig) as CodebookCategory[];

// Default enum values from database (for initial population)
export const defaultEnumValues: Record<CodebookCategory, { value: string; label: string }[]> = {
  project_status: [
    { value: '開發中', label: '開發中' },
    { value: '土地確認', label: '土地確認' },
    { value: '結構簽證', label: '結構簽證' },
    { value: '台電送件', label: '台電送件' },
    { value: '台電審查', label: '台電審查' },
    { value: '能源署送件', label: '能源署送件' },
    { value: '同意備案', label: '同意備案' },
    { value: '工程施工', label: '工程施工' },
    { value: '報竣掛表', label: '報竣掛表' },
    { value: '設備登記', label: '設備登記' },
    { value: '運維中', label: '運維中' },
    { value: '暫停', label: '暫停' },
    { value: '取消', label: '取消' },
  ],
  // doc_type_code removed - managed in dedicated DocumentTypeConfig page
  doc_status: [
    { value: '未開始', label: '未開始' },
    { value: '進行中', label: '進行中' },
    { value: '已完成', label: '已完成' },
    { value: '退件補正', label: '退件補正' },
  ],
  agency: [
    { value: 'TPC', label: '台灣電力公司' },
    { value: 'MOEA', label: '經濟部能源署' },
    { value: 'GOV', label: '地方政府' },
    { value: 'CONST', label: '建管單位' },
    { value: 'FIRE', label: '消防單位' },
    { value: 'STR', label: '結構技師' },
    { value: 'ELEC', label: '電機技師' },
    { value: 'ENV', label: '環保單位' },
    { value: 'OTHER', label: '其他' },
  ],
  subfolder_code: [
    { value: 'TPC', label: '台電相關' },
    { value: 'ENERGY_BUREAU', label: '能源署相關' },
    { value: 'RELATED', label: '其他相關文件' },
    { value: 'BUILDING_AUTH', label: '建管處相關' },
    { value: 'GREEN_PERMISSION', label: '綠能設施' },
  ],
  installation_type: [
    { value: '畜牧舍', label: '畜牧舍' },
    { value: '農業設施', label: '農業設施' },
    { value: '農棚', label: '農棚' },
    { value: '地面型', label: '地面型' },
    { value: '農舍', label: '農舍' },
    { value: '住宅', label: '住宅' },
    { value: '廠辦', label: '廠辦' },
    { value: '特目用建物', label: '特目用建物' },
    { value: '特登工廠', label: '特登工廠' },
    { value: '集合住宅', label: '集合住宅' },
    { value: '其他設施', label: '其他設施' },
    { value: '新建物（農業）', label: '新建物（農業）' },
    { value: '新建物（其他）', label: '新建物（其他）' },
  ],
  grid_connection_type: [
    { value: '高壓併低壓側', label: '高壓併低壓側' },
    { value: '低壓', label: '低壓' },
    { value: '併內線－躉售', label: '併內線－躉售' },
    { value: '併內線－自發自用', label: '併內線－自發自用' },
  ],
  power_phase_type: [
    { value: '單相三線式', label: '單相三線式' },
    { value: '三相三線式', label: '三相三線式' },
    { value: '三相四線式', label: '三相四線式' },
  ],
  power_voltage: [
    { value: '220V', label: '220V' },
    { value: '220V / 380V', label: '220V / 380V' },
    { value: '380V', label: '380V' },
    { value: '440V', label: '440V' },
    { value: '480V', label: '480V' },
  ],
  pole_status: [
    { value: '已立桿', label: '已立桿' },
    { value: '未立桿', label: '未立桿' },
    { value: '基礎完成', label: '基礎完成' },
    { value: '無須', label: '無須' },
    { value: '需移桿', label: '需移桿' },
    { value: '亭置式', label: '亭置式' },
  ],
  construction_status: [
    { value: '已開工', label: '已開工' },
    { value: '尚未開工', label: '尚未開工' },
    { value: '已掛錶', label: '已掛錶' },
    { value: '待掛錶', label: '待掛錶' },
    { value: '暫緩', label: '暫緩' },
    { value: '取消', label: '取消' },
  ],
  investor_type: [
    { value: '自有投資', label: '自有投資' },
    { value: '租賃投資', label: '租賃投資' },
    { value: 'SPC', label: 'SPC' },
    { value: '個人', label: '個人' },
    { value: '其他', label: '其他' },
  ],
  payment_method_type: [
    { value: '銀行轉帳', label: '銀行轉帳' },
    { value: '支票', label: '支票' },
    { value: '現金', label: '現金' },
    { value: '信用卡', label: '信用卡' },
    { value: '其他', label: '其他' },
  ],
  construction_work_type: [
    { value: '模組支架組裝工程－鋼構工班', label: '模組支架組裝工程－鋼構工班' },
    { value: '模組支架組裝工程－鋁擠型支架', label: '模組支架組裝工程－鋁擠型支架' },
    { value: '模組支架組裝工程－鍍鎂鋁鋅支架', label: '模組支架組裝工程－鍍鎂鋁鋅支架' },
    { value: '模組支架組裝工程－其他支架', label: '模組支架組裝工程－其他支架' },
    { value: '機電工程', label: '機電工程' },
    { value: '箱體工程', label: '箱體工程' },
    { value: '土建工程', label: '土建工程' },
    { value: '其他工程', label: '其他工程' },
  ],
  construction_assignment_status: [
    { value: '預計', label: '預計' },
    { value: '已確認', label: '已確認' },
    { value: '已進場', label: '已進場' },
    { value: '已完成', label: '已完成' },
    { value: '暫緩', label: '暫緩' },
    { value: '取消', label: '取消' },
  ],
  partner_type: [
    { value: '工班', label: '工班' },
    { value: '廠商', label: '廠商' },
    { value: '個人', label: '個人' },
  ],
  city: [
    { value: '台北市', label: '台北市' },
    { value: '新北市', label: '新北市' },
    { value: '桃園市', label: '桃園市' },
    { value: '台中市', label: '台中市' },
    { value: '台南市', label: '台南市' },
    { value: '高雄市', label: '高雄市' },
    { value: '基隆市', label: '基隆市' },
    { value: '新竹市', label: '新竹市' },
    { value: '嘉義市', label: '嘉義市' },
    { value: '新竹縣', label: '新竹縣' },
    { value: '苗栗縣', label: '苗栗縣' },
    { value: '彰化縣', label: '彰化縣' },
    { value: '南投縣', label: '南投縣' },
    { value: '雲林縣', label: '雲林縣' },
    { value: '嘉義縣', label: '嘉義縣' },
    { value: '屏東縣', label: '屏東縣' },
    { value: '宜蘭縣', label: '宜蘭縣' },
    { value: '花蓮縣', label: '花蓮縣' },
    { value: '台東縣', label: '台東縣' },
    { value: '澎湖縣', label: '澎湖縣' },
    { value: '金門縣', label: '金門縣' },
    { value: '連江縣', label: '連江縣' },
  ],
  contact_role_tag: [
    { value: '主要聯絡人', label: '主要聯絡人' },
    { value: '財務', label: '財務' },
    { value: '工程', label: '工程' },
    { value: '法務', label: '法務' },
    { value: '行政', label: '行政' },
    { value: '業務', label: '業務' },
    { value: '其他', label: '其他' },
  ],
};
