/**
 * 報價單 PDF 文件組件
 * 使用 @react-pdf/renderer 生成正式報價單
 */
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

// Import TTF font as module (required for @react-pdf/renderer)
import NotoSansTCRegular from "@/assets/fonts/NotoSansTC-Regular.ttf";

// 註冊中文字型 - 使用 ES6 import 載入 TTF 字型
Font.register({
  family: "NotoSansTC",
  fonts: [
    {
      src: NotoSansTCRegular,
      fontWeight: "normal",
    },
    {
      src: NotoSansTCRegular, // 使用 Regular 作為 Bold 的備選
      fontWeight: "bold",
    },
  ],

});

// 禁用 hyphenation 以避免中文斷字問題
Font.registerHyphenationCallback((word) => [word]);

// PDF 樣式定義
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "NotoSansTC",
    fontSize: 9,
    color: "#333",
  },
  // Header styles
  header: {
    textAlign: "center",
    marginBottom: 15,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 2,
  },
  companyInfo: {
    fontSize: 8,
    color: "#666",
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 15,
    textAlign: "center",
  },
  // Info section styles
  infoSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  infoColumn: {
    width: "48%",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  infoLabel: {
    width: 60,
    fontSize: 9,
    color: "#333",
  },
  infoValue: {
    flex: 1,
    fontSize: 9,
  },
  // Table styles
  table: {
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#40a9a9",
    color: "white",
    fontWeight: "bold",
    padding: 5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    padding: 5,
    minHeight: 25,
  },
  tableRowAlt: {
    backgroundColor: "#f9f9f9",
  },
  tableCell: {
    fontSize: 8,
    paddingHorizontal: 3,
  },
  tableCellCenter: {
    textAlign: "center",
  },
  tableCellRight: {
    textAlign: "right",
  },
  // Column widths for main table
  colOrder: { width: "6%" },
  colName: { width: "18%" },
  colSpec: { width: "56%" },
  colQty: { width: "10%" },
  colUnit: { width: "10%" },
  // Section header
  sectionHeader: {
    backgroundColor: "#e6e6e6",
    padding: 5,
    fontWeight: "bold",
    fontSize: 9,
    marginTop: 5,
  },
  // Summary section
  summarySection: {
    marginTop: 15,
    alignItems: "flex-end",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 3,
  },
  summaryLabel: {
    width: 120,
    textAlign: "right",
    fontSize: 9,
    marginRight: 10,
  },
  summaryValue: {
    width: 100,
    textAlign: "right",
    fontSize: 9,
    fontWeight: "bold",
  },
  summaryHighlight: {
    color: "#c00",
    fontWeight: "bold",
  },
  // Payment terms table
  paymentTable: {
    marginTop: 15,
    marginBottom: 15,
  },
  paymentTableHeader: {
    flexDirection: "row",
    backgroundColor: "#40a9a9",
    color: "white",
    padding: 5,
    fontWeight: "bold",
  },
  paymentTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    padding: 5,
  },
  paymentColName: { width: "25%" },
  paymentColPercent: { width: "15%" },
  paymentColCondition: { width: "35%" },
  paymentColAmount: { width: "25%" },
  // Terms section
  termsSection: {
    marginTop: 15,
    fontSize: 8,
    lineHeight: 1.5,
  },
  termsTitle: {
    fontWeight: "bold",
    marginBottom: 3,
  },
  termItem: {
    marginBottom: 2,
  },
  // Bank info section
  bankSection: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 3,
  },
  bankTitle: {
    fontWeight: "bold",
    marginBottom: 5,
    fontSize: 9,
  },
  bankInfo: {
    fontSize: 8,
  },
  // Signature section
  signatureSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  signatureBox: {
    width: "45%",
  },
  signatureLabel: {
    fontSize: 8,
    color: "#666",
    marginBottom: 30,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#333",
    paddingTop: 5,
    fontSize: 8,
  },
});

