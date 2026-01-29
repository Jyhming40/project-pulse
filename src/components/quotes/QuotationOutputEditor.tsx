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
    const tableRows = items.map(item => {
      const firstSpec = item.specifications[0]?.specLine || "";
      const otherSpecs = item.specifications.slice(1);
      
      let rows = `
        <tr>
          <td class="item-no">${item.itemNo}</td>
          <td class="product-name">${item.productName}</td>
          <td class="spec">${firstSpec}</td>
          <td class="quantity">${item.quantity} ${item.unit}</td>
        </tr>
      `;
      
      otherSpecs.forEach(spec => {
        rows += `
          <tr>
            <td class="item-no"></td>
            <td class="product-name"></td>
            <td class="spec">${spec.specLine}</td>
            <td class="quantity"></td>
          </tr>
        `;
      });
      
      return rows;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>報價單</title>
  <style>
    @page { 
      size: A4 portrait; 
      margin: 10mm 12mm; 
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      min-height: 297mm;
      max-height: 297mm;
      overflow: hidden;
      font-family: 'Microsoft JhengHei', 'Noto Sans TC', sans-serif;
      font-size: 9pt;
      line-height: 1.3;
    }
    .page {
      width: 100%;
      height: 277mm; /* A4 height minus margins */
      display: flex;
      flex-direction: column;
      page-break-after: avoid;
      page-break-inside: avoid;
    }
    .header {
      text-align: center;
      margin-bottom: 8px;
      flex-shrink: 0;
    }
    .company-name {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 3px;
    }
    .title {
      font-size: 16pt;
      font-weight: bold;
      letter-spacing: 8px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      flex-shrink: 0;
    }
    .info-table td {
      padding: 3px 6px;
      border: 1px solid #999;
      font-size: 8pt;
    }
    .info-table .label {
      background-color: #f0f0f0;
      width: 80px;
      font-weight: 500;
    }
    .quote-table-wrapper {
      flex: 1;
      overflow: hidden;
    }
    .quote-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
    }
    .quote-table th {
      background-color: #e8e8e8;
      border: 1px solid #333;
      padding: 4px 6px;
      text-align: center;
      font-weight: bold;
      font-size: 9pt;
    }
    .quote-table td {
      border: 1px solid #333;
      padding: 2px 5px;
      vertical-align: top;
      line-height: 1.25;
    }
    .quote-table .item-no {
      text-align: center;
      width: 28px;
      font-weight: 500;
    }
    .quote-table .product-name {
      width: 90px;
      font-weight: 500;
    }
    .quote-table .spec {
      font-size: 7.5pt;
    }
    .quote-table .quantity {
      text-align: center;
      width: 60px;
      white-space: nowrap;
    }
    .bottom-section {
      flex-shrink: 0;
      margin-top: auto;
    }
    .totals-notes {
      display: flex;
      gap: 10px;
      margin-top: 6px;
    }
    .notes {
      flex: 1;
      padding: 5px 8px;
      border: 1px solid #999;
      font-size: 7.5pt;
      white-space: pre-line;
      line-height: 1.3;
    }
    .totals {
      flex-shrink: 0;
    }
    .totals table {
      border-collapse: collapse;
    }
    .totals td {
      padding: 2px 10px;
      border: 1px solid #999;
      font-size: 8pt;
    }
    .totals .label {
      background-color: #f0f0f0;
      text-align: right;
    }
    .totals .value {
      font-weight: bold;
      text-align: right;
      font-family: 'Consolas', monospace;
      min-width: 80px;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      margin-top: 10px;
    }
    .signature-box {
      flex: 1;
      border: 1px solid #999;
      padding: 6px 10px;
      min-height: 50px;
    }
    .signature-title {
      font-weight: bold;
      font-size: 8pt;
      margin-bottom: 30px;
    }
    @media print {
      body { 
        width: 210mm; 
        height: 297mm; 
      }
      .page {
        height: 277mm;
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
    
    <table class="info-table">
      <tr>
        <td class="label">客戶名稱</td>
        <td>${headerInfo.customerName}</td>
        <td class="label">報價日期</td>
        <td>${headerInfo.quoteDate}</td>
      </tr>
      <tr>
        <td class="label">聯絡人</td>
        <td>${headerInfo.contactPerson}</td>
        <td class="label">有效日期</td>
        <td>${headerInfo.validUntil}</td>
      </tr>
      <tr>
        <td class="label">聯絡電話</td>
        <td>${headerInfo.contactPhone}</td>
        <td class="label">業務員</td>
        <td>${headerInfo.salesPerson}</td>
      </tr>
      <tr>
        <td class="label">案場地點</td>
        <td>${headerInfo.siteLocation}</td>
        <td class="label">業務分機</td>
        <td>${headerInfo.salesPhone}</td>
      </tr>
      <tr>
        <td class="label">裝置容量</td>
        <td colspan="3">${capacityKwp} kW</td>
      </tr>
    </table>
    
    <div class="quote-table-wrapper">
      <table class="quote-table">
        <thead>
          <tr>
            <th>項次</th>
            <th>品 名</th>
            <th>規 格</th>
            <th>數量</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
    
    <div class="bottom-section">
      <div class="totals-notes">
        <div class="notes">${headerInfo.notes}</div>
        <div class="totals">
          <table>
            <tr>
              <td class="label">合計(未稅)</td>
              <td class="value">$${totals.subtotal.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="label">稅金(${(taxRate * 100).toFixed(0)}%)</td>
              <td class="value">$${totals.tax.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="label">總計</td>
              <td class="value" style="font-size:10pt;">$${totals.total.toLocaleString()}</td>
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
      
      <div class="footer">
        <div class="signature-box">
          <div class="signature-title">客戶回簽欄(簽名或蓋章)</div>
        </div>
        <div class="signature-box">
          <div class="signature-title">明群環能科技有限公司</div>
        </div>
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
