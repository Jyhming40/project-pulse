/**
 * 報價單 HTML 預覽元件 - 專業版面設計
 * 可編輯的報價單預覽，支援瀏覽器列印/另存 PDF
 */
import { forwardRef } from "react";
import { formatCurrency } from "@/lib/quoteCalculations";

interface PaymentTermItem {
  name: string;
  percentage: number;
  condition?: string;
  amount?: number;
}

interface QuoteItem {
  order: number;
  category: string;
  categoryName?: string;
  name: string;
  spec: string;
  quantity: number | string;
  unit: string;
}

interface QuotePreviewData {
  company: {
    name: string;
    address: string;
    phone: string;
    taxId: string;
    bankName?: string;
    bankBranch?: string;
    bankCode?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
  };
  customer: {
    name: string;
    contact: string;
    phone: string;
    siteAddress: string;
  };
  quote: {
    number: string;
    date: string;
    validUntil: string;
    salesperson: string;
    salespersonPhone: string;
    capacityKwp: number;
  };
  items: QuoteItem[];
  summary: {
    subtotal: number;
    tax: number;
    total: number;
    pricePerKwpExcludingTax: number;
    pricePerKwpIncludingTax: number;
  };
  paymentTerms: PaymentTermItem[];
  terms: string[];
}

interface QuoteDocumentPreviewProps {
  data: QuotePreviewData;
  onDataChange: (data: QuotePreviewData) => void;
}

