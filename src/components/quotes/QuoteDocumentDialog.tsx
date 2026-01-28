/**
 * 報價單產出對話框
 * 提供 PDF 預覽、下載、列印功能
 */
import { useState, useEffect, useMemo } from "react";
import { PDFDownloadLink, PDFViewer, BlobProvider } from "@react-pdf/renderer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Download,
  Printer,
  FileText,
  Building2,
  User,
  Settings,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import QuoteDocumentPDF, {
  QuoteDocumentData,
  QuoteDocumentItem,
  PaymentTermItem,
} from "./QuoteDocumentPDF";
import { EngineeringCategory, ModuleItem, InverterItem } from "@/hooks/useQuoteEngineering";
import { formatCurrency } from "@/lib/quoteCalculations";

interface QuoteDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  // 從 QuoteWizard 傳入的資料
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

export default function QuoteDocumentDialog({
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
  const [activeTab, setActiveTab] = useState("edit");
  const [isPdfReady, setIsPdfReady] = useState(false);

  // 客戶資訊
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [siteAddress, setSiteAddress] = useState("");

  // 報價資訊
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [salespersonPhone, setSalespersonPhone] = useState("");

  // 付款條件
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermItem[]>(DEFAULT_PAYMENT_TERMS);

  // 條款
  const [terms, setTerms] = useState<string[]>(DEFAULT_TERMS);
  const [termsText, setTermsText] = useState(DEFAULT_TERMS.join("\n"));

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

  // 初始化資料
  useEffect(() => {
    if (investor) {
      setCustomerName(investor.company_name || "");
      setCustomerContact(investor.contact_person || "");
      setCustomerPhone(investor.phone || "");
    }
    if (project) {
      setSiteAddress(project.address || "");
    }
    if (quote) {
      setQuoteNumber(quote.quote_number || "");
      if (quote.valid_until) {
        setValidUntil(quote.valid_until);
      }
    }
  }, [investor, project, quote]);

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
  const buildItems = useMemo((): QuoteDocumentItem[] => {
    const items: QuoteDocumentItem[] = [];
    let orderNum = 1;

    // 模組
    modules.forEach((m, idx) => {
      items.push({
        order: orderNum++,
        category: "equipment",
        categoryName: idx === 0 ? "太陽光電模組" : undefined,
        name: "太陽光電模組",
        spec: m.moduleModel || `${m.wattagePerPanel}W 單晶矽模組`,
        quantity: m.panelCount,
        unit: "PCS",
      });
    });

    // 逆變器
    inverters.forEach((inv, idx) => {
      items.push({
        order: orderNum++,
        category: "equipment",
        categoryName: undefined,
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
          categoryName: firstInCategory ? cat.categoryName : undefined,
          name: item.itemName,
          spec: item.note || "",
          quantity: item.billingMethod === "per_kw" 
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
    return paymentTerms.map((term) => ({
      ...term,
      amount: calculateTotals.total * (term.percentage / 100),
    }));
  }, [paymentTerms, calculateTotals.total]);

  // 建構 PDF 資料
  const pdfData: QuoteDocumentData = useMemo(() => ({
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
      name: customerName,
      contact: customerContact,
      phone: customerPhone,
      siteAddress: siteAddress,
    },
    quote: {
      number: quoteNumber,
      date: quoteDate,
      validUntil: validUntil,
      salesperson: salesperson,
      salespersonPhone: salespersonPhone,
      capacityKwp: formData.capacityKwp,
    },
    items: buildItems,
    summary: calculateTotals,
    paymentTerms: paymentTermsWithAmount,
    terms: termsText.split("\n").filter((t) => t.trim()),
  }), [
    appSettings,
    customerName,
    customerContact,
    customerPhone,
    siteAddress,
    quoteNumber,
    quoteDate,
    validUntil,
    salesperson,
    salespersonPhone,
    formData.capacityKwp,
    buildItems,
    calculateTotals,
    paymentTermsWithAmount,
    termsText,
  ]);

  // 處理列印
  const handlePrint = (blob: Blob | null) => {
    if (!blob) {
      toast.error("PDF 尚未準備完成");
      return;
    }
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url);
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            產出報價單
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-2 w-80 flex-shrink-0">
            <TabsTrigger value="edit" className="gap-2">
              <Settings className="h-4 w-4" />
              編輯內容
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              預覽 PDF
            </TabsTrigger>
          </TabsList>

          {/* 編輯內容 */}
          <TabsContent value="edit" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6 py-4">
                {/* 客戶資訊 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      客戶資訊
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>客戶名稱</Label>
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="公司名稱"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>聯絡人</Label>
                      <Input
                        value={customerContact}
                        onChange={(e) => setCustomerContact(e.target.value)}
                        placeholder="聯絡人姓名"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>聯絡電話</Label>
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="電話號碼"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>案場地點</Label>
                      <Input
                        value={siteAddress}
                        onChange={(e) => setSiteAddress(e.target.value)}
                        placeholder="案場地址"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* 報價資訊 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      報價資訊
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>報價單號</Label>
                      <Input
                        value={quoteNumber}
                        onChange={(e) => setQuoteNumber(e.target.value)}
                        placeholder="Q20260128-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>報價日期</Label>
                      <Input
                        type="date"
                        value={quoteDate}
                        onChange={(e) => setQuoteDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>有效日期</Label>
                      <Input
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>業務員</Label>
                      <Input
                        value={salesperson}
                        onChange={(e) => setSalesperson(e.target.value)}
                        placeholder="業務員姓名"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>業務分機</Label>
                      <Input
                        value={salespersonPhone}
                        onChange={(e) => setSalespersonPhone(e.target.value)}
                        placeholder="分機號碼"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>裝置容量</Label>
                      <Input
                        value={`${formData.capacityKwp} kW`}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* 金額摘要 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">金額摘要</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">合計(未稅)</span>
                        <p className="font-bold">{formatCurrency(calculateTotals.subtotal, 0)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">稅金</span>
                        <p className="font-bold">{formatCurrency(calculateTotals.tax, 0)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">總計</span>
                        <p className="font-bold text-primary">{formatCurrency(calculateTotals.total, 0)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">每kW(未稅)</span>
                        <p className="font-bold">{formatCurrency(calculateTotals.pricePerKwpExcludingTax, 0)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">每kW(含稅)</span>
                        <p className="font-bold">{formatCurrency(calculateTotals.pricePerKwpIncludingTax, 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 條款說明 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">條款說明</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={termsText}
                      onChange={(e) => setTermsText(e.target.value)}
                      rows={6}
                      placeholder="每行一個條款..."
                    />
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* PDF 預覽 */}
          <TabsContent value="preview" className="flex-1 overflow-hidden flex flex-col mt-4 min-h-0">
            <div className="flex-1 border rounded-lg overflow-hidden bg-muted min-h-[400px]">
              <PDFViewer width="100%" height="100%" style={{ border: 'none' }}>
                <QuoteDocumentPDF data={pdfData} />
              </PDFViewer>
            </div>
          </TabsContent>
        </Tabs>

        {/* 底部操作按鈕 */}
        <Separator className="mt-4 mb-4 flex-shrink-0" />
        <div className="flex justify-between items-center flex-shrink-0">
          <div className="text-sm text-muted-foreground">
            共 {buildItems.length} 個項目
          </div>
          <div className="flex gap-2">
            <BlobProvider document={<QuoteDocumentPDF data={pdfData} />}>
              {({ blob, loading }) => (
                <Button
                  variant="outline"
                  disabled={loading || !blob}
                  onClick={() => handlePrint(blob)}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4 mr-2" />
                  )}
                  列印
                </Button>
              )}
            </BlobProvider>
            <PDFDownloadLink
              document={<QuoteDocumentPDF data={pdfData} />}
              fileName={`報價單_${quoteNumber || "draft"}_${quoteDate}.pdf`}
            >
              {({ loading }) => (
                <Button disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  下載 PDF
                </Button>
              )}
            </PDFDownloadLink>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
