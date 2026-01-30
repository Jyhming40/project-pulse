// 支架與工程規格描述預設值
// Based on user-provided specifications from industry standards

import { PresetCategory } from '@/hooks/useQuoteEngineeringPresets';

export interface BracketPreset {
  key: string;
  label: string;
  parentLabel?: string;
  specDescription: string;
  category: PresetCategory;
  isSubOption?: boolean;
}

// 模組支架預設規格 (RACK)
export const MODULE_BRACKET_PRESETS: BracketPreset[] = [
  {
    key: 'galvanized_steel_with_wave',
    label: '(1) 有浪板',
    parentLabel: '熱浸鍍鋅鋼構',
    category: 'RACK',
    isSubOption: true,
    specDescription: `●熱浸鍍鋅鋼構
　a、樑柱：200mmx100mm H型鋼；衍架：125mmx 50mm C型鋼
　b、基礎位置放樣、植筋，並於柱子固定後覆以無收縮水泥
　　(300mm(長) x300mm(寬) x150mm(高)之混凝土墩)
　c、屋頂覆蓋三合一烤漆浪板
　d、低點處設置雨水槽並配管引流
●鋁擠成型6061T5支架(浪板溝峰距模組完成面架高約25cm)
　a、陽極處理鍍膜
　b、壓克力透明漆`,
  },
  {
    key: 'galvanized_steel_no_wave',
    label: '(2) 無浪板',
    parentLabel: '熱浸鍍鋅鋼構',
    category: 'RACK',
    isSubOption: true,
    specDescription: `●熱浸鍍鋅鋼構
　樑柱：200mmx100mm H型鋼；
　衍架：125mmx 50mm C型鋼
　基礎位置放樣、植筋，並於柱子固定後覆以無收縮水泥
　(300mm(長) x300mm(寬) x150mm(高)之混凝土墩)
　低點處設置雨水槽並配管引流`,
  },
  {
    key: 'aluminum_extrusion',
    label: '鋁擠型支架',
    category: 'RACK',
    specDescription: `●鋁擠成型6061T5支架
　(浪板溝峰距模組完成面架高約20cm)
　陽極處理鍍膜
　壓克力透明漆`,
  },
  {
    key: 'mg_al_zn_bracket',
    label: '鍍鎂鋁鋅支架',
    category: 'RACK',
    specDescription: `1、C型鋼及扣件採用日本新日鐵住金鍍鎂鋁鋅鋼材Super Dyma K27之材質
2、使用8.8級熱浸鍍鋅馬車螺絲組
3、上壓塊防鬆帽使用德國鋅錫防鬆脫帽
4、上壓塊黑色粉體烤漆
5、C鋼斷面上鋅漆
6、至模組下緣高度依據圖說設計高度
7、模組舖設及固定工程
8、熱浸鍍鋅菱形網維修步道及防墜鋼索
9、不鏽鋼爬梯`,
  },
  {
    key: 'other_bracket',
    label: '其他',
    category: 'RACK',
    specDescription: '',
  },
];

// 防護工程預設規格 (SAFETY)
export const PROTECTION_ENGINEERING_PRESETS: BracketPreset[] = [
  {
    key: 'maintenance_walkway',
    label: '維修步道',
    category: 'SAFETY',
    specDescription: '熱浸鍍鋅菱形網維修步道',
  },
  {
    key: 'fall_protection_cable',
    label: '防墜鋼索',
    category: 'SAFETY',
    specDescription: '防墜鋼索',
  },
  {
    key: 'protection_fence',
    label: '防護圍籬',
    category: 'SAFETY',
    specDescription: '防護圍籬',
  },
  {
    key: 'maintenance_ladder',
    label: '維修爬梯',
    category: 'SAFETY',
    specDescription: '不鏽鋼爬梯',
  },
  {
    key: 'screw_set',
    label: '螺絲組',
    category: 'SAFETY',
    specDescription: `●五金另料、
　a、自攻螺絲SUS410材質
　b、鋼構吊掛、組立安裝
　c、固定螺絲/華司及彈簧華司均為SUS304等級`,
  },
];

// 鋼構工程預設規格 (STEEL)
export const STEEL_ENGINEERING_PRESETS: BracketPreset[] = [
  {
    key: 'steel_structure',
    label: '鋼結構工程',
    category: 'STEEL',
    specDescription: `●熱浸鍍鋅鋼構
　樑柱：H型鋼
　衍架：C型鋼
　熱浸鍍鋅處理`,
  },
  {
    key: 'foundation_work',
    label: '基礎工程',
    category: 'STEEL',
    specDescription: `●基礎工程
　基礎位置放樣、植筋
　柱子固定後覆以無收縮水泥
　混凝土墩施作`,
  },
];

// 機電工程預設規格 (MEP)
export const MEP_PRESETS: BracketPreset[] = [
  {
    key: 'cable_wiring',
    label: '線纜配線',
    category: 'MEP',
    specDescription: `●電力線纜工程
　主幹電纜
　分路配線
　接地系統`,
  },
  {
    key: 'inverter_install',
    label: '變流器安裝',
    category: 'MEP',
    specDescription: `●變流器安裝工程
　變流器固定架設
　電纜連接
　接地連接`,
  },
  {
    key: 'monitoring_system',
    label: '監控系統',
    category: 'MEP',
    specDescription: `●監控系統
　監控設備安裝
　通訊線路佈設
　系統整合測試`,
  },
];

