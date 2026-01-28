/**
 * 報價單 HTML 預覽元件 - 傳統簡潔版面（對照明群範本）
 * 單頁 A4 呈現，可編輯，支援瀏覽器列印/另存 PDF
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
          padding: "12mm 15mm",
          fontSize: "9pt",
        }}
      >
        {/* 公司名稱 + 報價單標題 */}
        <div className="flex justify-between items-start mb-4">
          <div className="text-lg font-bold text-gray-800">{data.company.name}</div>
          <div className="text-2xl font-black tracking-[0.3em] border-b-2 border-gray-800 pb-1">
            報 價 單
          </div>
        </div>

        {/* 報價資訊表頭 - 三欄式 */}
        <table className="w-full mb-3 text-[9pt]" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td className="py-1" style={{ width: "33%" }}>
                <span className="text-gray-600">客編/客戶名稱：</span>
                <input
                  type="text"
                  value={data.customer.name}
                  onChange={(e) => updateCustomer("name", e.target.value)}
                  className="border-b border-dashed border-gray-400 bg-transparent px-1 focus:outline-none font-medium"
                  style={{ width: "140px" }}
                />
              </td>
              <td className="py-1" style={{ width: "33%" }}></td>
              <td className="py-1 text-right" style={{ width: "33%" }}>
                <span className="text-gray-600">報價日期：</span>
                <input
                  type="text"
                  value={data.quote.date}
                  onChange={(e) => updateQuote("date", e.target.value)}
                  className="border-b border-dashed border-gray-400 bg-transparent px-1 focus:outline-none"
                  style={{ width: "100px" }}
                />
              </td>
            </tr>
            <tr>
              <td className="py-1">
                <span className="text-gray-600">聯絡人：</span>
                <input
                  type="text"
                  value={data.customer.contact}
                  onChange={(e) => updateCustomer("contact", e.target.value)}
                  className="border-b border-dashed border-gray-400 bg-transparent px-1 focus:outline-none"
                  style={{ width: "100px" }}
                />
              </td>
              <td className="py-1">
                <span className="text-gray-600">聯絡電話：</span>
                <input
                  type="text"
                  value={data.customer.phone}
                  onChange={(e) => updateCustomer("phone", e.target.value)}
                  className="border-b border-dashed border-gray-400 bg-transparent px-1 focus:outline-none"
                  style={{ width: "120px" }}
                />
              </td>
              <td className="py-1 text-right">
                <span className="text-gray-600">有效日期：</span>
                <input
                  type="text"
                  value={data.quote.validUntil}
                  onChange={(e) => updateQuote("validUntil", e.target.value)}
                  className="border-b border-dashed border-gray-400 bg-transparent px-1 focus:outline-none"
                  style={{ width: "100px" }}
                />
              </td>
            </tr>
            <tr>
              <td className="py-1" colSpan={2}>
                <span className="text-gray-600">案場地點：</span>
                <input
                  type="text"
                  value={data.customer.siteAddress}
                  onChange={(e) => updateCustomer("siteAddress", e.target.value)}
                  className="border-b border-dashed border-gray-400 bg-transparent px-1 focus:outline-none"
                  style={{ width: "320px" }}
                />
              </td>
              <td className="py-1 text-right">
                <span className="text-gray-600">業務員：</span>
                <input
                  type="text"
                  value={data.quote.salesperson}
                  onChange={(e) => updateQuote("salesperson", e.target.value)}
                  className="border-b border-dashed border-gray-400 bg-transparent px-1 focus:outline-none"
                  style={{ width: "80px" }}
                />
              </td>
            </tr>
            <tr>
              <td className="py-1">
                <span className="text-gray-600">裝置容量：(kW)</span>
                <span className="font-bold ml-1">{data.quote.capacityKwp.toFixed(2)}</span>
              </td>
              <td className="py-1"></td>
              <td className="py-1 text-right">
                <span className="text-gray-600">業務分機：</span>
                <input
                  type="text"
                  value={data.quote.salespersonPhone}
                  onChange={(e) => updateQuote("salespersonPhone", e.target.value)}
                  className="border-b border-dashed border-gray-400 bg-transparent px-1 focus:outline-none"
                  style={{ width: "100px" }}
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* 項目明細表格 */}
        <table className="w-full text-[8.5pt] mb-3" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-2 py-1.5 text-center" style={{ width: "35px" }}>項次</th>
              <th className="border border-gray-400 px-2 py-1.5 text-left" style={{ width: "120px" }}>品 名</th>
              <th className="border border-gray-400 px-2 py-1.5 text-left">規 格</th>
              <th className="border border-gray-400 px-2 py-1.5 text-center" style={{ width: "70px" }}>數量</th>
              <th className="border border-gray-400 px-2 py-1.5 text-center no-print" style={{ width: "45px" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={index}>
                <td className="border border-gray-300 px-2 py-1 text-center text-gray-600">
                  {item.order}
                </td>
                <td className="border border-gray-300 px-1 py-0.5">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    className="w-full bg-transparent px-1 py-0.5 focus:bg-blue-50 focus:outline-none"
                  />
                </td>
                <td className="border border-gray-300 px-1 py-0.5">
                  <input
                    type="text"
                    value={item.spec}
                    onChange={(e) => updateItem(index, "spec", e.target.value)}
                    className="w-full bg-transparent px-1 py-0.5 focus:bg-blue-50 focus:outline-none text-gray-700"
                  />
                </td>
                <td className="border border-gray-300 px-1 py-0.5 text-center">
                  <input
                    type="text"
                    value={typeof item.quantity === "number" ? `${item.quantity} ${item.unit}` : item.quantity}
                    onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    className="w-full bg-transparent px-1 py-0.5 text-center focus:bg-blue-50 focus:outline-none"
                  />
                </td>
                <td className="border border-gray-300 px-1 py-0.5 text-center no-print">
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
        <button
          onClick={addItem}
          className="text-blue-600 hover:text-blue-800 text-[9pt] hover:bg-blue-50 px-2 py-0.5 rounded no-print mb-3"
        >
          + 新增項目
        </button>

        {/* 銀行資訊 + 金額摘要 - 左右並排 */}
        <div className="flex gap-4 mb-3 text-[8.5pt]">
          {/* 左側：銀行資訊 */}
          <div className="flex-1 border border-gray-300 p-2">
            <div className="font-bold text-gray-700 mb-1">帳戶資料如下列：</div>
            <div className="space-y-0.5">
              <div>戶名：{data.company.bankAccountName || data.company.name}</div>
              <div>銀行：{data.company.bankName}</div>
              <div>分行：{data.company.bankBranch}</div>
              <div>銀行代號：{data.company.bankCode}</div>
              <div>帳號(TWD)：{data.company.bankAccountNumber}</div>
            </div>
          </div>

          {/* 右側：金額摘要 */}
          <div className="w-56 text-right">
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span>合計(未稅)：</span>
              <span className="font-medium">{formatCurrency(data.summary.subtotal, 0)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span>稅金：</span>
              <span className="font-medium">{formatCurrency(data.summary.tax, 0)}</span>
            </div>
            <div className="flex justify-between py-1 border-b-2 border-gray-800 font-bold">
              <span>總計：</span>
              <span>{formatCurrency(data.summary.total, 0)}</span>
            </div>
            <div className="flex justify-between py-1 text-gray-600">
              <span>每kWp(未稅)：</span>
              <span>{formatCurrency(data.summary.pricePerKwpExcludingTax, 0)}</span>
            </div>
            <div className="flex justify-between py-1 text-gray-600">
              <span>每kWp(含稅)：</span>
              <span>{formatCurrency(data.summary.pricePerKwpIncludingTax, 0)}</span>
            </div>
          </div>
        </div>

        {/* 條款說明 */}
        <div className="text-[8pt] text-gray-700 mb-4 space-y-0.5">
          {data.terms.map((term, index) => (
            <div key={index} className="flex items-start gap-1 group">
              <span className="flex-shrink-0">{index + 1}、</span>
              <input
                type="text"
                value={term}
                onChange={(e) => updateTerm(index, e.target.value)}
                className="flex-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 px-0.5 focus:outline-none"
              />
              <button
                onClick={() => removeTerm(index)}
                className="opacity-0 group-hover:opacity-100 text-red-500 text-xs no-print"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addTerm}
            className="text-blue-600 hover:text-blue-800 text-[8pt] hover:bg-blue-50 px-2 py-0.5 rounded no-print"
          >
            + 新增條款
          </button>
        </div>

        {/* 簽章區 */}
        <div className="flex justify-between items-end mt-6 text-[9pt]">
          <div>
            <div className="text-gray-600 mb-1">客戶回簽欄(簽名或蓋章)</div>
            <div className="border-b border-gray-400 w-48 h-12"></div>
          </div>
          <div className="text-right">
            <div className="font-bold">{data.company.name}</div>
          </div>
        </div>
      </div>
    );
  }
);

QuoteDocumentPreview.displayName = "QuoteDocumentPreview";

export default QuoteDocumentPreview;
export type { QuotePreviewData, QuoteItem, PaymentTermItem };
