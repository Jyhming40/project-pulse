import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Plus, Trash2, Undo, Redo, Merge, Split } from "lucide-react";
import { cn } from "@/lib/utils";

// Cell data structure
interface Cell {
  value: string;
  rowSpan?: number;
  colSpan?: number;
  hidden?: boolean; // Hidden when merged into another cell
  align?: "left" | "center" | "right";
  bold?: boolean;
  fontSize?: number;
}

interface ExcelQuoteEditorProps {
  initialData?: Cell[][];
  companyName?: string;
  onSave?: (data: Cell[][]) => void;
}

// Default template matching the reference document
const createDefaultTemplate = (companyName: string): Cell[][] => [
  // Row 0: Company header
  [
    { value: companyName || "公司名稱", colSpan: 8, align: "center", bold: true, fontSize: 16 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 1: Title
  [
    { value: "報　價　單", colSpan: 8, align: "center", bold: true, fontSize: 20 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 2: Quote info
  [
    { value: "報價單號：", colSpan: 2, align: "right" },
    { value: "", hidden: true },
    { value: "Q20260128-001", colSpan: 2 },
    { value: "", hidden: true },
    { value: "報價日期：", colSpan: 2, align: "right" },
    { value: "", hidden: true },
    { value: "2026/01/28", colSpan: 2 },
    { value: "", hidden: true },
  ],
  // Row 3: Customer info
  [
    { value: "客戶名稱：", colSpan: 2, align: "right" },
    { value: "", hidden: true },
    { value: "", colSpan: 6 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 4: Address
  [
    { value: "案場地址：", colSpan: 2, align: "right" },
    { value: "", hidden: true },
    { value: "", colSpan: 6 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 5: Capacity & Contact
  [
    { value: "設置容量：", colSpan: 2, align: "right" },
    { value: "", hidden: true },
    { value: "kWp", colSpan: 2 },
    { value: "", hidden: true },
    { value: "聯絡電話：", colSpan: 2, align: "right" },
    { value: "", hidden: true },
    { value: "", colSpan: 2 },
    { value: "", hidden: true },
  ],
  // Row 6: Empty spacer
  [
    { value: "", colSpan: 8 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 7: Table header
  [
    { value: "項次", align: "center", bold: true },
    { value: "項目名稱", colSpan: 2, align: "center", bold: true },
    { value: "", hidden: true },
    { value: "規格說明", colSpan: 2, align: "center", bold: true },
    { value: "", hidden: true },
    { value: "數量", align: "center", bold: true },
    { value: "金額", align: "center", bold: true },
  ],
  // Row 8-12: Item rows
  [
    { value: "1", align: "center" },
    { value: "太陽能模組", colSpan: 2 },
    { value: "", hidden: true },
    { value: "", colSpan: 2 },
    { value: "", hidden: true },
    { value: "", align: "center" },
    { value: "", align: "right" },
  ],
  [
    { value: "2", align: "center" },
    { value: "變流器", colSpan: 2 },
    { value: "", hidden: true },
    { value: "", colSpan: 2 },
    { value: "", hidden: true },
    { value: "", align: "center" },
    { value: "", align: "right" },
  ],
  [
    { value: "3", align: "center" },
    { value: "結構支架工程", colSpan: 2 },
    { value: "", hidden: true },
    { value: "", colSpan: 2 },
    { value: "", hidden: true },
    { value: "", align: "center" },
    { value: "", align: "right" },
  ],
  [
    { value: "4", align: "center" },
    { value: "電氣配線工程", colSpan: 2 },
    { value: "", hidden: true },
    { value: "", colSpan: 2 },
    { value: "", hidden: true },
    { value: "", align: "center" },
    { value: "", align: "right" },
  ],
  [
    { value: "5", align: "center" },
    { value: "", colSpan: 2 },
    { value: "", hidden: true },
    { value: "", colSpan: 2 },
    { value: "", hidden: true },
    { value: "", align: "center" },
    { value: "", align: "right" },
  ],
  // Row 13: Subtotal
  [
    { value: "", colSpan: 6 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "小計", align: "center", bold: true },
    { value: "", align: "right", bold: true },
  ],
  // Row 14: Tax
  [
    { value: "", colSpan: 6 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "稅金 5%", align: "center" },
    { value: "", align: "right" },
  ],
  // Row 15: Total
  [
    { value: "", colSpan: 6 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "合計", align: "center", bold: true },
    { value: "", align: "right", bold: true },
  ],
  // Row 16: Spacer
  [
    { value: "", colSpan: 8 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 17: Bank info header
  [
    { value: "匯款資訊", colSpan: 8, bold: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 18: Bank details
  [
    { value: "銀行：", colSpan: 2, align: "right" },
    { value: "", hidden: true },
    { value: "", colSpan: 2 },
    { value: "", hidden: true },
    { value: "戶名：", colSpan: 2, align: "right" },
    { value: "", hidden: true },
    { value: "", colSpan: 2 },
    { value: "", hidden: true },
  ],
  // Row 19: Account
  [
    { value: "帳號：", colSpan: 2, align: "right" },
    { value: "", hidden: true },
    { value: "", colSpan: 6 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 20: Spacer
  [
    { value: "", colSpan: 8 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 21: Terms header
  [
    { value: "備註說明", colSpan: 8, bold: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 22: Terms
  [
    { value: "1. 本報價單有效期限為 30 天。", colSpan: 8 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 23: Terms
  [
    { value: "2. 付款方式：簽約 30%、掛表 60%、驗收 10%。", colSpan: 8 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 24: Spacer
  [
    { value: "", colSpan: 8 },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
    { value: "", hidden: true },
  ],
  // Row 25: Signature
  [
    { value: "報價單位：", colSpan: 2, align: "right" },
    { value: "", hidden: true },
    { value: "", colSpan: 2 },
    { value: "", hidden: true },
    { value: "客戶簽章：", colSpan: 2, align: "right" },
    { value: "", hidden: true },
    { value: "", colSpan: 2 },
    { value: "", hidden: true },
  ],
];

// Default column widths (in pixels)
const DEFAULT_COL_WIDTHS = [50, 100, 80, 120, 100, 80, 80, 100];

export default function ExcelQuoteEditor({ 
  initialData, 
  companyName = "明群環能有限公司",
  onSave 
}: ExcelQuoteEditorProps) {
  const [data, setData] = useState<Cell[][]>(
    initialData || createDefaultTemplate(companyName)
  );
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COL_WIDTHS);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ row: number; col: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCol, setResizeCol] = useState<number | null>(null);
  const [history, setHistory] = useState<Cell[][][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const tableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Save to history for undo/redo
  const saveToHistory = useCallback((newData: Cell[][]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newData)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Update cell value
  const updateCell = useCallback((row: number, col: number, value: string) => {
    const newData = [...data];
    newData[row] = [...newData[row]];
    newData[row][col] = { ...newData[row][col], value };
    setData(newData);
  }, [data]);

  // Handle cell blur to save history
  const handleCellBlur = useCallback(() => {
    saveToHistory(data);
  }, [data, saveToHistory]);

  // Handle column resize
  const handleResizeStart = useCallback((e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    setIsResizing(true);
    setResizeCol(colIndex);
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || resizeCol === null || !tableRef.current) return;
    
    const table = tableRef.current;
    const tableRect = table.getBoundingClientRect();
    let accWidth = 0;
    for (let i = 0; i < resizeCol; i++) {
      accWidth += colWidths[i];
    }
    const newWidth = Math.max(30, e.clientX - tableRect.left - accWidth);
    
    const newWidths = [...colWidths];
    newWidths[resizeCol] = newWidth;
    setColWidths(newWidths);
  }, [isResizing, resizeCol, colWidths]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeCol(null);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Add row
  const addRow = useCallback((afterIndex: number) => {
    const newRow: Cell[] = Array(8).fill(null).map(() => ({ value: "" }));
    const newData = [...data];
    newData.splice(afterIndex + 1, 0, newRow);
    setData(newData);
    saveToHistory(newData);
  }, [data, saveToHistory]);

  // Delete row
  const deleteRow = useCallback((index: number) => {
    if (data.length <= 1) return;
    const newData = data.filter((_, i) => i !== index);
    setData(newData);
    saveToHistory(newData);
  }, [data, saveToHistory]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setData(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setData(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  }, [history, historyIndex]);

  // Get selection range
  const getSelectionRange = useCallback(() => {
    if (!selectionStart || !selectionEnd) return null;
    return {
      startRow: Math.min(selectionStart.row, selectionEnd.row),
      endRow: Math.max(selectionStart.row, selectionEnd.row),
      startCol: Math.min(selectionStart.col, selectionEnd.col),
      endCol: Math.max(selectionStart.col, selectionEnd.col),
    };
  }, [selectionStart, selectionEnd]);

  // Merge selected cells
  const mergeCells = useCallback(() => {
    const range = getSelectionRange();
    if (!range) return;
    
    const { startRow, endRow, startCol, endCol } = range;
    const newData = JSON.parse(JSON.stringify(data));
    
    // Collect all values
    let mergedValue = "";
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (newData[r][c].value) {
          mergedValue += (mergedValue ? " " : "") + newData[r][c].value;
        }
      }
    }
    
    // Set first cell with spans
    newData[startRow][startCol] = {
      ...newData[startRow][startCol],
      value: mergedValue,
      rowSpan: endRow - startRow + 1,
      colSpan: endCol - startCol + 1,
    };
    
    // Hide other cells
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r !== startRow || c !== startCol) {
          newData[r][c] = { ...newData[r][c], value: "", hidden: true };
        }
      }
    }
    
    setData(newData);
    saveToHistory(newData);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, [data, getSelectionRange, saveToHistory]);

  // Split merged cell
  const splitCell = useCallback(() => {
    if (!selectedCell) return;
    const cell = data[selectedCell.row][selectedCell.col];
    if (!cell.rowSpan && !cell.colSpan) return;
    
    const newData = JSON.parse(JSON.stringify(data));
    const rowSpan = cell.rowSpan || 1;
    const colSpan = cell.colSpan || 1;
    
    for (let r = selectedCell.row; r < selectedCell.row + rowSpan; r++) {
      for (let c = selectedCell.col; c < selectedCell.col + colSpan; c++) {
        newData[r][c] = {
          value: r === selectedCell.row && c === selectedCell.col ? cell.value : "",
          hidden: false,
          rowSpan: undefined,
          colSpan: undefined,
        };
      }
    }
    
    setData(newData);
    saveToHistory(newData);
  }, [data, selectedCell, saveToHistory]);

  // Check if cell is in selection
  const isInSelection = useCallback((row: number, col: number) => {
    const range = getSelectionRange();
    if (!range) return false;
    return row >= range.startRow && row <= range.endRow && 
           col >= range.startCol && col <= range.endCol;
  }, [getSelectionRange]);

  // Print function
  const handlePrint = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const totalWidth = colWidths.reduce((a, b) => a + b, 0);
    
    let tableHTML = "";
    for (let r = 0; r < data.length; r++) {
      tableHTML += "<tr>";
      for (let c = 0; c < data[r].length; c++) {
        const cell = data[r][c];
        if (cell.hidden) continue;
        
        const style = [
          `text-align: ${cell.align || "left"}`,
          cell.bold ? "font-weight: bold" : "",
          cell.fontSize ? `font-size: ${cell.fontSize}pt` : "",
          "padding: 4px 6px",
          "border: 1px solid #d1d5db",
        ].filter(Boolean).join("; ");
        
        tableHTML += `<td style="${style}"${cell.rowSpan ? ` rowspan="${cell.rowSpan}"` : ""}${cell.colSpan ? ` colspan="${cell.colSpan}"` : ""}>${cell.value}</td>`;
      }
      tableHTML += "</tr>";
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>報價單</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Noto Sans TC', sans-serif;
            font-size: 10pt;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          td {
            border: 1px solid #d1d5db;
            padding: 4px 6px;
            word-wrap: break-word;
            vertical-align: middle;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <table>${tableHTML}</table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 100);
    };
  }, [data, colWidths]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
        <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex <= 0}>
          <Undo className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1}>
          <Redo className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border" />
        <Button 
          variant="outline" 
          size="sm" 
          onClick={mergeCells}
          disabled={!selectionStart || !selectionEnd}
        >
          <Merge className="w-4 h-4 mr-1" />
          合併
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={splitCell}
          disabled={!selectedCell || (!data[selectedCell.row]?.[selectedCell.col]?.rowSpan && !data[selectedCell.row]?.[selectedCell.col]?.colSpan)}
        >
          <Split className="w-4 h-4 mr-1" />
          分割
        </Button>
        <div className="w-px h-6 bg-border" />
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => selectedCell && addRow(selectedCell.row)}
          disabled={!selectedCell}
        >
          <Plus className="w-4 h-4 mr-1" />
          插入列
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => selectedCell && deleteRow(selectedCell.row)}
          disabled={!selectedCell || data.length <= 1}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          刪除列
        </Button>
        <div className="flex-1" />
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          列印 / 另存 PDF
        </Button>
      </div>

      {/* Editor */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 bg-gray-100"
      >
        <div className="bg-white shadow-lg mx-auto" style={{ width: "210mm", minHeight: "297mm", padding: "15mm" }}>
          <table 
            ref={tableRef}
            className="w-full border-collapse"
            style={{ tableLayout: "fixed" }}
          >
            <colgroup>
              {colWidths.map((w, i) => (
                <col key={i} style={{ width: `${(w / colWidths.reduce((a, b) => a + b, 0)) * 100}%` }} />
              ))}
            </colgroup>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, colIndex) => {
                    if (cell.hidden) return null;
                    
                    const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                    const isInSel = isInSelection(rowIndex, colIndex);
                    
                    return (
                      <td
                        key={colIndex}
                        rowSpan={cell.rowSpan}
                        colSpan={cell.colSpan}
                        className={cn(
                          "border border-gray-300 p-0 relative group",
                          isSelected && "ring-2 ring-primary ring-inset",
                          isInSel && !isSelected && "bg-primary/10"
                        )}
                        onClick={() => {
                          setSelectedCell({ row: rowIndex, col: colIndex });
                          if (!selectionStart) {
                            setSelectionStart({ row: rowIndex, col: colIndex });
                          }
                        }}
                        onMouseDown={(e) => {
                          if (e.shiftKey && selectionStart) {
                            setSelectionEnd({ row: rowIndex, col: colIndex });
                          } else {
                            setSelectionStart({ row: rowIndex, col: colIndex });
                            setSelectionEnd({ row: rowIndex, col: colIndex });
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (e.buttons === 1) {
                            setSelectionEnd({ row: rowIndex, col: colIndex });
                          }
                        }}
                      >
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          className={cn(
                            "w-full min-h-[24px] px-1 py-0.5 outline-none",
                            cell.align === "center" && "text-center",
                            cell.align === "right" && "text-right",
                            cell.bold && "font-bold"
                          )}
                          style={{ fontSize: cell.fontSize ? `${cell.fontSize}pt` : undefined }}
                          onBlur={(e) => {
                            updateCell(rowIndex, colIndex, e.currentTarget.textContent || "");
                            handleCellBlur();
                          }}
                          dangerouslySetInnerHTML={{ __html: cell.value }}
                        />
                        {/* Resize handle */}
                        {colIndex < row.length - 1 && !cell.colSpan && (
                          <div
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100"
                            onMouseDown={(e) => handleResizeStart(e, colIndex)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