// 土木工程預設規格 (CIVIL)
export const CIVIL_PRESETS: BracketPreset[] = [
  {
    key: 'site_prep',
    label: '場地整理',
    category: 'CIVIL',
    specDescription: `●場地整理工程
　場地清理
　整地作業
　排水系統`,
  },
  {
    key: 'access_road',
    label: '道路施作',
    category: 'CIVIL',
    specDescription: `●道路施作
　臨時便道
　永久道路
　排水溝渠`,
  },
];

// 箱體預設規格 (CABINET)
export const CABINET_PRESETS: BracketPreset[] = [
  {
    key: 'main_panel',
    label: '主配電盤',
    category: 'CABINET',
    specDescription: `●主配電盤
　配電盤箱體
　斷路器
　電表`,
  },
  {
    key: 'combiner_box',
    label: '接線箱',
    category: 'CABINET',
    specDescription: `●接線箱
　串併接線箱
　防雷設備
　保護裝置`,
  },
];

// 行政作業預設規格 (ADMIN)
export const ADMIN_PRESETS: BracketPreset[] = [
  {
    key: 'permit_application',
    label: '申請許可',
    category: 'ADMIN',
    specDescription: `●行政申請
　再生能源設備同意備案
　電業執照申請
　併網申請`,
  },
  {
    key: 'project_management',
    label: '專案管理',
    category: 'ADMIN',
    specDescription: `●專案管理
　工程監造
　進度管理
　品質管控`,
  },
];

// 公司管理預設規格 (COMPANY)
export const COMPANY_PRESETS: BracketPreset[] = [
  {
    key: 'overhead_cost',
    label: '管理費用',
    category: 'COMPANY',
    specDescription: `●公司管理費用
　行政管理
　財務管理
　人事費用`,
  },
  {
    key: 'profit_margin',
    label: '利潤',
    category: 'COMPANY',
    specDescription: '合理利潤',
  },
];

// 模租鋪設預設規格 (ROOF_RENTAL)
export const ROOF_RENTAL_PRESETS: BracketPreset[] = [
  {
    key: 'roof_lease',
    label: '屋頂租賃',
    category: 'ROOF_RENTAL',
    specDescription: `●屋頂租賃
　租賃契約
　保險費用
　維護管理`,
  },
  {
    key: 'module_install',
    label: '模組鋪設',
    category: 'ROOF_RENTAL',
    specDescription: `●模組鋪設工程
　模組安裝
　線路配接
　系統調校`,
  },
];

// 取得所有預設值
export const ALL_ENGINEERING_PRESETS: BracketPreset[] = [
  ...MODULE_BRACKET_PRESETS,
  ...PROTECTION_ENGINEERING_PRESETS,
  ...STEEL_ENGINEERING_PRESETS,
  ...MEP_PRESETS,
  ...CIVIL_PRESETS,
  ...CABINET_PRESETS,
  ...ADMIN_PRESETS,
  ...COMPANY_PRESETS,
  ...ROOF_RENTAL_PRESETS,
];

// 根據 key 取得預設規格
export function getBracketSpecByKey(key: string): string {
  const preset = ALL_ENGINEERING_PRESETS.find(p => p.key === key);
  return preset?.specDescription || '';
}

// 檢查項目名稱是否可能適用支架預選
export function suggestBracketPreset(itemName: string): BracketPreset | null {
  const lowerName = itemName.toLowerCase();
  
  // 模組支架關鍵字
  if (lowerName.includes('支架') || lowerName.includes('鋼構')) {
    if (lowerName.includes('鋁擠') || lowerName.includes('鋁合金')) {
      return MODULE_BRACKET_PRESETS.find(p => p.key === 'aluminum_extrusion') || null;
    }
    if (lowerName.includes('鍍鎂') || lowerName.includes('鋁鋅')) {
      return MODULE_BRACKET_PRESETS.find(p => p.key === 'mg_al_zn_bracket') || null;
    }
    if (lowerName.includes('熱浸') || lowerName.includes('鍍鋅')) {
      return MODULE_BRACKET_PRESETS.find(p => p.key === 'galvanized_steel_with_wave') || null;
    }
  }
  
  // 防護工程關鍵字
  if (lowerName.includes('維修步道') || lowerName.includes('走道')) {
    return PROTECTION_ENGINEERING_PRESETS.find(p => p.key === 'maintenance_walkway') || null;
  }
  if (lowerName.includes('防墜') || lowerName.includes('鋼索')) {
    return PROTECTION_ENGINEERING_PRESETS.find(p => p.key === 'fall_protection_cable') || null;
  }
  if (lowerName.includes('圍籬') || lowerName.includes('圍欄')) {
    return PROTECTION_ENGINEERING_PRESETS.find(p => p.key === 'protection_fence') || null;
  }
  if (lowerName.includes('爬梯') || lowerName.includes('樓梯')) {
    return PROTECTION_ENGINEERING_PRESETS.find(p => p.key === 'maintenance_ladder') || null;
  }
  if (lowerName.includes('螺絲')) {
    return PROTECTION_ENGINEERING_PRESETS.find(p => p.key === 'screw_set') || null;
  }
  
  return null;
}
