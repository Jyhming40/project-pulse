import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  FileDown,
  Import,
  Printer,
  ChevronDown,
  ChevronUp,
  GripVertical,
  MoreVertical,
  FileText,
} from "lucide-react";
import { formatCurrency } from "@/lib/quoteCalculations";
import { EngineeringCategory, EngineeringItem, ModuleItem, InverterItem } from "@/hooks/useQuoteEngineering";

// 報價單項目結構
export interface QuotationSubItem {
  id: string;
  specLine: string; // 規格行
}

export interface QuotationItem {
  id: string;
  itemNo: number; // 項次
  productName: string; // 品名（大項目）
  specifications: QuotationSubItem[]; // 規格（小項目）
  quantity: string; // 數量
  unit: string; // 單位
}

interface QuotationOutputEditorProps {
  // 基本資訊
  customerName?: string;
  contactPerson?: string;
  contactPhone?: string;
  siteLocation?: string;
  salesPerson?: string;
  salesPhone?: string;
  capacityKwp: number;
  // 報價金額
  pricePerKwp: number;
  taxRate: number;
  // 成本資料 - 用於導入
  categories: EngineeringCategory[];
  modules: ModuleItem[];
  inverters: InverterItem[];
  // 儲存回調
  onSave?: (items: QuotationItem[], headerInfo: QuotationHeaderInfo) => void;
}

export interface QuotationHeaderInfo {
  customerName: string;
  contactPerson: string;
  contactPhone: string;
  siteLocation: string;
  salesPerson: string;
  salesPhone: string;
  quoteDate: string;
  validUntil: string;
  notes: string;
}

// 生成唯一ID
const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 預設報價單範本
const createDefaultTemplate = (
  capacityKwp: number,
  modules: ModuleItem[],
  inverters: InverterItem[],
  categories: EngineeringCategory[]
): QuotationItem[] => {
  const items: QuotationItem[] = [];
  let itemNo = 1;

  // 1. 太陽能光電模組
  if (modules.length > 0) {
    const moduleSpecs = modules.map(m => 
      `${m.moduleModel || '高效單晶矽模組'}，${m.wattagePerPanel}Wp`
    );
    items.push({
      id: generateId(),
      itemNo: itemNo++,
      productName: "太陽能光電模組",
      specifications: moduleSpecs.map(spec => ({ id: generateId(), specLine: spec })),
      quantity: modules.reduce((sum, m) => sum + m.panelCount, 0).toString(),
      unit: "PCS",
    });
  }

  // 2. 太陽能逆變器
  if (inverters.length > 0) {
    const inverterSpecs = inverters.map(inv => 
      `${inv.inverterModel || '三相逆變器'}，${inv.capacityKw}kW`
    );
    items.push({
      id: generateId(),
      itemNo: itemNo++,
      productName: "太陽能逆變器",
      specifications: inverterSpecs.map(spec => ({ id: generateId(), specLine: spec })),
      quantity: inverters.reduce((sum, inv) => sum + inv.inverterCount, 0).toString(),
      unit: "PCS",
    });
  }

  // 3. 從工程分類導入
  categories.forEach(cat => {
    // 將工程項目合併為規格描述
    const specs = cat.items
      .filter(item => item.specDescription || item.itemName)
      .flatMap(item => {
        if (item.specDescription) {
          // 多行規格描述拆分
          return item.specDescription.split('\n').filter(s => s.trim());
        }
        return [item.itemName];
      })
      .map(spec => ({ id: generateId(), specLine: `●${spec}` }));

    if (specs.length > 0) {
      items.push({
        id: generateId(),
        itemNo: itemNo++,
        productName: cat.categoryName,
        specifications: specs,
        quantity: capacityKwp.toString(),
        unit: "kW",
      });
    }
  });

  return items;
};

