// Investment Report Types & Templates

export type ReportTemplateType = 'self_consumption' | 'feed_in_tariff' | 'rental_investment';

export interface ReportStyleSettings {
  // Logo
  logoSize: number; // 30-100px
  logoPosition: 'left' | 'right';
  
  // Typography
  titleFontSize: number; // 18-28px
  subtitleFontSize: number; // 12-16px
  bodyFontSize: number; // 11-14px
  tableFontSize: number; // 10-13px
  
  // Header
  reportTitle: string;
  reportSubtitle: string;
  
  // Sections visibility
  showAIContent: boolean;
  showCharts: boolean;
  showTrec: boolean;
  showSensitivity: boolean;
  showGridFlexibility: boolean;
  showLcoeCalculation: boolean;
  showAdvantageRisk: boolean;
  showEngineeringSpecs: boolean;
  showCustomImages: boolean;
}

export interface ReportTextContent {
  // Editable text blocks
  gridFlexibilityTitle: string;
  gridFlexibilityContent: string;
  advantageTitle: string;
  advantageItems: string[];
  riskTitle: string;
  riskItems: string[];
  conclusionTitle: string;
  conclusionContent: string;
}

export interface ReportTemplate {
  id: ReportTemplateType;
  name: string;
  description: string;
  defaultStyle: Partial<ReportStyleSettings>;
  defaultText: Partial<ReportTextContent>;
  sections: string[];
}

// Template definitions
export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'self_consumption',
    name: '併內線自用節電',
    description: '適用於自發自用方案，強調 T-REC 綠能憑證與電費節省',
    defaultStyle: {
      showTrec: true,
      showGridFlexibility: true,
      showLcoeCalculation: true,
      showAdvantageRisk: true,
    },
    defaultText: {
      gridFlexibilityTitle: '採用「併內線」的靈活設計，為企業保留未來的關鍵選擇權',
      gridFlexibilityContent: `(1)、綠電憑證（REC）彈性取得
本案以併內線架構設計，未來只要切換用電模式，即可立即轉為「自發自用」，讓貴公司快速取得綠電憑證，以符合企業減碳策略、供應鏈要求或 ESG 查核標準。

(2)、有效規避未來電價上漲風險
當未來台電電價一旦高於售電價格，貴公司可隨時轉為自用模式，直接以低成本的太陽能電力取代高額購電費，顯著降低因電價調漲所帶來的營運風險。`,
      advantageTitle: '方案優勢',
      advantageItems: [
        '能源自足、節能減碳：太陽能系統可節省園區用電需求，顯著降低向台電購電與對化石燃料依賴。',
        '電費節省、成本可預期：完工後，多數電力來自自發自用；運行與維護費用固定，能有效對沖未來電價漲幅風險。',
        'T-REC 帶來額外收益：本案 20 年估計核發約 1,452 張 T-REC，可用於 GHG 盤查、ESG 報告、RE100 承諾。',
        '品牌加分、社會回饋：投入再生能源彰顯企業對環保的承諾，提升形象並獲得客戶、投資人及社區正向認同。',
      ],
      riskTitle: '須留意事項',
      riskItems: [
        '躉售 (FIT) 與 T-REC 擇一：參與綠電交易（自發自用＋T-REC）後，即無法將電力以 FIT 價格全額售回台電。',
        '交易與法規專業度：T-REC 申請、平台登錄、合約磋商等需專責人員或顧問協助。',
        '價格波動風險：T-REC 價格受供需、政策與國際趨勢影響。',
      ],
    },
    sections: ['kpi', 'systemOverview', 'cashFlow', 'lcoe', 'gridFlexibility', 'trec', 'sensitivity', 'advantageRisk', 'aiSummary'],
  },
  {
    id: 'feed_in_tariff',
    name: '躉售電力方案',
    description: '適用於台電躉購方案，強調固定費率與穩定收益',
    defaultStyle: {
      showTrec: false,
      showGridFlexibility: false,
      showLcoeCalculation: true,
      showAdvantageRisk: true,
    },
    defaultText: {
      advantageTitle: '躉售方案優勢',
      advantageItems: [
        '20 年固定費率保障：政府躉購費率鎖定 20 年，收益穩定可預測。',
        '無須自行消耗電力：發電全數售予台電，無需配合用電時段或改變用電習慣。',
        '維運單純、風險可控：設備維護與保險費用固定，現金流穩定。',
        '投資報酬明確：IRR 與回收年限可精準估算，適合穩健型投資者。',
      ],
      riskTitle: '須留意事項',
      riskItems: [
        '無法取得 T-REC：躉售方案電力已售予台電，無法申請綠能憑證。',
        '電價上漲無法受益：若未來電價大幅上漲，躉售收益固定無法調整。',
        '需配合台電併網時程：掛表與送電需依台電作業時程辦理。',
      ],
    },
    sections: ['kpi', 'systemOverview', 'cashFlow', 'lcoe', 'sensitivity', 'advantageRisk', 'aiSummary'],
  },
  {
    id: 'rental_investment',
    name: '租賃投資方案',
    description: '適用於場地租賃模式，需扣除租金成本的投資分析',
    defaultStyle: {
      showTrec: false,
      showGridFlexibility: false,
      showLcoeCalculation: true,
      showAdvantageRisk: true,
    },
    defaultText: {
      advantageTitle: '租賃投資優勢',
      advantageItems: [
        '無需自有場地：可利用他人閒置屋頂或土地進行太陽能投資。',
        '固定租金成本：租金費率在合約期間固定，成本可預測。',
        '專業團隊維運：通常由投資方負責全部維運，地主無須操心。',
        '共創雙贏：地主獲得租金收入，投資方取得發電收益。',
      ],
      riskTitle: '須留意事項',
      riskItems: [
        '租金侵蝕利潤：租金成本會降低淨收益與 IRR。',
        '合約風險：需確保租約年限涵蓋系統壽命，避免提前終止。',
        '場地品質依賴：發電效率受場地條件影響，需事前評估。',
      ],
    },
    sections: ['kpi', 'systemOverview', 'cashFlow', 'rentalCost', 'lcoe', 'sensitivity', 'advantageRisk', 'aiSummary'],
  },
];

// Default style settings
export const DEFAULT_REPORT_STYLE: ReportStyleSettings = {
  logoSize: 50,
  logoPosition: 'right',
  titleFontSize: 22,
  subtitleFontSize: 13,
  bodyFontSize: 13,
  tableFontSize: 12,
  reportTitle: '',
  reportSubtitle: '',
  showAIContent: true,
  showCharts: true,
  showTrec: true,
  showSensitivity: true,
  showGridFlexibility: true,
  showLcoeCalculation: true,
  showAdvantageRisk: true,
  showEngineeringSpecs: false,
  showCustomImages: true,
};

export const DEFAULT_REPORT_TEXT: ReportTextContent = {
  gridFlexibilityTitle: '採用「併內線」的靈活設計',
  gridFlexibilityContent: '',
  advantageTitle: '方案優勢',
  advantageItems: [],
  riskTitle: '須留意事項',
  riskItems: [],
  conclusionTitle: '結論',
  conclusionContent: '',
};

// Engineering specs interface (from quote data)
export interface EngineeringSpec {
  moduleBrand: string;
  moduleModel: string;
  moduleWattage: number;
  moduleCount: number;
  inverterBrand: string;
  inverterModel: string;
  inverterCount: number;
  rackType: string;
  connectionType: string;
}
