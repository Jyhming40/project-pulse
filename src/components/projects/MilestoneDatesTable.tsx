import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TIMELINE_DOC_MAPPING, ComparisonResult } from "@/hooks/useProjectComparison";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Check, X } from "lucide-react";

interface MilestoneDatesTableProps {
  results: ComparisonResult[];
}

export function MilestoneDatesTable({ results }: MilestoneDatesTableProps) {
  if (results.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        請選擇案件以顯示里程碑日期
      </div>
    );
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd', { locale: zhTW });
    } catch {
      return dateStr.split('T')[0];
    }
  };

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[60px] text-center">項次</TableHead>
            <TableHead className="min-w-[150px]">里程碑/文件</TableHead>
            {results.map(r => (
              <TableHead key={r.project.id} className="min-w-[110px] text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="truncate max-w-[100px]" title={r.project.project_name}>
                    {r.project.project_name.length > 8 
                      ? r.project.project_name.substring(0, 8) + '...'
                      : r.project.project_name}
                  </span>
                  {r.isBaseline && (
                    <Badge variant="destructive" className="text-xs">卡關</Badge>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {TIMELINE_DOC_MAPPING.map((mapping) => (
            <TableRow key={mapping.step} className="hover:bg-muted/30">
              <TableCell className="text-center font-medium text-muted-foreground">
                {mapping.step}
              </TableCell>
              <TableCell>
                <div className="font-medium">{mapping.short}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[140px]" title={mapping.label}>
                  {mapping.label}
                </div>
              </TableCell>
              {results.map(r => {
                const docDate = r.documentDates?.[mapping.step];
                const date = docDate?.date;
                const formattedDate = formatDate(date);
                
                return (
                  <TableCell key={r.project.id} className="text-center">
                    {formattedDate ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          <span className="text-sm font-medium">{formattedDate}</span>
                        </div>
                        {docDate?.doc_type && (
                          <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={docDate.doc_type}>
                            {docDate.doc_type.length > 8 ? docDate.doc_type.substring(0, 8) + '...' : docDate.doc_type}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <X className="h-3 w-3" />
                        <span className="text-sm">-</span>
                      </div>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