// 報價單資料介面
export interface QuoteDocumentData {
  // 公司資訊
  company: {
    name: string;
    address: string;
    phone: string;
    taxId?: string;
    bankName?: string;
    bankBranch?: string;
    bankCode?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
  };
  // 客戶資訊
  customer: {
    name: string;
    contact?: string;
    phone?: string;
    siteAddress?: string;
  };
  // 報價資訊
  quote: {
    number: string;
    date: string;
    validUntil?: string;
    salesperson?: string;
    salespersonPhone?: string;
    capacityKwp: number;
  };
  // 項目明細
  items: QuoteDocumentItem[];
  // 金額摘要
  summary: {
    subtotal: number;
    tax: number;
    total: number;
    pricePerKwpExcludingTax: number;
    pricePerKwpIncludingTax: number;
  };
  // 付款條件
  paymentTerms: PaymentTermItem[];
  // 條款
  terms?: string[];
}

export interface QuoteDocumentItem {
  order: number;
  category?: string;
  categoryName?: string;
  name: string;
  spec?: string;
  quantity: number | string;
  unit?: string;
}

export interface PaymentTermItem {
  name: string;
  percentage: number;
  condition?: string;
  amount?: number;
}

// 格式化金額
function formatCurrency(value: number): string {
  if (!value && value !== 0) return "-";
  return new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// 格式化日期
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

// PDF 文件組件
export default function QuoteDocumentPDF({ data }: { data: QuoteDocumentData }) {
  // 按類別分組項目
  const groupedItems: Map<string, QuoteDocumentItem[]> = new Map();
  let currentCategory = "";
  
  data.items.forEach((item) => {
    const category = item.category || "other";
    if (!groupedItems.has(category)) {
      groupedItems.set(category, []);
    }
    groupedItems.get(category)!.push(item);
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 公司表頭 */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.company.name}</Text>
          <Text style={styles.companyInfo}>{data.company.address}</Text>
          <Text style={styles.companyInfo}>{data.company.phone}</Text>
        </View>

        {/* 文件標題 */}
        <Text style={styles.documentTitle}>報 價 單</Text>

        {/* 客戶與報價資訊 */}
        <View style={styles.infoSection}>
          <View style={styles.infoColumn}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>客編/客戶名稱：</Text>
              <Text style={styles.infoValue}>{data.customer.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>聯絡人：</Text>
              <Text style={styles.infoValue}>{data.customer.contact || " "}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>聯絡電話：</Text>
              <Text style={styles.infoValue}>{data.customer.phone || " "}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>案場地點：</Text>
              <Text style={styles.infoValue}>{data.customer.siteAddress || " "}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>裝置容量：</Text>
              <Text style={styles.infoValue}>{data.quote.capacityKwp} kW</Text>
            </View>
          </View>
          <View style={styles.infoColumn}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>報價日期：</Text>
              <Text style={styles.infoValue}>{formatDate(data.quote.date) || " "}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>報價單號：</Text>
              <Text style={{ ...styles.infoValue, color: "#c00" }}>{data.quote.number || " "}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>有效日期：</Text>
              <Text style={styles.infoValue}>{data.quote.validUntil ? formatDate(data.quote.validUntil) : " "}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>業務員：</Text>
              <Text style={styles.infoValue}>{data.quote.salesperson || " "}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>業務分機：</Text>
              <Text style={styles.infoValue}>{data.quote.salespersonPhone || " "}</Text>
            </View>
          </View>
        </View>

        {/* 項目明細表 */}
        <View style={styles.table}>
          {/* 表頭 */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.colOrder, styles.tableCellCenter]}>項次</Text>
            <Text style={[styles.tableCell, styles.colName]}>品 名</Text>
            <Text style={[styles.tableCell, styles.colSpec]}>規 格</Text>
            <Text style={[styles.tableCell, styles.colQty, styles.tableCellRight]}>數量</Text>
            <Text style={[styles.tableCell, styles.colUnit, styles.tableCellCenter]}>{" "}</Text>
          </View>

          {/* 項目列表 */}
          {data.items.map((item, index) => {
            const showCategoryHeader = item.categoryName && item.categoryName !== currentCategory;
            if (item.categoryName) currentCategory = item.categoryName;
            
            return (
              <View key={index}>
                {showCategoryHeader && (
                  <View style={styles.sectionHeader}>
                    <Text>●{item.categoryName}</Text>
                  </View>
                )}
                <View style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={[styles.tableCell, styles.colOrder, styles.tableCellCenter]}>
                    {item.order || " "}
                  </Text>
                  <Text style={[styles.tableCell, styles.colName]}>{item.name || " "}</Text>
                  <Text style={[styles.tableCell, styles.colSpec]}>{item.spec || " "}</Text>
                  <Text style={[styles.tableCell, styles.colQty, styles.tableCellRight]}>
                    {item.quantity || " "}
                  </Text>
                  <Text style={[styles.tableCell, styles.colUnit, styles.tableCellCenter]}>
                    {item.unit || " "}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* 金額摘要 */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>合計(未稅)：</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.summary.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>稅金 Tax：</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.summary.tax)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>總計 Total：</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.summary.total)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>每kWp(未稅)：</Text>
            <Text style={[styles.summaryValue, styles.summaryHighlight]}>
              {formatCurrency(data.summary.pricePerKwpExcludingTax)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>每kWp(含稅)：</Text>
            <Text style={[styles.summaryValue, styles.summaryHighlight]}>
              {formatCurrency(data.summary.pricePerKwpIncludingTax)}
            </Text>
          </View>
        </View>

        {/* 付款條件 */}
        {data.paymentTerms.length > 0 && (
          <View style={styles.paymentTable}>
            <Text style={{ fontWeight: "bold", marginBottom: 5, fontSize: 9 }}>
              1.付款條件：（詳依工程合約書）
            </Text>
            <View style={styles.paymentTableHeader}>
              <Text style={[styles.tableCell, styles.paymentColName]}>付款項目</Text>
              <Text style={[styles.tableCell, styles.paymentColPercent, styles.tableCellCenter]}>付款百分比</Text>
              <Text style={[styles.tableCell, styles.paymentColCondition]}>付款條件</Text>
              <Text style={[styles.tableCell, styles.paymentColAmount, styles.tableCellRight]}>金額(含稅)</Text>
            </View>
            {data.paymentTerms.map((term, index) => (
              <View key={index} style={styles.paymentTableRow}>
                <Text style={[styles.tableCell, styles.paymentColName]}>{term.name || " "}</Text>
                <Text style={[styles.tableCell, styles.paymentColPercent, styles.tableCellCenter]}>
                  {term.percentage}%
                </Text>
                <Text style={[styles.tableCell, styles.paymentColCondition]}>{term.condition || " "}</Text>
                <Text style={[styles.tableCell, styles.paymentColAmount, styles.tableCellRight]}>
                  {term.amount ? formatCurrency(term.amount) : " "}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 條款說明 */}
        {data.terms && data.terms.length > 0 && (
          <View style={styles.termsSection}>
            {data.terms.map((term, index) => (
              <Text key={index} style={styles.termItem}>
                {index + 2}.{term}
              </Text>
            ))}
          </View>
        )}

        {/* 帳戶資訊 */}
        {data.company.bankAccountNumber && (
          <View style={styles.bankSection}>
            <Text style={styles.bankTitle}>帳戶資料如右列：</Text>
            <Text style={styles.bankInfo}>
              戶名：{data.company.bankAccountName}
            </Text>
            <Text style={styles.bankInfo}>
              銀行：{data.company.bankName} 分行：{data.company.bankBranch}
            </Text>
            <Text style={styles.bankInfo}>
              銀行代號：{data.company.bankCode} 帳號(TWD)：{data.company.bankAccountNumber}
            </Text>
          </View>
        )}

        {/* 簽章區 */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>客戶回簽欄(簽名或蓋章)</Text>
            <Text style={styles.signatureLine}>{" "}</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>{" "}</Text>
            <Text style={styles.signatureLine}>{data.company.name || " "}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
