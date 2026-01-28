/**
 * 報價單產出對話框 V2
 * 使用 HTML 預覽 + 瀏覽器列印產生 PDF
 */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { EngineeringCategory, ModuleItem, InverterItem } from "@/hooks/useQuoteEngineering";
import QuoteDocumentPreview, { QuotePreviewData, PaymentTermItem } from "./QuoteDocumentPreview";

interface QuoteDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  formData: {
    capacityKwp: number;
    pricePerKwp: number;
    taxRate: number;
  };
  categories: EngineeringCategory[];
  modules: ModuleItem[];
  inverters: InverterItem[];
  projectId?: string | null;
  investorId?: string | null;
}

// 預設付款條件
const DEFAULT_PAYMENT_TERMS: PaymentTermItem[] = [
  { name: "第一期款-訂金", percentage: 20, condition: "合約確立後" },
  { name: "第二期款-材料進場", percentage: 30, condition: "材料進場並點交完成後支付" },
  { name: "第三期款-工程進度", percentage: 40, condition: "台電報竣掛表後支付" },
  { name: "第四期款-掛表暨驗收", percentage: 10, condition: "取得設備登記証文後" },
];

// 預設條款
const DEFAULT_TERMS = [
  "相關規格以台電審定圖為主",
  "如貴公司未經本公司同意任意變更交易內容及方式，本公司有權請求賠償。",
  "本報價單未含新設低壓外線費用及台電衍生費用如新設引接、線補費及電纜加強費。",
  "此報價單經簽名或蓋章回傳後，視同正式訂單。",
  "以上未盡事宜，由雙方協議後另行補充。",
];

