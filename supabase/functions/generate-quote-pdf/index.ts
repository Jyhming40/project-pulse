/**
 * 報價單 PDF 產生 Edge Function
 * 使用 pdf-lib 產生正式報價單
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Noto Sans TC 字型 URL - 使用 Supabase Storage (公開 bucket)
const NOTO_SANS_TC_URL =
  "https://mcvgtsoheayabjpdplcr.supabase.co/storage/v1/object/public/branding/fonts/NotoSansTC-Regular.ttf";

interface QuoteDocumentData {
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
  customer: {
    name: string;
    contact?: string;
    phone?: string;
    siteAddress?: string;
  };
  quote: {
    number: string;
    date: string;
    validUntil?: string;
    salesperson?: string;
    salespersonPhone?: string;
    capacityKwp: number;
  };
  items: QuoteDocumentItem[];
  summary: {
    subtotal: number;
    tax: number;
    total: number;
    pricePerKwpExcludingTax: number;
    pricePerKwpIncludingTax: number;
  };
  paymentTerms: PaymentTermItem[];
  terms?: string[];
}

interface QuoteDocumentItem {
  order: number;
  category?: string;
  categoryName?: string;
  name: string;
  spec?: string;
  quantity: number | string;
  unit?: string;
}

interface PaymentTermItem {
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

// 繪製表格的輔助函數
function drawLine(
  page: any,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness = 0.5
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: rgb(0.6, 0.6, 0.6),
  });
}

function drawRect(
  page: any,
  x: number,
  y: number,
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(color.r, color.g, color.b),
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: QuoteDocumentData = await req.json();

    // 創建 PDF 文件
    const pdfDoc = await PDFDocument.create();
    
    // 註冊 fontkit 以支援自訂字型
    pdfDoc.registerFontkit(fontkit);

    // 載入中文字型
    let chineseFont;
    try {
      const fontResponse = await fetch(NOTO_SANS_TC_URL);
      if (!fontResponse.ok) {
        throw new Error(`Font fetch failed: ${fontResponse.status}`);
      }
      const fontBytes = await fontResponse.arrayBuffer();
      chineseFont = await pdfDoc.embedFont(fontBytes, { subset: true });
    } catch (fontError) {
      console.error("Failed to load Chinese font, using fallback:", fontError);
      // 使用標準字型作為備選
      chineseFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // 創建 A4 頁面 (595.28 x 841.89 points)
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const margin = 40;
    let y = height - margin;

    // 顏色定義
    const primaryColor = rgb(0.25, 0.66, 0.66); // #40a9a9
    const blackColor = rgb(0, 0, 0);
    const grayColor = rgb(0.4, 0.4, 0.4);
    const redColor = rgb(0.8, 0, 0);
    const lightGray = { r: 0.96, g: 0.96, b: 0.96 };

    // ===== 公司表頭 =====
    const fontSize = {
      title: 16,
      subtitle: 12,
      normal: 9,
      small: 8,
    };

    // 公司名稱
    page.drawText(data.company.name || "公司名稱", {
      x: width / 2 - 60,
      y,
      size: fontSize.title,
      font: chineseFont,
      color: blackColor,
    });
    y -= 16;

    // 公司地址與電話
    if (data.company.address) {
      page.drawText(data.company.address, {
        x: width / 2 - 80,
        y,
        size: fontSize.small,
        font: chineseFont,
        color: grayColor,
      });
      y -= 12;
    }
    if (data.company.phone) {
      page.drawText(data.company.phone, {
        x: width / 2 - 30,
        y,
        size: fontSize.small,
        font: chineseFont,
        color: grayColor,
      });
      y -= 12;
    }

    // ===== 報價單標題 =====
    y -= 10;
    page.drawText("報 價 單", {
      x: width / 2 - 36,
      y,
      size: 18,
      font: chineseFont,
      color: blackColor,
    });
    y -= 30;

    // ===== 客戶與報價資訊 (左右雙欄) =====
    const leftCol = margin;
    const rightCol = width / 2 + 20;
    const infoLineHeight = 14;
    let leftY = y;
    let rightY = y;

    // 左欄 - 客戶資訊
    const leftLabels = [
      ["客編/客戶名稱：", data.customer.name || " "],
      ["聯絡人：", data.customer.contact || " "],
      ["聯絡電話：", data.customer.phone || " "],
      ["案場地點：", data.customer.siteAddress || " "],
      ["裝置容量：", `${data.quote.capacityKwp} kW`],
    ];
    leftLabels.forEach(([label, value]) => {
      page.drawText(label, {
        x: leftCol,
        y: leftY,
        size: fontSize.normal,
        font: chineseFont,
        color: blackColor,
      });
      page.drawText(value, {
        x: leftCol + 70,
        y: leftY,
        size: fontSize.normal,
        font: chineseFont,
        color: blackColor,
      });
      leftY -= infoLineHeight;
    });

    // 右欄 - 報價資訊
    const rightLabels = [
      ["報價日期：", formatDate(data.quote.date) || " "],
      ["報價單號：", data.quote.number || " ", true], // true = 紅色
      ["有效日期：", data.quote.validUntil ? formatDate(data.quote.validUntil) : " "],
      ["業務員：", data.quote.salesperson || " "],
      ["業務分機：", data.quote.salespersonPhone || " "],
    ];
    rightLabels.forEach(([label, value, isRed]) => {
      page.drawText(label as string, {
        x: rightCol,
        y: rightY,
        size: fontSize.normal,
        font: chineseFont,
        color: blackColor,
      });
      page.drawText(value as string, {
        x: rightCol + 60,
        y: rightY,
        size: fontSize.normal,
        font: chineseFont,
        color: isRed ? redColor : blackColor,
      });
      rightY -= infoLineHeight;
    });

    y = Math.min(leftY, rightY) - 20;

    // ===== 項目明細表 =====
    const tableLeft = margin;
    const tableWidth = width - margin * 2;
    const colWidths = [30, 80, 280, 60, 50]; // 項次, 品名, 規格, 數量, 單位
    const rowHeight = 18;
    
    // 表頭
    drawRect(page, tableLeft, y - rowHeight, tableWidth, rowHeight, { r: 0.25, g: 0.66, b: 0.66 });
    const headers = ["項次", "品 名", "規 格", "數量", "單位"];
    let colX = tableLeft + 3;
    headers.forEach((header, idx) => {
      page.drawText(header, {
        x: colX + (idx === 0 ? 5 : 0),
        y: y - rowHeight + 5,
        size: fontSize.small,
        font: chineseFont,
        color: rgb(1, 1, 1),
      });
      colX += colWidths[idx];
    });
    y -= rowHeight;

    // 繪製項目列表
    let currentCategory = "";
    data.items.forEach((item, idx) => {
      // 類別標題
      if (item.categoryName && item.categoryName !== currentCategory) {
        currentCategory = item.categoryName;
        y -= rowHeight;
        drawRect(page, tableLeft, y, tableWidth, rowHeight, lightGray);
        page.drawText(`●${item.categoryName}`, {
          x: tableLeft + 5,
          y: y + 5,
          size: fontSize.normal,
          font: chineseFont,
          color: blackColor,
        });
      }

      // 項目列
      y -= rowHeight;
      if (idx % 2 === 1) {
        drawRect(page, tableLeft, y, tableWidth, rowHeight, { r: 0.98, g: 0.98, b: 0.98 });
      }
      drawLine(page, tableLeft, y, tableLeft + tableWidth, y);

      colX = tableLeft + 3;
      const values = [
        String(item.order || " "),
        item.name || " ",
        (item.spec || " ").substring(0, 50), // 截斷過長規格
        String(item.quantity || " "),
        item.unit || " ",
      ];
      values.forEach((val, colIdx) => {
        page.drawText(val, {
          x: colX + (colIdx === 0 ? 8 : 0),
          y: y + 5,
          size: fontSize.small,
          font: chineseFont,
          color: blackColor,
        });
        colX += colWidths[colIdx];
      });

      // 檢查是否需要換頁
      if (y < 200) {
        // 換頁邏輯可在此擴展
      }
    });

    y -= 25;

    // ===== 金額摘要 =====
    const summaryX = width - margin - 200;
    const summaryData = [
      ["合計(未稅)：", formatCurrency(data.summary.subtotal)],
      ["稅金 Tax：", formatCurrency(data.summary.tax)],
      ["總計 Total：", formatCurrency(data.summary.total)],
      ["每kWp(未稅)：", formatCurrency(data.summary.pricePerKwpExcludingTax), true],
      ["每kWp(含稅)：", formatCurrency(data.summary.pricePerKwpIncludingTax), true],
    ];
    summaryData.forEach(([label, value, isHighlight]) => {
      page.drawText(label as string, {
        x: summaryX,
        y,
        size: fontSize.normal,
        font: chineseFont,
        color: blackColor,
      });
      page.drawText(value as string, {
        x: summaryX + 80,
        y,
        size: fontSize.normal,
        font: chineseFont,
        color: isHighlight ? redColor : blackColor,
      });
      y -= 14;
    });

    y -= 15;

    // ===== 付款條件 =====
    if (data.paymentTerms && data.paymentTerms.length > 0) {
      page.drawText("1.付款條件：（詳依工程合約書）", {
        x: margin,
        y,
        size: fontSize.normal,
        font: chineseFont,
        color: blackColor,
      });
      y -= 18;

      // 付款表頭
      const paymentColWidths = [100, 60, 180, 100];
      drawRect(page, tableLeft, y - rowHeight, tableWidth, rowHeight, { r: 0.25, g: 0.66, b: 0.66 });
      const paymentHeaders = ["付款項目", "付款百分比", "付款條件", "金額(含稅)"];
      colX = tableLeft + 5;
      paymentHeaders.forEach((header, idx) => {
        page.drawText(header, {
          x: colX,
          y: y - rowHeight + 5,
          size: fontSize.small,
          font: chineseFont,
          color: rgb(1, 1, 1),
        });
        colX += paymentColWidths[idx];
      });
      y -= rowHeight;

      // 付款項目
      data.paymentTerms.forEach((term) => {
        y -= rowHeight;
        drawLine(page, tableLeft, y, tableLeft + tableWidth, y);
        colX = tableLeft + 5;
        const termValues = [
          term.name || " ",
          `${term.percentage}%`,
          term.condition || " ",
          term.amount ? formatCurrency(term.amount) : " ",
        ];
        termValues.forEach((val, idx) => {
          page.drawText(val, {
            x: colX,
            y: y + 5,
            size: fontSize.small,
            font: chineseFont,
            color: blackColor,
          });
          colX += paymentColWidths[idx];
        });
      });
      y -= 20;
    }

    // ===== 條款說明 =====
    if (data.terms && data.terms.length > 0) {
      data.terms.forEach((term, idx) => {
        page.drawText(`${idx + 2}.${term}`, {
          x: margin,
          y,
          size: fontSize.small,
          font: chineseFont,
          color: blackColor,
        });
        y -= 12;
      });
      y -= 10;
    }

    // ===== 帳戶資訊 =====
    if (data.company.bankAccountNumber) {
      drawRect(page, margin, y - 50, tableWidth, 50, lightGray);
      page.drawText("帳戶資料如右列：", {
        x: margin + 10,
        y: y - 15,
        size: fontSize.normal,
        font: chineseFont,
        color: blackColor,
      });
      page.drawText(`戶名：${data.company.bankAccountName || ""}`, {
        x: margin + 10,
        y: y - 28,
        size: fontSize.small,
        font: chineseFont,
        color: blackColor,
      });
      page.drawText(
        `銀行：${data.company.bankName || ""} 分行：${data.company.bankBranch || ""} 銀行代號：${data.company.bankCode || ""} 帳號：${data.company.bankAccountNumber}`,
        {
          x: margin + 10,
          y: y - 40,
          size: fontSize.small,
          font: chineseFont,
          color: blackColor,
        }
      );
      y -= 60;
    }

    // ===== 簽章區 =====
    y -= 30;
    page.drawText("客戶回簽欄(簽名或蓋章)", {
      x: margin,
      y: y + 25,
      size: fontSize.small,
      font: chineseFont,
      color: grayColor,
    });
    drawLine(page, margin, y, margin + 180, y, 1);

    page.drawText(data.company.name || " ", {
      x: width - margin - 180,
      y,
      size: fontSize.small,
      font: chineseFont,
      color: blackColor,
    });
    drawLine(page, width - margin - 180, y, width - margin, y, 1);

    // 產生 PDF
    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes).buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="quote-${data.quote.number || "document"}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new Response(
      JSON.stringify({ error: "PDF generation failed", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