export default function QuotationOutputEditor({
  customerName = "",
  contactPerson = "",
  contactPhone = "",
  siteLocation = "",
  salesPerson = "",
  salesPhone = "",
  capacityKwp,
  pricePerKwp,
  taxRate,
  categories,
  modules,
  inverters,
  onSave,
}: QuotationOutputEditorProps) {
  // 報價單表頭資訊
  const [headerInfo, setHeaderInfo] = useState<QuotationHeaderInfo>({
    customerName,
    contactPerson,
    contactPhone,
    siteLocation,
    salesPerson,
    salesPhone,
    quoteDate: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: "1、相關規格以台電審迄圖為主\n2、未經同意任意變更交易內容及方式，本公司有權請求賠償。\n3、本報價單未含新設低壓外線費用及台電衍生費用如新設引接",
  });

  // 報價單項目
  const [items, setItems] = useState<QuotationItem[]>([]);
  
  // 展開/收合狀態
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // 初始化時從範本載入
  useEffect(() => {
    if (items.length === 0) {
      const template = createDefaultTemplate(capacityKwp, modules, inverters, categories);
      setItems(template);
      // 預設全部展開
      setExpandedItems(new Set(template.map(i => i.id)));
    }
  }, []);

  // 計算金額
  const totals = useMemo(() => {
    const subtotal = capacityKwp * pricePerKwp;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    const perKwpWithTax = total / capacityKwp;
    return { subtotal, tax, total, perKwpWithTax };
  }, [capacityKwp, pricePerKwp, taxRate]);

  // 新增大項目
  const handleAddItem = () => {
    const newItem: QuotationItem = {
      id: generateId(),
      itemNo: items.length + 1,
      productName: "新項目",
      specifications: [],
      quantity: "1",
      unit: "式",
    };
    setItems([...items, newItem]);
    setExpandedItems(prev => new Set([...prev, newItem.id]));
  };

  // 刪除大項目
  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id).map((item, idx) => ({
      ...item,
      itemNo: idx + 1,
    })));
  };

  // 更新大項目
  const handleUpdateItem = (id: string, updates: Partial<QuotationItem>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  // 新增規格小項
  const handleAddSpec = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          specifications: [
            ...item.specifications,
            { id: generateId(), specLine: "●新規格項目" },
          ],
        };
      }
      return item;
    }));
  };

  // 刪除規格小項
  const handleDeleteSpec = (itemId: string, specId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          specifications: item.specifications.filter(s => s.id !== specId),
        };
      }
      return item;
    }));
  };

  // 更新規格小項
  const handleUpdateSpec = (itemId: string, specId: string, value: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          specifications: item.specifications.map(s =>
            s.id === specId ? { ...s, specLine: value } : s
          ),
        };
      }
      return item;
    }));
  };

  // 切換展開狀態
  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 從成本資料重新導入
  const handleImportFromCost = () => {
    const template = createDefaultTemplate(capacityKwp, modules, inverters, categories);
    setItems(template);
    setExpandedItems(new Set(template.map(i => i.id)));
  };

  // 列印報價單
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = generatePrintHTML();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  // 生成列印用 HTML
  const generatePrintHTML = () => {
    // 合併規格為單一儲存格內容
    const tableRows = items.map(item => {
      const specsHtml = item.specifications.map(s => s.specLine).join('<br/>');
      return `
        <tr>
          <td class="item-no">${item.itemNo}</td>
          <td class="product-name">${item.productName}</td>
          <td class="spec">${specsHtml}</td>
          <td class="quantity">${item.quantity}</td>
          <td class="unit">${item.unit}</td>
        </tr>
      `;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>報價單 - ${headerInfo.customerName}</title>
  <style>
    @page { 
      size: A4 portrait; 
      margin: 12mm 15mm; 
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Microsoft JhengHei', 'Noto Sans TC', 'Helvetica Neue', sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #1a1a1a;
    }
    .page {
      max-width: 180mm;
      margin: 0 auto;
    }
    
    /* Header */
    .header {
      text-align: center;
      padding: 15px 0 12px;
      border-bottom: 3px double #333;
      margin-bottom: 15px;
    }
    .company-name {
      font-size: 16pt;
      font-weight: bold;
      color: #1a365d;
      letter-spacing: 2px;
      margin-bottom: 5px;
    }
    .title {
      font-size: 22pt;
      font-weight: bold;
      letter-spacing: 12px;
      color: #2d3748;
    }
    
    /* Info Section */
    .info-section {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 15px;
    }
    .info-block {
      flex: 1;
    }
    .info-row {
      display: flex;
      border-bottom: 1px solid #e2e8f0;
      padding: 4px 0;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      width: 70px;
      font-weight: 600;
      color: #4a5568;
      font-size: 9pt;
    }
    .info-value {
      flex: 1;
      font-size: 9pt;
    }
    .info-full {
      background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .capacity-label {
      font-weight: 600;
      color: #2d3748;
    }
    .capacity-value {
      font-size: 14pt;
      font-weight: bold;
      color: #2b6cb0;
    }
    
    /* Quote Table */
    .quote-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 9pt;
    }
    .quote-table thead th {
      background: linear-gradient(180deg, #2d3748 0%, #1a202c 100%);
      color: #fff;
      padding: 8px 10px;
      text-align: center;
      font-weight: 600;
      font-size: 10pt;
      border: 1px solid #1a202c;
    }
    .quote-table tbody td {
      border: 1px solid #cbd5e0;
      padding: 6px 8px;
      vertical-align: top;
    }
    .quote-table tbody tr:nth-child(even) {
      background-color: #f7fafc;
    }
    .quote-table tbody tr:hover {
      background-color: #edf2f7;
    }
    .quote-table .item-no {
      text-align: center;
      width: 35px;
      font-weight: 600;
      color: #2b6cb0;
    }
    .quote-table .product-name {
      width: 100px;
      font-weight: 600;
      color: #2d3748;
    }
    .quote-table .spec {
      line-height: 1.5;
      color: #4a5568;
    }
    .quote-table .quantity {
      text-align: right;
      width: 50px;
      font-family: 'Consolas', 'Monaco', monospace;
    }
    .quote-table .unit {
      text-align: center;
      width: 45px;
    }
    
    /* Bottom Section */
    .bottom-section {
      display: flex;
      gap: 15px;
      margin-bottom: 15px;
    }
    .notes-box {
      flex: 1;
      border: 1px solid #cbd5e0;
      border-radius: 4px;
      padding: 10px 12px;
      background: #fffbeb;
    }
    .notes-title {
      font-weight: 600;
      font-size: 9pt;
      color: #744210;
      margin-bottom: 5px;
      border-bottom: 1px solid #f6e05e;
      padding-bottom: 3px;
    }
    .notes-content {
      font-size: 8pt;
      line-height: 1.5;
      color: #744210;
      white-space: pre-line;
    }
    
    /* Totals */
    .totals-box {
      width: 200px;
      flex-shrink: 0;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 5px 10px;
      border: 1px solid #cbd5e0;
      font-size: 9pt;
    }
    .totals-table .label {
      background: #edf2f7;
      text-align: right;
      font-weight: 500;
      color: #4a5568;
    }
    .totals-table .value {
      text-align: right;
      font-family: 'Consolas', 'Monaco', monospace;
      font-weight: 600;
    }
    .totals-table tr.total-row td {
      background: linear-gradient(135deg, #2b6cb0 0%, #2c5282 100%);
      color: #fff;
      font-size: 11pt;
      font-weight: bold;
    }
    .totals-table tr.total-row .label {
      background: linear-gradient(135deg, #2b6cb0 0%, #2c5282 100%);
      color: #fff;
    }
    
    /* Footer Signatures */
    .signature-section {
      display: flex;
      justify-content: space-between;
      gap: 30px;
      margin-top: 20px;
    }
    .signature-box {
      flex: 1;
      border: 1px solid #cbd5e0;
      border-radius: 4px;
      padding: 10px 15px;
      min-height: 60px;
    }
    .signature-title {
      font-weight: 600;
      font-size: 9pt;
      color: #2d3748;
      border-bottom: 1px dashed #a0aec0;
      padding-bottom: 5px;
      margin-bottom: 35px;
    }
    .signature-line {
      border-top: 1px solid #2d3748;
      margin-top: 10px;
      padding-top: 3px;
      font-size: 8pt;
      color: #718096;
      text-align: center;
    }
    
    /* Print Styles */
    @media print {
      body { 
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .quote-table thead th {
        background: #2d3748 !important;
        color: #fff !important;
      }
      .totals-table tr.total-row td,
      .totals-table tr.total-row .label {
        background: #2b6cb0 !important;
        color: #fff !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="company-name">明群環能科技有限公司</div>
      <div class="title">報 價 單</div>
    </div>
    
    <div class="info-section">
      <div class="info-block">
        <div class="info-row">
          <span class="info-label">客戶名稱</span>
          <span class="info-value">${headerInfo.customerName || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">聯 絡 人</span>
          <span class="info-value">${headerInfo.contactPerson || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">聯絡電話</span>
          <span class="info-value">${headerInfo.contactPhone || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">案場地點</span>
          <span class="info-value">${headerInfo.siteLocation || '-'}</span>
        </div>
      </div>
      <div class="info-block">
        <div class="info-row">
          <span class="info-label">報價日期</span>
          <span class="info-value">${headerInfo.quoteDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">有效期限</span>
          <span class="info-value">${headerInfo.validUntil}</span>
        </div>
        <div class="info-row">
          <span class="info-label">業 務 員</span>
          <span class="info-value">${headerInfo.salesPerson || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">業務分機</span>
          <span class="info-value">${headerInfo.salesPhone || '-'}</span>
        </div>
      </div>
    </div>
    
    <div class="info-full">
      <span class="capacity-label">裝置容量</span>
      <span class="capacity-value">${capacityKwp} kW</span>
    </div>
    
    <table class="quote-table">
      <thead>
        <tr>
          <th>項次</th>
          <th>品 名</th>
          <th>規 格</th>
          <th>數量</th>
          <th>單位</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    
    <div class="bottom-section">
      <div class="notes-box">
        <div class="notes-title">📋 備註說明</div>
        <div class="notes-content">${headerInfo.notes}</div>
      </div>
      <div class="totals-box">
        <table class="totals-table">
          <tr>
            <td class="label">合計(未稅)</td>
            <td class="value">$${totals.subtotal.toLocaleString()}</td>
          </tr>
          <tr>
            <td class="label">稅金(${(taxRate * 100).toFixed(0)}%)</td>
            <td class="value">$${totals.tax.toLocaleString()}</td>
          </tr>
          <tr class="total-row">
            <td class="label">總 計</td>
            <td class="value">$${totals.total.toLocaleString()}</td>
          </tr>
          <tr>
            <td class="label">每kWp(未稅)</td>
            <td class="value">$${pricePerKwp.toLocaleString()}</td>
          </tr>
          <tr>
            <td class="label">每kWp(含稅)</td>
            <td class="value">$${Math.round(totals.perKwpWithTax).toLocaleString()}</td>
          </tr>
        </table>
      </div>
    </div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-title">客戶回簽欄</div>
        <div class="signature-line">簽名 / 蓋章</div>
      </div>
      <div class="signature-box">
        <div class="signature-title">明群環能科技有限公司</div>
        <div class="signature-line">業務代表簽章</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  };

  return (
    <div className="space-y-4">
      {/* 表頭資訊 */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            報價單資訊
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">客戶名稱</label>
              <Input
                value={headerInfo.customerName}
                onChange={(e) => setHeaderInfo(prev => ({ ...prev, customerName: e.target.value }))}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">聯絡人</label>
              <Input
                value={headerInfo.contactPerson}
                onChange={(e) => setHeaderInfo(prev => ({ ...prev, contactPerson: e.target.value }))}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">聯絡電話</label>
              <Input
                value={headerInfo.contactPhone}
                onChange={(e) => setHeaderInfo(prev => ({ ...prev, contactPhone: e.target.value }))}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">案場地點</label>
              <Input
                value={headerInfo.siteLocation}
                onChange={(e) => setHeaderInfo(prev => ({ ...prev, siteLocation: e.target.value }))}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">業務員</label>
              <Input
                value={headerInfo.salesPerson}
                onChange={(e) => setHeaderInfo(prev => ({ ...prev, salesPerson: e.target.value }))}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">業務分機</label>
              <Input
                value={headerInfo.salesPhone}
                onChange={(e) => setHeaderInfo(prev => ({ ...prev, salesPhone: e.target.value }))}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">報價日期</label>
              <Input
                type="date"
                value={headerInfo.quoteDate}
                onChange={(e) => setHeaderInfo(prev => ({ ...prev, quoteDate: e.target.value }))}
                className="h-8 mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">有效日期</label>
              <Input
                type="date"
                value={headerInfo.validUntil}
                onChange={(e) => setHeaderInfo(prev => ({ ...prev, validUntil: e.target.value }))}
                className="h-8 mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 工具列 */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">報價單項目</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImportFromCost}>
            <Import className="h-4 w-4 mr-1.5" />
            從成本導入
          </Button>
          <Button variant="outline" size="sm" onClick={handleAddItem}>
            <Plus className="h-4 w-4 mr-1.5" />
            新增項目
          </Button>
          <Button variant="default" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" />
            列印報價單
          </Button>
        </div>
      </div>

      {/* 報價單項目編輯表格 */}
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">項次</TableHead>
                <TableHead className="w-[150px]">品名</TableHead>
                <TableHead>規格</TableHead>
                <TableHead className="w-[120px]">數量</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isExpanded = expandedItems.has(item.id);
                return (
                  <>
                    {/* 大項目行 */}
                    <TableRow key={item.id} className="bg-muted/30">
                      <TableCell className="text-center font-medium">
                        {item.itemNo}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.productName}
                          onChange={(e) => handleUpdateItem(item.id, { productName: e.target.value })}
                          className="h-8 font-medium"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(item.id)}
                            className="h-6 px-2"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span className="text-xs text-muted-foreground ml-1">
                              {item.specifications.length} 項規格
                            </span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddSpec(item.id)}
                            className="h-6 px-2 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            新增規格
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, { quantity: e.target.value })}
                            className="h-8 w-16 text-right"
                          />
                          <Input
                            value={item.unit}
                            onChange={(e) => handleUpdateItem(item.id, { unit: e.target.value })}
                            className="h-8 w-14 text-center"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {/* 規格小項行 */}
                    {isExpanded && item.specifications.map((spec, specIdx) => (
                      <TableRow key={spec.id} className="border-l-4 border-l-primary/20">
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell>
                          <Input
                            value={spec.specLine}
                            onChange={(e) => handleUpdateSpec(item.id, spec.id, e.target.value)}
                            className="h-7 text-sm"
                            placeholder="輸入規格描述"
                          />
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteSpec(item.id, spec.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-semibold">
                  合計(未稅)
                </TableCell>
                <TableCell colSpan={2} className="font-mono font-bold text-right">
                  {formatCurrency(totals.subtotal, 0)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-semibold">
                  稅金 ({(taxRate * 100).toFixed(0)}%)
                </TableCell>
                <TableCell colSpan={2} className="font-mono font-bold text-right">
                  {formatCurrency(totals.tax, 0)}
                </TableCell>
              </TableRow>
              <TableRow className="bg-primary/5">
                <TableCell colSpan={3} className="text-right font-semibold">
                  總計
                </TableCell>
                <TableCell colSpan={2} className="font-mono font-bold text-lg text-right text-primary">
                  {formatCurrency(totals.total, 0)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* 備註 */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold">備註說明</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Textarea
            value={headerInfo.notes}
            onChange={(e) => setHeaderInfo(prev => ({ ...prev, notes: e.target.value }))}
            rows={4}
            placeholder="輸入備註說明..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
