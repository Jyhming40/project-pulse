/**
 * 報價單 HTML 預覽元件
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
      // 重新編號
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
        className="bg-white text-black p-8 max-w-[210mm] mx-auto print:p-0 print:max-w-none"
        style={{ fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', sans-serif" }}
      >
        {/* 列印樣式 */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .quote-preview-container, .quote-preview-container * { visibility: visible; }
            .quote-preview-container { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
            input, textarea { border: none !important; background: transparent !important; }
          }
          .editable-cell {
            border: 1px dashed #ccc;
            padding: 2px 4px;
            min-width: 50px;
            background: #fefefe;
          }
          .editable-cell:focus {
            border-color: #3b82f6;
            outline: none;
            background: #eff6ff;
          }
          @media print {
            .editable-cell { border: none; background: transparent; }
          }
        `}</style>

        <div className="quote-preview-container">
          {/* 標題區 */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">報 價 單</h1>
            <p className="text-lg font-semibold">{data.company.name}</p>
            <p className="text-sm text-gray-600">{data.company.address}</p>
            <p className="text-sm text-gray-600">
              電話：{data.company.phone} | 統編：{data.company.taxId}
            </p>
          </div>

          {/* 報價資訊 */}
          <div className="flex justify-between mb-6 text-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">客戶名稱：</span>
                <input
                  type="text"
                  value={data.customer.name}
                  onChange={(e) => updateCustomer("name", e.target.value)}
                  className="editable-cell"
                  placeholder="請輸入客戶名稱"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">聯 絡 人：</span>
                <input
                  type="text"
                  value={data.customer.contact}
                  onChange={(e) => updateCustomer("contact", e.target.value)}
                  className="editable-cell"
                  placeholder="聯絡人姓名"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">聯絡電話：</span>
                <input
                  type="text"
                  value={data.customer.phone}
                  onChange={(e) => updateCustomer("phone", e.target.value)}
                  className="editable-cell"
                  placeholder="電話號碼"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">案場地址：</span>
                <input
                  type="text"
                  value={data.customer.siteAddress}
                  onChange={(e) => updateCustomer("siteAddress", e.target.value)}
                  className="editable-cell w-64"
                  placeholder="案場地址"
                />
              </div>
            </div>
            <div className="space-y-1 text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="font-medium">報價單號：</span>
                <input
                  type="text"
                  value={data.quote.number}
                  onChange={(e) => updateQuote("number", e.target.value)}
                  className="editable-cell text-right"
                  placeholder="報價單號"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="font-medium">報價日期：</span>
                <input
                  type="date"
                  value={data.quote.date}
                  onChange={(e) => updateQuote("date", e.target.value)}
                  className="editable-cell text-right"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="font-medium">有效期限：</span>
                <input
                  type="date"
                  value={data.quote.validUntil}
                  onChange={(e) => updateQuote("validUntil", e.target.value)}
                  className="editable-cell text-right"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="font-medium">業 務 員：</span>
                <input
                  type="text"
                  value={data.quote.salesperson}
                  onChange={(e) => updateQuote("salesperson", e.target.value)}
                  className="editable-cell text-right"
                  placeholder="業務員姓名"
                />
              </div>
            </div>
          </div>

          {/* 裝置容量 */}
          <div className="mb-4 p-3 bg-gray-50 rounded text-center print:bg-gray-100">
            <span className="font-medium">裝置容量：</span>
            <span className="text-lg font-bold text-blue-600">{data.quote.capacityKwp} kWp</span>
          </div>

          {/* 項目明細表格 */}
          <table className="w-full border-collapse mb-6 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1 w-10">項次</th>
                <th className="border border-gray-300 px-2 py-1">類別</th>
                <th className="border border-gray-300 px-2 py-1">項目名稱</th>
                <th className="border border-gray-300 px-2 py-1">規格說明</th>
                <th className="border border-gray-300 px-2 py-1 w-20">數量</th>
                <th className="border border-gray-300 px-2 py-1 w-16">單位</th>
                <th className="border border-gray-300 px-2 py-1 w-16 no-print">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-2 py-1 text-center">{item.order}</td>
                  <td className="border border-gray-300 px-2 py-1">
                    <input
                      type="text"
                      value={item.categoryName || item.category}
                      onChange={(e) => updateItem(index, "categoryName", e.target.value)}
                      className="editable-cell w-full"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(index, "name", e.target.value)}
                      className="editable-cell w-full"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    <input
                      type="text"
                      value={item.spec}
                      onChange={(e) => updateItem(index, "spec", e.target.value)}
                      className="editable-cell w-full"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    <input
                      type="text"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      className="editable-cell w-full text-center"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(index, "unit", e.target.value)}
                      className="editable-cell w-full text-center"
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-center no-print">
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mb-4 no-print">
            <button
              onClick={addItem}
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              + 新增項目
            </button>
          </div>

          {/* 金額摘要 */}
          <div className="mb-6 p-4 bg-blue-50 rounded print:bg-blue-50">
            <h3 className="font-bold mb-2">金額摘要</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span>合計（未稅）：</span>
                <span className="font-bold">{formatCurrency(data.summary.subtotal, 0)}</span>
              </div>
              <div>
                <span>營業稅：</span>
                <span className="font-bold">{formatCurrency(data.summary.tax, 0)}</span>
              </div>
              <div className="col-span-2 text-lg">
                <span>總計（含稅）：</span>
                <span className="font-bold text-blue-600">
                  {formatCurrency(data.summary.total, 0)}
                </span>
              </div>
              <div>
                <span>每 kW 單價（未稅）：</span>
                <span>{formatCurrency(data.summary.pricePerKwpExcludingTax, 0)}</span>
              </div>
              <div>
                <span>每 kW 單價（含稅）：</span>
                <span>{formatCurrency(data.summary.pricePerKwpIncludingTax, 0)}</span>
              </div>
            </div>
          </div>

          {/* 付款條件 */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">付款條件</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1">期別</th>
                  <th className="border border-gray-300 px-2 py-1">比例</th>
                  <th className="border border-gray-300 px-2 py-1">金額</th>
                  <th className="border border-gray-300 px-2 py-1">付款條件</th>
                </tr>
              </thead>
              <tbody>
                {data.paymentTerms.map((term, index) => (
                  <tr key={index}>
                    <td className="border border-gray-300 px-2 py-1">{term.name}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      {term.percentage}%
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {formatCurrency(term.amount || 0, 0)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">{term.condition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 條款說明 */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">條款說明</h3>
            <ol className="list-decimal list-inside text-sm space-y-1">
              {data.terms.map((term, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="flex-shrink-0">{index + 1}.</span>
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => updateTerm(index, e.target.value)}
                    className="editable-cell flex-1"
                  />
                  <button
                    onClick={() => removeTerm(index)}
                    className="text-red-500 hover:text-red-700 text-xs no-print"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
            <button
              onClick={addTerm}
              className="text-blue-600 hover:text-blue-800 text-sm underline mt-2 no-print"
            >
              + 新增條款
            </button>
          </div>

          {/* 銀行資訊 */}
          {data.company.bankName && (
            <div className="mb-6 p-3 bg-gray-50 rounded text-sm print:bg-gray-50">
              <h3 className="font-bold mb-2">匯款資訊</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>銀行：{data.company.bankName}</div>
                <div>分行：{data.company.bankBranch}</div>
                <div>銀行代碼：{data.company.bankCode}</div>
                <div>帳號：{data.company.bankAccountNumber}</div>
                <div className="col-span-2">戶名：{data.company.bankAccountName}</div>
              </div>
            </div>
          )}

          {/* 簽章區 */}
          <div className="grid grid-cols-2 gap-8 mt-12 text-sm">
            <div className="border-t border-gray-400 pt-2">
              <p className="font-medium">賣方（簽章）：</p>
              <p className="mt-8">{data.company.name}</p>
            </div>
            <div className="border-t border-gray-400 pt-2">
              <p className="font-medium">買方（簽章）：</p>
              <p className="mt-8">{data.customer.name || "________________"}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

QuoteDocumentPreview.displayName = "QuoteDocumentPreview";

export default QuoteDocumentPreview;
export type { QuotePreviewData, QuoteItem, PaymentTermItem };
