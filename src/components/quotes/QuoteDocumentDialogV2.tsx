/**
 * 報價單產出對話框 V2
 * 支援兩種模式：傳統預覽 / Excel 式編輯器
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
import { Printer, FileText, Minus, Plus, Table2, FileEdit } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { EngineeringCategory, ModuleItem, InverterItem } from "@/hooks/useQuoteEngineering";
import QuoteDocumentPreview, { QuotePreviewData, PaymentTermItem } from "./QuoteDocumentPreview";
import ExcelQuoteEditor from "./ExcelQuoteEditor";

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
  const [editorMode, setEditorMode] = useState<"preview" | "excel">("excel"); // 預設使用 Excel 模式

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
        fontSize: 9, // 預設字體大小
      };
      setPreviewData(data);
    }
  }, [open, appSettings, investor, project, quote, buildItems, calculateTotals, paymentTermsWithAmount, formData.capacityKwp]);

  // 生成列印專用 HTML - 傳統簡潔版
  const buildPrintHTML = useCallback((data: QuotePreviewData) => {
    const fontSize = data.fontSize || 9;
    const formatCurrencyStr = (value: number) => {
      return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    };

    return `
      <div class="quote-container">
        <!-- 標頭：公司名稱 + 報價單 -->
        <div class="header-row">
          <div class="company-name">${data.company.name}</div>
          <div class="quote-title">報 價 單</div>
        </div>

        <!-- 報價資訊表頭 -->
        <table class="info-table">
          <tr>
            <td>客編/客戶名稱：<span class="field-value">${data.customer.name || ''}</span></td>
            <td></td>
            <td class="text-right">報價日期：<span class="field-value">${data.quote.date || ''}</span></td>
          </tr>
          <tr>
            <td>聯絡人：<span class="field-value">${data.customer.contact || ''}</span></td>
            <td>聯絡電話：<span class="field-value">${data.customer.phone || ''}</span></td>
            <td class="text-right">有效日期：<span class="field-value">${data.quote.validUntil || ''}</span></td>
          </tr>
          <tr>
            <td colspan="2">案場地點：<span class="field-value">${data.customer.siteAddress || ''}</span></td>
            <td class="text-right">業務員：<span class="field-value">${data.quote.salesperson || ''}</span></td>
          </tr>
          <tr>
            <td>裝置容量：(kW) <span class="field-value bold">${data.quote.capacityKwp.toFixed(2)}</span></td>
            <td></td>
            <td class="text-right">業務分機：<span class="field-value">${data.quote.salespersonPhone || ''}</span></td>
          </tr>
        </table>

        <!-- 項目明細表格 -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 35px;">項次</th>
              <th style="width: 120px;">品 名</th>
              <th>規 格</th>
              <th style="width: 70px;">數量</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map((item) => `
              <tr>
                <td class="text-center">${item.order}</td>
                <td>${item.name}</td>
                <td class="spec-cell">${item.spec}</td>
                <td class="text-center">${typeof item.quantity === 'number' ? `${item.quantity} ${item.unit}` : item.quantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- 銀行資訊 + 金額摘要 -->
        <div class="summary-section">
          <div class="bank-info">
            <div class="bank-title">帳戶資料如下列：</div>
            <div>戶名：${data.company.bankAccountName || data.company.name}</div>
            <div>銀行：${data.company.bankName || ''}</div>
            <div>分行：${data.company.bankBranch || ''}</div>
            <div>銀行代號：${data.company.bankCode || ''}</div>
            <div>帳號(TWD)：${data.company.bankAccountNumber || ''}</div>
          </div>
          <div class="price-summary">
            <div class="price-row"><span>合計(未稅)：</span><span>${formatCurrencyStr(data.summary.subtotal)}</span></div>
            <div class="price-row"><span>稅金：</span><span>${formatCurrencyStr(data.summary.tax)}</span></div>
            <div class="price-row total"><span>總計：</span><span>${formatCurrencyStr(data.summary.total)}</span></div>
            <div class="price-row sub"><span>每kWp(未稅)：</span><span>${formatCurrencyStr(data.summary.pricePerKwpExcludingTax)}</span></div>
            <div class="price-row sub"><span>每kWp(含稅)：</span><span>${formatCurrencyStr(data.summary.pricePerKwpIncludingTax)}</span></div>
          </div>
        </div>

        <!-- 條款說明 -->
        <div class="terms-section">
          ${data.terms.map((term, i) => `<div class="term-line">${i + 1}、${term}</div>`).join('')}
        </div>

        <!-- 簽章區 -->
        <div class="signature-section">
          <div class="signature-left">
            <div class="signature-label">客戶回簽欄(簽名或蓋章)</div>
            <div class="signature-line"></div>
          </div>
          <div class="signature-right">
            <div class="company-stamp">${data.company.name}</div>
          </div>
        </div>
      </div>
    `;
  }, []);

  const handlePrint = useCallback(() => {
    if (!previewData) return;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    
    if (!printWindow) {
      toast.error("無法開啟列印視窗，請檢查瀏覽器設定");
      return;
    }

    // 傳統簡潔版的列印樣式 - 使用動態字體大小
    const fontSize = previewData.fontSize || 9;
    const printStyles = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap');
      
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      html, body {
        font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
        font-size: ${fontSize}pt;
        line-height: 1.4;
        color: #1a1a1a;
        background: white;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      @page { 
        size: A4; 
        margin: 12mm 15mm; 
      }

      .quote-container { padding: 0; }

      /* 標頭 */
      .header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      }
      .company-name { font-size: ${fontSize + 5}pt; font-weight: 700; }
      .quote-title { 
        font-size: ${fontSize + 9}pt; 
        font-weight: 900; 
        letter-spacing: 0.3em;
        border-bottom: 2px solid #1a1a1a;
        padding-bottom: 4px;
      }

      /* 資訊表格 */
      .info-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 10px;
        font-size: ${fontSize}pt;
      }
      .info-table td { padding: 3px 0; color: #555; }
      .info-table .field-value { color: #1a1a1a; }
      .info-table .bold { font-weight: 700; }
      .text-right { text-align: right; }

      /* 項目明細表格 */
      .items-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
        font-size: ${fontSize - 0.5}pt;
      }
      .items-table th {
        background: #f3f4f6;
        border: 1px solid #9ca3af;
        padding: 6px 8px;
        font-weight: 600;
        text-align: left;
      }
      .items-table td {
        border: 1px solid #d1d5db;
        padding: 5px 8px;
        vertical-align: top;
      }
      .items-table .text-center { text-align: center; }
      .items-table .spec-cell { color: #4b5563; }

      /* 銀行 + 金額區塊 */
      .summary-section {
        display: flex;
        gap: 20px;
        margin-bottom: 12px;
        font-size: ${fontSize - 0.5}pt;
      }
      .bank-info {
        flex: 1;
        border: 1px solid #d1d5db;
        padding: 10px;
        line-height: 1.6;
      }
      .bank-title { font-weight: 700; margin-bottom: 4px; }
      .price-summary { width: 180px; text-align: right; }
      .price-row {
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
        border-bottom: 1px solid #e5e7eb;
      }
      .price-row.total {
        border-bottom: 2px solid #1a1a1a;
        font-weight: 700;
        font-size: ${fontSize + 1}pt;
      }
      .price-row.sub { color: #6b7280; font-size: ${fontSize - 1}pt; border-bottom: none; }

      /* 條款 */
      .terms-section {
        font-size: ${fontSize - 1}pt;
        color: #4b5563;
        margin-bottom: 16px;
        line-height: 1.6;
      }
      .term-line { margin-bottom: 2px; }

      /* 簽章區 */
      .signature-section {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-top: 20px;
        font-size: ${fontSize}pt;
      }
      .signature-left {}
      .signature-label { color: #6b7280; margin-bottom: 6px; }
      .signature-line { border-bottom: 1px solid #9ca3af; width: 180px; height: 40px; }
      .signature-right { text-align: right; }
      .company-stamp { font-weight: 700; }

      /* 規格多行支持 */
      .spec-cell { white-space: pre-wrap; }
    `;

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
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }, [previewData, buildPrintHTML]);

  if (!previewData) return null;

  const handleFontSizeChange = (delta: number) => {
    const newSize = Math.max(6, Math.min(12, (previewData.fontSize || 9) + delta));
    setPreviewData({ ...previewData, fontSize: newSize });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                報價單預覽與編輯
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {editorMode === "excel" 
                  ? "Excel 模式：直接在表格內編輯，可調整欄寬、合併儲存格"
                  : "可直接編輯下方內容，完成後點擊「列印 / 另存 PDF」"
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* 模式切換 */}
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={editorMode === "excel" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setEditorMode("excel")}
                  className="gap-1.5"
                >
                  <Table2 className="h-4 w-4" />
                  Excel 模式
                </Button>
                <Button
                  variant={editorMode === "preview" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setEditorMode("preview")}
                  className="gap-1.5"
                >
                  <FileEdit className="h-4 w-4" />
                  傳統模式
                </Button>
              </div>
              {/* 字體大小控制 - 僅傳統模式 */}
              {editorMode === "preview" && previewData && (
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                  <span className="text-sm text-muted-foreground">字體大小</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleFontSizeChange(-0.5)}
                    disabled={(previewData.fontSize || 9) <= 6}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-medium w-10 text-center">
                    {previewData.fontSize || 9}pt
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleFontSizeChange(0.5)}
                    disabled={(previewData.fontSize || 9) >= 12}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* 編輯區域 */}
        {editorMode === "excel" ? (
          <ExcelQuoteEditor 
            companyName={appSettings?.company_name_zh || "公司名稱"}
          />
        ) : (
          <>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