const QuoteDocumentPreview = forwardRef<HTMLDivElement, QuoteDocumentPreviewProps>(
  ({ data, onDataChange }, ref) => {
    const updateCustomer = (field: keyof QuotePreviewData["customer"], value: string) => {
      onDataChange({
        ...data,
        customer: { ...data.customer, [field]: value },
      });
    };

    const updateQuote = (field: keyof QuotePreviewData["quote"], value: string | number) => {
      onDataChange({
        ...data,
        quote: { ...data.quote, [field]: value },
      });
    };

    const updateTerm = (index: number, value: string) => {
      const newTerms = [...data.terms];
      newTerms[index] = value;
      onDataChange({ ...data, terms: newTerms });
    };

    const addTerm = () => {
      onDataChange({ ...data, terms: [...data.terms, ""] });
    };

    const removeTerm = (index: number) => {
      onDataChange({ ...data, terms: data.terms.filter((_, i) => i !== index) });
    };

    const updateItem = (index: number, field: keyof QuoteItem, value: string | number) => {
      const newItems = [...data.items];
      newItems[index] = { ...newItems[index], [field]: value };
      onDataChange({ ...data, items: newItems });
    };

    const removeItem = (index: number) => {
      const newItems = data.items.filter((_, i) => i !== index);
      newItems.forEach((item, i) => {
        item.order = i + 1;
      });
      onDataChange({ ...data, items: newItems });
    };

    const addItem = () => {
      const newItem: QuoteItem = {
        order: data.items.length + 1,
        category: "custom",
        name: "",
        spec: "",
        quantity: 1,
        unit: "式",
      };
      onDataChange({ ...data, items: [...data.items, newItem] });
    };

    return (
      <div
        ref={ref}
        className="bg-white text-gray-900 shadow-xl mx-auto"
        style={{
          fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', sans-serif",
          width: "210mm",
          minHeight: "297mm",
          padding: "20mm",
        }}
      >
        {/* 文件標頭 - 雙線設計 */}
        <div className="border-b-4 border-double border-gray-800 pb-6 mb-6">
          {/* 公司名稱與報價單標題 */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold tracking-wide text-gray-800">
                {data.company.name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">{data.company.address}</p>
              <p className="text-sm text-gray-600">
                Tel: {data.company.phone} ｜ 統編: {data.company.taxId}
              </p>
            </div>
            <div className="text-right">
              <h1 className="text-4xl font-black tracking-widest text-gray-900 border-b-2 border-gray-800 pb-2 mb-2">
                報 價 單
              </h1>
              <p className="text-lg font-medium text-gray-700">QUOTATION</p>
            </div>
          </div>
        </div>

        {/* 報價資訊區塊 */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          {/* 客戶資訊 */}
          <div className="border border-gray-300 rounded-lg p-4 bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-200 pb-2">
              客戶資訊 Customer Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex">
                <span className="w-20 text-gray-500 flex-shrink-0">客戶名稱</span>
                <input
                  type="text"
                  value={data.customer.name}
                  onChange={(e) => updateCustomer("name", e.target.value)}
                  className="flex-1 border-b border-dashed border-gray-300 bg-transparent px-2 py-0.5 focus:border-blue-500 focus:outline-none font-medium"
                  placeholder="請輸入客戶名稱"
                />
              </div>
              <div className="flex">
                <span className="w-20 text-gray-500 flex-shrink-0">聯 絡 人</span>
                <input
                  type="text"
                  value={data.customer.contact}
                  onChange={(e) => updateCustomer("contact", e.target.value)}
                  className="flex-1 border-b border-dashed border-gray-300 bg-transparent px-2 py-0.5 focus:border-blue-500 focus:outline-none"
                  placeholder="聯絡人姓名"
                />
              </div>
              <div className="flex">
                <span className="w-20 text-gray-500 flex-shrink-0">聯絡電話</span>
                <input
                  type="text"
                  value={data.customer.phone}
                  onChange={(e) => updateCustomer("phone", e.target.value)}
                  className="flex-1 border-b border-dashed border-gray-300 bg-transparent px-2 py-0.5 focus:border-blue-500 focus:outline-none"
                  placeholder="電話號碼"
                />
              </div>
              <div className="flex">
                <span className="w-20 text-gray-500 flex-shrink-0">案場地址</span>
                <input
                  type="text"
                  value={data.customer.siteAddress}
                  onChange={(e) => updateCustomer("siteAddress", e.target.value)}
                  className="flex-1 border-b border-dashed border-gray-300 bg-transparent px-2 py-0.5 focus:border-blue-500 focus:outline-none"
                  placeholder="案場地址"
                />
              </div>
            </div>
          </div>

          {/* 報價單資訊 */}
          <div className="border border-gray-300 rounded-lg p-4 bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 border-b border-gray-200 pb-2">
              報價資訊 Quote Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex">
                <span className="w-20 text-gray-500 flex-shrink-0">報價單號</span>
                <input
                  type="text"
                  value={data.quote.number}
                  onChange={(e) => updateQuote("number", e.target.value)}
                  className="flex-1 border-b border-dashed border-gray-300 bg-transparent px-2 py-0.5 focus:border-blue-500 focus:outline-none font-mono font-medium"
                  placeholder="報價單號"
                />
              </div>
              <div className="flex">
                <span className="w-20 text-gray-500 flex-shrink-0">報價日期</span>
                <input
                  type="date"
                  value={data.quote.date}
                  onChange={(e) => updateQuote("date", e.target.value)}
                  className="flex-1 border-b border-dashed border-gray-300 bg-transparent px-2 py-0.5 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex">
                <span className="w-20 text-gray-500 flex-shrink-0">有效期限</span>
                <input
                  type="date"
                  value={data.quote.validUntil}
                  onChange={(e) => updateQuote("validUntil", e.target.value)}
                  className="flex-1 border-b border-dashed border-gray-300 bg-transparent px-2 py-0.5 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex">
                <span className="w-20 text-gray-500 flex-shrink-0">業 務 員</span>
                <input
                  type="text"
                  value={data.quote.salesperson}
                  onChange={(e) => updateQuote("salesperson", e.target.value)}
                  className="flex-1 border-b border-dashed border-gray-300 bg-transparent px-2 py-0.5 focus:border-blue-500 focus:outline-none"
                  placeholder="業務員姓名"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 裝置容量醒目區塊 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-4 mb-6 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-blue-100 text-sm">太陽光電系統總裝置容量</p>
              <p className="text-3xl font-bold">{data.quote.capacityKwp.toFixed(2)} kWp</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm">每 kW 單價（含稅）</p>
            <p className="text-2xl font-bold">{formatCurrency(data.summary.pricePerKwpIncludingTax, 0)}</p>
          </div>
        </div>

        {/* 項目明細表格 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
            工程項目明細 Scope of Work
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="border border-gray-700 px-3 py-2 text-center w-12">項次</th>
                <th className="border border-gray-700 px-3 py-2 text-left">類別</th>
                <th className="border border-gray-700 px-3 py-2 text-left">項目名稱</th>
                <th className="border border-gray-700 px-3 py-2 text-left">規格說明</th>
                <th className="border border-gray-700 px-3 py-2 text-center w-24">數量</th>
                <th className="border border-gray-700 px-3 py-2 text-center w-16">單位</th>
                <th className="border border-gray-700 px-3 py-2 text-center w-14 no-print">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-600">
                    {item.order}
                  </td>
                  <td className="border border-gray-300 px-3 py-2">
                    {item.categoryName && (
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-medium">
                        {item.categoryName}
                      </span>
                    )}
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(index, "name", e.target.value)}
                      className="w-full bg-transparent px-2 py-1 focus:bg-blue-50 focus:outline-none rounded"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1">
                    <input
                      type="text"
                      value={item.spec}
                      onChange={(e) => updateItem(index, "spec", e.target.value)}
                      className="w-full bg-transparent px-2 py-1 focus:bg-blue-50 focus:outline-none rounded text-gray-600"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1 text-center">
                    <input
                      type="text"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      className="w-full bg-transparent px-2 py-1 text-center focus:bg-blue-50 focus:outline-none rounded"
                    />
                  </td>
                  <td className="border border-gray-300 px-1 py-1 text-center">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(index, "unit", e.target.value)}
                      className="w-full bg-transparent px-2 py-1 text-center focus:bg-blue-50 focus:outline-none rounded"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center no-print">
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded text-xs"
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={addItem}
            className="mt-2 text-blue-600 hover:text-blue-800 text-sm hover:bg-blue-50 px-3 py-1 rounded no-print"
          >
            + 新增項目
          </button>
        </div>

        {/* 金額摘要 */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="border-2 border-gray-800 rounded-lg overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-2">
              <h3 className="font-bold">金額摘要 Price Summary</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">合計（未稅）</span>
                <span className="font-medium">{formatCurrency(data.summary.subtotal, 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">營業稅 (5%)</span>
                <span className="font-medium">{formatCurrency(data.summary.tax, 0)}</span>
              </div>
              <div className="border-t-2 border-gray-800 pt-3 flex justify-between">
                <span className="text-lg font-bold">總計（含稅）</span>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(data.summary.total, 0)}
                </span>
              </div>
            </div>
          </div>

          {/* 單價資訊 */}
          <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
            <h3 className="font-bold text-gray-700 mb-3">單價參考 Unit Price Reference</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">每 kW 單價（未稅）</span>
                <span className="font-medium">{formatCurrency(data.summary.pricePerKwpExcludingTax, 0)} /kW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">每 kW 單價（含稅）</span>
                <span className="font-medium">{formatCurrency(data.summary.pricePerKwpIncludingTax, 0)} /kW</span>
              </div>
            </div>
          </div>
        </div>

        {/* 付款條件 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-green-600 rounded-full"></span>
            付款條件 Payment Terms
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-green-700 text-white">
                <th className="border border-green-800 px-3 py-2 text-left">期別</th>
                <th className="border border-green-800 px-3 py-2 text-center w-20">比例</th>
                <th className="border border-green-800 px-3 py-2 text-right w-32">金額</th>
                <th className="border border-green-800 px-3 py-2 text-left">付款條件</th>
              </tr>
            </thead>
            <tbody>
              {data.paymentTerms.map((term, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-green-50"}>
                  <td className="border border-gray-300 px-3 py-2 font-medium">{term.name}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">
                    <span className="inline-block bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium">
                      {term.percentage}%
                    </span>
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-medium">
                    {formatCurrency(term.amount || 0, 0)}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-gray-600">{term.condition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 條款說明 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
            條款說明 Terms & Conditions
          </h3>
          <div className="border border-gray-300 rounded-lg p-4 bg-amber-50/50">
            <ol className="space-y-2 text-sm">
              {data.terms.map((term, index) => (
                <li key={index} className="flex items-start gap-3 group">
                  <span className="flex-shrink-0 w-6 h-6 bg-amber-200 text-amber-800 rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => updateTerm(index, e.target.value)}
                    className="flex-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-amber-500 px-1 py-0.5 focus:outline-none"
                  />
                  <button
                    onClick={() => removeTerm(index)}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs px-2 py-0.5 rounded no-print transition-opacity"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
            <button
              onClick={addTerm}
              className="mt-3 text-amber-700 hover:text-amber-900 text-sm hover:bg-amber-100 px-3 py-1 rounded no-print"
            >
              + 新增條款
            </button>
          </div>
        </div>

        {/* 銀行資訊 */}
        {data.company.bankName && (
          <div className="mb-8 border border-gray-300 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
              <h3 className="font-bold text-gray-700 text-sm">匯款資訊 Bank Information</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex">
                <span className="w-20 text-gray-500">銀行名稱</span>
                <span className="font-medium">{data.company.bankName}</span>
              </div>
              <div className="flex">
                <span className="w-20 text-gray-500">分行名稱</span>
                <span className="font-medium">{data.company.bankBranch}</span>
              </div>
              <div className="flex">
                <span className="w-20 text-gray-500">銀行代碼</span>
                <span className="font-medium font-mono">{data.company.bankCode}</span>
              </div>
              <div className="flex">
                <span className="w-20 text-gray-500">帳號</span>
                <span className="font-medium font-mono">{data.company.bankAccountNumber}</span>
              </div>
              <div className="flex col-span-2">
                <span className="w-20 text-gray-500">戶名</span>
                <span className="font-medium">{data.company.bankAccountName}</span>
              </div>
            </div>
          </div>
        )}

        {/* 簽章區 */}
        <div className="border-t-2 border-gray-800 pt-6">
          <div className="grid grid-cols-2 gap-12">
            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">賣方（簽章）Seller</p>
              <div className="border-b-2 border-gray-400 h-20 flex items-end pb-2">
                <span className="text-gray-500">{data.company.name}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">日期 Date: _______________</p>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-600 mb-2">買方（簽章）Buyer</p>
              <div className="border-b-2 border-gray-400 h-20 flex items-end pb-2">
                <span className="text-gray-500">{data.customer.name || "________________"}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">日期 Date: _______________</p>
            </div>
          </div>
        </div>

        {/* 頁腳 */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>本報價單由 {data.company.name} 製作 ｜ 報價單號：{data.quote.number}</p>
        </div>
      </div>
    );
  }
);

QuoteDocumentPreview.displayName = "QuoteDocumentPreview";

export default QuoteDocumentPreview;
export type { QuotePreviewData, QuoteItem, PaymentTermItem };
