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

  // 列印功能
  const handlePrint = useCallback(() => {
    if (!previewRef.current) return;

    const printContent = previewRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=800,height=600");
    
    if (!printWindow) {
      toast.error("無法開啟列印視窗，請檢查瀏覽器設定");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>報價單 - ${previewData?.quote.number || "document"}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000;
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
          }
          .editable-cell { border: none !important; background: transparent !important; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #333; padding: 4px 8px; }
          th { background: #f0f0f0; }
        </style>
      </head>
      <body>${printContent}</body>
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
