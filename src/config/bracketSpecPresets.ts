// 支架與防護工程規格描述預設值
// Based on user-provided specifications from industry standards

export type BracketCategory = 'module_bracket' | 'protection_engineering';

export interface BracketPreset {
  key: string;
  label: string;
  parentLabel?: string;
  specDescription: string;
  category: BracketCategory;
  isSubOption?: boolean;
}

// 模組支架預設規格
export const MODULE_BRACKET_PRESETS: BracketPreset[] = [
  {
    key: 'galvanized_steel_with_wave',
    label: '(1) 有浪板',
    parentLabel: '熱浸鍍鋅鋼構',
    category: 'module_bracket',
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
    category: 'module_bracket',
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
    category: 'module_bracket',
    specDescription: `●鋁擠成型6061T5支架
　(浪板溝峰距模組完成面架高約20cm)
　陽極處理鍍膜
　壓克力透明漆`,
  },
  {
    key: 'mg_al_zn_bracket',
    label: '鍍鎂鋁鋅支架',
    category: 'module_bracket',
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
    category: 'module_bracket',
    specDescription: '',
  },
];

// 防護工程預設規格
export const PROTECTION_ENGINEERING_PRESETS: BracketPreset[] = [
  {
    key: 'maintenance_walkway',
    label: '維修步道',
    category: 'protection_engineering',
    specDescription: '熱浸鍍鋅菱形網維修步道',
  },
  {
    key: 'fall_protection_cable',
    label: '防墜鋼索',
    category: 'protection_engineering',
    specDescription: '防墜鋼索',
  },
  {
    key: 'protection_fence',
    label: '防護圍籬',
    category: 'protection_engineering',
    specDescription: '防護圍籬',
  },
  {
    key: 'maintenance_ladder',
    label: '維修爬梯',
    category: 'protection_engineering',
    specDescription: '不鏽鋼爬梯',
  },
  {
    key: 'screw_set',
    label: '螺絲組',
    category: 'protection_engineering',
    specDescription: `●五金另料、
　a、自攻螺絲SUS410材質
　b、鋼構吊掛、組立安裝
　c、固定螺絲/華司及彈簧華司均為SUS304等級`,
  },
];

// 取得所有預設值
export const ALL_BRACKET_PRESETS = [...MODULE_BRACKET_PRESETS, ...PROTECTION_ENGINEERING_PRESETS];

// 根據 key 取得預設規格
export function getBracketSpecByKey(key: string): string {
  const preset = ALL_BRACKET_PRESETS.find(p => p.key === key);
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