export default function QuoteDocumentDialogV2({
  open,
  onOpenChange,
  quoteId,
  formData,
  categories,
  modules,
  inverters,
  projectId,
  investorId,
}: QuoteDocumentDialogProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewData, setPreviewData] = useState<QuotePreviewData | null>(null);

  // 取得公司資訊
  const { data: appSettings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 取得投資方資訊
  const { data: investor } = useQuery({
    queryKey: ["investor", investorId],
    queryFn: async () => {
      if (!investorId) return null;
      const { data, error } = await supabase
        .from("investors")
        .select("*")
        .eq("id", investorId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!investorId,
  });

  // 取得案場資訊
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // 取得報價單資訊
  const { data: quote } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: async () => {
      if (!quoteId) return null;
      const { data, error } = await supabase
        .from("project_quotes")
        .select("*")
        .eq("id", quoteId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!quoteId,
  });

  // 計算金額
  const calculateTotals = useMemo(() => {
    const capacityKwp = formData.capacityKwp || 0;
    const pricePerKwp = formData.pricePerKwp || 0;
    const taxRate = formData.taxRate || 0.05;

    const subtotal = capacityKwp * pricePerKwp;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    return {
      subtotal,
      tax,
      total,
      pricePerKwpExcludingTax: pricePerKwp,
      pricePerKwpIncludingTax: pricePerKwp * (1 + taxRate),
    };
  }, [formData]);

  // 建構項目明細
  const buildItems = useMemo(() => {
    const items: QuotePreviewData["items"] = [];
    let orderNum = 1;

    // 模組
    modules.forEach((m, idx) => {
      items.push({
        order: orderNum++,
        category: "equipment",
        categoryName: idx === 0 ? "太陽光電模組" : "",
        name: "太陽光電模組",
        spec: m.moduleModel || `${m.wattagePerPanel}W 單晶矽模組`,
        quantity: m.panelCount,
        unit: "PCS",
      });
    });

    // 逆變器
    inverters.forEach((inv) => {
      items.push({
        order: orderNum++,
        category: "equipment",
        categoryName: "",
        name: "太陽能逆變器",
        spec: inv.inverterModel || `${inv.capacityKw}kW 逆變器`,
        quantity: inv.inverterCount,
        unit: "PCS",
      });
    });

    // 工程項目
    categories.forEach((cat) => {
      let firstInCategory = true;
      cat.items.forEach((item) => {
        items.push({
          order: orderNum++,
          category: cat.categoryCode,
          categoryName: firstInCategory ? cat.categoryName : "",
          name: item.itemName,
          spec: item.note || "",
          quantity:
            item.billingMethod === "per_kw"
              ? `${formData.capacityKwp.toFixed(2)} kW`
              : item.quantity,
          unit: item.unit,
        });
        firstInCategory = false;
      });
    });

    return items;
  }, [categories, modules, inverters, formData.capacityKwp]);

  // 計算付款金額
  const paymentTermsWithAmount = useMemo(() => {
    return DEFAULT_PAYMENT_TERMS.map((term) => ({
      ...term,
      amount: calculateTotals.total * (term.percentage / 100),
    }));
  }, [calculateTotals.total]);

  // 初始化預覽資料
  useEffect(() => {
    if (open) {
      const data: QuotePreviewData = {
        company: {
          name: appSettings?.company_name_zh || "公司名稱",
          address: appSettings?.address || "",
          phone: appSettings?.phone || "",
          taxId: appSettings?.tax_id || "",
          bankName: (appSettings as any)?.bank_name || "",
          bankBranch: (appSettings as any)?.bank_branch || "",
          bankCode: (appSettings as any)?.bank_code || "",
          bankAccountNumber: (appSettings as any)?.bank_account_number || "",
          bankAccountName: (appSettings as any)?.bank_account_name || "",
        },
        customer: {
          name: investor?.company_name || "",
          contact: investor?.contact_person || "",
          phone: investor?.phone || "",
          siteAddress: project?.address || "",
        },
        quote: {
          number: quote?.quote_number || "",
          date: new Date().toISOString().split("T")[0],
          validUntil: quote?.valid_until || "",
          salesperson: "",
          salespersonPhone: "",
          capacityKwp: formData.capacityKwp,
        },
        items: buildItems,
        summary: calculateTotals,
        paymentTerms: paymentTermsWithAmount,
        terms: [...DEFAULT_TERMS],
      };
      setPreviewData(data);
    }
  }, [open, appSettings, investor, project, quote, buildItems, calculateTotals, paymentTermsWithAmount, formData.capacityKwp]);

  // 生成列印專用 HTML
  const buildPrintHTML = useCallback((data: QuotePreviewData) => {
    const formatCurrencyStr = (value: number) => {
      return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    };

    return `
      <div class="quote-container">
        <!-- 標頭區 -->
        <div class="header-section">
          <div class="flex justify-between">
            <div>
              <div class="company-name">${data.company.name}</div>
              <div class="company-info">${data.company.address}</div>
              <div class="company-info">Tel: ${data.company.phone} ｜ 統編: ${data.company.taxId}</div>
            </div>
            <div class="text-right">
              <div class="quote-title">報 價 單</div>
              <div class="quote-subtitle">QUOTATION</div>
            </div>
          </div>
        </div>

        <!-- 客戶與報價資訊 -->
        <div class="grid-2 mb-6">
          <div class="info-card">
            <div class="info-card-title">客戶資訊 Customer Information</div>
            <div class="info-row"><span class="info-label">客戶名稱</span><span class="info-value">${data.customer.name || '-'}</span></div>
            <div class="info-row"><span class="info-label">聯 絡 人</span><span class="info-value">${data.customer.contact || '-'}</span></div>
            <div class="info-row"><span class="info-label">聯絡電話</span><span class="info-value">${data.customer.phone || '-'}</span></div>
            <div class="info-row"><span class="info-label">案場地址</span><span class="info-value">${data.customer.siteAddress || '-'}</span></div>
          </div>
          <div class="info-card">
            <div class="info-card-title">報價資訊 Quote Details</div>
            <div class="info-row"><span class="info-label">報價單號</span><span class="info-value font-mono">${data.quote.number || '-'}</span></div>
            <div class="info-row"><span class="info-label">報價日期</span><span class="info-value">${data.quote.date || '-'}</span></div>
            <div class="info-row"><span class="info-label">有效期限</span><span class="info-value">${data.quote.validUntil || '-'}</span></div>
            <div class="info-row"><span class="info-label">業 務 員</span><span class="info-value">${data.quote.salesperson || '-'}</span></div>
          </div>
        </div>

        <!-- 裝置容量 -->
        <div class="capacity-block">
          <div class="flex items-center gap-3">
            <div class="capacity-icon">
              <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div>
              <div class="capacity-label">太陽光電系統總裝置容量</div>
              <div class="capacity-value">${data.quote.capacityKwp.toFixed(2)} kWp</div>
            </div>
          </div>
          <div>
            <div class="unit-price-label">每 kW 單價（含稅）</div>
            <div class="unit-price-value">${formatCurrencyStr(data.summary.pricePerKwpIncludingTax)}</div>
          </div>
        </div>

        <!-- 工程項目明細 -->
        <div class="mb-6">
          <div class="section-title">
            <span class="section-indicator section-indicator-blue"></span>
            工程項目明細 Scope of Work
          </div>
          <table class="work-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">項次</th>
                <th style="width: 80px;">類別</th>
                <th>項目名稱</th>
                <th>規格說明</th>
                <th style="width: 80px; text-align: center;">數量</th>
                <th style="width: 50px; text-align: center;">單位</th>
              </tr>
            </thead>
            <tbody>
              ${data.items.map((item, i) => `
                <tr>
                  <td style="text-align: center;">${item.order}</td>
                  <td>${item.categoryName ? `<span class="category-badge">${item.categoryName}</span>` : ''}</td>
                  <td>${item.name}</td>
                  <td style="color: #6b7280;">${item.spec}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: center;">${item.unit}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 金額摘要 -->
        <div class="grid-2 mb-6">
          <div class="summary-box">
            <div class="summary-header">金額摘要 Price Summary</div>
            <div class="summary-content">
              <div class="summary-row">
                <span class="summary-row-label">合計（未稅）</span>
                <span class="summary-row-value">${formatCurrencyStr(data.summary.subtotal)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-row-label">營業稅 (5%)</span>
                <span class="summary-row-value">${formatCurrencyStr(data.summary.tax)}</span>
              </div>
              <div class="summary-total">
                <span class="summary-total-label">總計（含稅）</span>
                <span class="summary-total-value">${formatCurrencyStr(data.summary.total)}</span>
              </div>
            </div>
          </div>
          <div class="info-card">
            <div style="font-weight: 700; color: #374151; margin-bottom: 12px;">單價參考 Unit Price Reference</div>
            <div class="info-row">
              <span class="info-label" style="width: 120px;">每 kW（未稅）</span>
              <span class="info-value">${formatCurrencyStr(data.summary.pricePerKwpExcludingTax)} /kW</span>
            </div>
            <div class="info-row">
              <span class="info-label" style="width: 120px;">每 kW（含稅）</span>
              <span class="info-value">${formatCurrencyStr(data.summary.pricePerKwpIncludingTax)} /kW</span>
            </div>
          </div>
        </div>

        <!-- 付款條件 -->
        <div class="mb-6">
          <div class="section-title">
            <span class="section-indicator section-indicator-green"></span>
            付款條件 Payment Terms
          </div>
          <table class="payment-table">
            <thead>
              <tr>
                <th style="text-align: left;">期別</th>
                <th style="width: 70px; text-align: center;">比例</th>
                <th style="width: 120px; text-align: right;">金額</th>
                <th style="text-align: left;">付款條件</th>
              </tr>
            </thead>
            <tbody>
              ${data.paymentTerms.map((term, i) => `
                <tr>
                  <td style="font-weight: 500;">${term.name}</td>
                  <td style="text-align: center;"><span class="payment-badge">${term.percentage}%</span></td>
                  <td style="text-align: right; font-weight: 500;">${formatCurrencyStr(term.amount || 0)}</td>
                  <td style="color: #6b7280;">${term.condition || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 條款說明 -->
        <div class="mb-6">
          <div class="section-title">
            <span class="section-indicator section-indicator-amber"></span>
            條款說明 Terms & Conditions
          </div>
          <div class="terms-box">
            ${data.terms.map((term, i) => `
              <div class="term-item">
                <span class="term-number">${i + 1}</span>
                <span class="term-text">${term}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 銀行資訊 -->
        ${data.company.bankName ? `
          <div class="bank-box">
            <div class="bank-header">匯款資訊 Bank Information</div>
            <div class="bank-content">
              <div class="bank-row"><span class="bank-label">銀行名稱</span><span class="bank-value">${data.company.bankName}</span></div>
              <div class="bank-row"><span class="bank-label">分行名稱</span><span class="bank-value">${data.company.bankBranch || ''}</span></div>
              <div class="bank-row"><span class="bank-label">銀行代碼</span><span class="bank-value font-mono">${data.company.bankCode || ''}</span></div>
              <div class="bank-row"><span class="bank-label">帳號</span><span class="bank-value font-mono">${data.company.bankAccountNumber || ''}</span></div>
              <div class="bank-row bank-row-full"><span class="bank-label">戶名</span><span class="bank-value">${data.company.bankAccountName || ''}</span></div>
            </div>
          </div>
        ` : ''}

        <!-- 簽章區 -->
        <div class="signature-section">
          <div class="signature-grid">
            <div class="signature-box">
              <div class="signature-title">賣方（簽章）Seller</div>
              <div class="signature-line">
                <span class="signature-name">${data.company.name}</span>
              </div>
              <div class="signature-date">日期 Date: _______________</div>
            </div>
            <div class="signature-box">
              <div class="signature-title">買方（簽章）Buyer</div>
              <div class="signature-line">
                <span class="signature-name">${data.customer.name || '________________'}</span>
              </div>
              <div class="signature-date">日期 Date: _______________</div>
            </div>
          </div>
        </div>

        <!-- 頁腳 -->
        <div class="footer">
          本報價單由 ${data.company.name} 製作 ｜ 報價單號：${data.quote.number}
        </div>
      </div>
    `;
  }, []);
  const handlePrint = useCallback(() => {
    if (!previewRef.current) return;

    const printContent = previewRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=800,height=600");
    
    if (!printWindow) {
      toast.error("無法開啟列印視窗，請檢查瀏覽器設定");
      return;
    }

    // 建立完整的內嵌樣式 HTML
    const printStyles = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
      
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      html, body {
        font-family: 'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', sans-serif;
        font-size: 10pt;
        line-height: 1.5;
        color: #1a1a1a;
        background: white;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      @page { 
        size: A4; 
        margin: 15mm; 
      }
      
      .no-print { display: none !important; }
      
      input, textarea { 
        border: none !important; 
        background: transparent !important;
        font-family: inherit;
        font-size: inherit;
        color: inherit;
        padding: 0;
        margin: 0;
      }
      
      /* 表格樣式 */
      table { border-collapse: collapse; width: 100%; page-break-inside: avoid; }
      th, td { padding: 6px 10px; vertical-align: middle; }
      
      /* 區塊樣式 */
      .quote-container { width: 100%; max-width: 100%; padding: 0; }
      
      /* 標頭區 */
      .header-section { 
        border-bottom: 4px double #1f2937; 
        padding-bottom: 20px; 
        margin-bottom: 20px; 
      }
      .company-name { font-size: 18pt; font-weight: 700; color: #1f2937; }
      .company-info { font-size: 9pt; color: #4b5563; margin-top: 4px; }
      .quote-title { 
        font-size: 28pt; 
        font-weight: 900; 
        letter-spacing: 0.5em; 
        color: #1a1a1a;
        border-bottom: 2px solid #1f2937;
        padding-bottom: 8px;
        margin-bottom: 6px;
      }
      .quote-subtitle { font-size: 12pt; color: #4b5563; letter-spacing: 0.2em; }
      
      /* 資訊卡片 */
      .info-card { 
        border: 1px solid #d1d5db; 
        border-radius: 8px; 
        padding: 16px; 
        background: #f9fafb; 
      }
      .info-card-title { 
        font-size: 9pt; 
        font-weight: 700; 
        color: #6b7280; 
        text-transform: uppercase; 
        letter-spacing: 0.1em;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 8px;
        margin-bottom: 12px;
      }
      .info-row { display: flex; margin-bottom: 8px; font-size: 10pt; }
      .info-label { width: 70px; color: #6b7280; flex-shrink: 0; }
      .info-value { flex: 1; font-weight: 500; color: #1f2937; }
      
      /* 容量區塊 */
      .capacity-block {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: white;
        border-radius: 10px;
        padding: 16px 24px;
        margin: 20px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .capacity-icon {
        width: 48px;
        height: 48px;
        background: rgba(255,255,255,0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .capacity-label { font-size: 9pt; opacity: 0.9; }
      .capacity-value { font-size: 22pt; font-weight: 700; }
      .unit-price-label { font-size: 9pt; opacity: 0.9; text-align: right; }
      .unit-price-value { font-size: 18pt; font-weight: 700; text-align: right; }
      
      /* 區塊標題 */
      .section-title {
        font-size: 10pt;
        font-weight: 700;
        color: #374151;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .section-indicator {
        width: 4px;
        height: 16px;
        border-radius: 2px;
      }
      .section-indicator-blue { background: #2563eb; }
      .section-indicator-green { background: #16a34a; }
      .section-indicator-amber { background: #f59e0b; }
      
      /* 工程表格 */
      .work-table { margin-bottom: 20px; }
      .work-table thead tr { background: #1f2937; color: white; }
      .work-table th { 
        font-weight: 600; 
        font-size: 9pt; 
        padding: 10px 8px;
        border: 1px solid #374151;
      }
      .work-table td { 
        border: 1px solid #d1d5db; 
        font-size: 9pt;
        padding: 8px;
      }
      .work-table tbody tr:nth-child(even) { background: #f9fafb; }
      .category-badge {
        display: inline-block;
        background: #dbeafe;
        color: #1e40af;
        font-size: 8pt;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 500;
      }
      
      /* 金額摘要 */
      .summary-box {
        border: 2px solid #1f2937;
        border-radius: 8px;
        overflow: hidden;
      }
      .summary-header {
        background: #1f2937;
        color: white;
        padding: 10px 16px;
        font-weight: 700;
        font-size: 11pt;
      }
      .summary-content { padding: 16px; }
      .summary-row { 
        display: flex; 
        justify-content: space-between; 
        margin-bottom: 8px;
        font-size: 10pt;
      }
      .summary-row-label { color: #4b5563; }
      .summary-row-value { font-weight: 500; }
      .summary-total {
        border-top: 2px solid #1f2937;
        padding-top: 12px;
        margin-top: 12px;
        display: flex;
        justify-content: space-between;
        font-size: 13pt;
      }
      .summary-total-label { font-weight: 700; }
      .summary-total-value { font-weight: 700; color: #2563eb; }
      
      /* 付款條件表格 */
      .payment-table thead tr { background: #16a34a; color: white; }
      .payment-table th { 
        border: 1px solid #15803d;
        font-size: 9pt;
        padding: 10px 8px;
        font-weight: 600;
      }
      .payment-table td { border: 1px solid #d1d5db; font-size: 9pt; padding: 8px; }
      .payment-table tbody tr:nth-child(even) { background: #f0fdf4; }
      .payment-badge {
        display: inline-block;
        background: #dcfce7;
        color: #166534;
        font-size: 9pt;
        padding: 2px 10px;
        border-radius: 4px;
        font-weight: 600;
      }
      
      /* 條款區塊 */
      .terms-box {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 16px;
        background: #fffbeb;
      }
      .term-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 8px;
        font-size: 9pt;
      }
      .term-number {
        width: 22px;
        height: 22px;
        background: #fde68a;
        color: #92400e;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8pt;
        font-weight: 700;
        flex-shrink: 0;
      }
      .term-text { flex: 1; color: #374151; line-height: 1.6; }
      
      /* 銀行資訊 */
      .bank-box {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 24px;
      }
      .bank-header {
        background: #f3f4f6;
        padding: 10px 16px;
        border-bottom: 1px solid #d1d5db;
        font-weight: 700;
        font-size: 10pt;
        color: #374151;
      }
      .bank-content {
        padding: 16px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 32px;
        font-size: 9pt;
      }
      .bank-row { display: flex; }
      .bank-label { width: 70px; color: #6b7280; }
      .bank-value { font-weight: 500; }
      .bank-row-full { grid-column: span 2; }
      
      /* 簽章區 */
      .signature-section {
        border-top: 2px solid #1f2937;
        padding-top: 24px;
        margin-top: 32px;
      }
      .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
      .signature-box { }
      .signature-title { font-size: 10pt; font-weight: 700; color: #4b5563; margin-bottom: 8px; }
      .signature-line { 
        border-bottom: 2px solid #9ca3af; 
        height: 72px; 
        display: flex; 
        align-items: flex-end; 
        padding-bottom: 8px;
      }
      .signature-name { color: #6b7280; font-size: 9pt; }
      .signature-date { font-size: 8pt; color: #9ca3af; margin-top: 8px; }
      
      /* 頁腳 */
      .footer {
        margin-top: 24px;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        font-size: 8pt;
        color: #9ca3af;
      }
      
      /* Grid utilities */
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
      .flex { display: flex; }
      .items-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .gap-3 { gap: 12px; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .font-mono { font-family: 'Courier New', monospace; }
      .mb-4 { margin-bottom: 16px; }
      .mb-6 { margin-bottom: 24px; }
    `;

    // 重新構建 HTML 內容，使用內嵌樣式
    const htmlContent = buildPrintHTML(previewData);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>報價單 - ${previewData?.quote.number || "document"}</title>
        <style>${printStyles}</style>
      </head>
      <body>${htmlContent}</body>
      </html>
    `);

    printWindow.document.close();
    
    // 等待內容載入後列印
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }, [previewData]);

  if (!previewData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[95vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            報價單預覽與編輯
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            可直接編輯下方內容，完成後點擊「列印 / 另存 PDF」
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <QuoteDocumentPreview
            ref={previewRef}
            data={previewData}
            onDataChange={setPreviewData}
          />
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            列印 / 另存 PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
