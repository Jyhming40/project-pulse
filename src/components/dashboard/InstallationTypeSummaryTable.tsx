import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ListOrdered } from 'lucide-react';

interface InstallationTypeSummaryTableProps {
  projects: Array<{
    installation_type?: string | null;
    capacity_kwp?: number | null;
  }>;
  isLoading?: boolean;
}

export function InstallationTypeSummaryTable({ 
  projects, 
  isLoading = false 
}: InstallationTypeSummaryTableProps) {
  const tableData = useMemo(() => {
    const distribution: Record<string, { count: number; capacity: number }> = {};

    projects.forEach(p => {
      const type = p.installation_type || '未設定';
      if (!distribution[type]) {
        distribution[type] = { count: 0, capacity: 0 };
      }
      distribution[type].count += 1;
      distribution[type].capacity += p.capacity_kwp || 0;
    });

    const total = projects.length;
    const totalCapacity = projects.reduce((s, p) => s + (p.capacity_kwp || 0), 0);

    const rows = Object.entries(distribution)
      .map(([type, data]) => ({
        type,
        count: data.count,
        capacity: Math.round(data.capacity * 100) / 100,
        percentage: total > 0 ? Math.round((data.count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return { rows, total, totalCapacity: Math.round(totalCapacity * 100) / 100 };
  }, [projects]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <ListOrdered className="w-4 h-4" />
          案場類型統計
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">類型</TableHead>
                <TableHead className="text-xs text-right">數量</TableHead>
                <TableHead className="text-xs text-right">佔比</TableHead>
                <TableHead className="text-xs text-right">容量 (kWp)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.rows.map(row => (
                <TableRow key={row.type}>
                  <TableCell className="text-sm py-1.5">{row.type}</TableCell>
                  <TableCell className="text-sm text-right py-1.5 font-medium">{row.count}</TableCell>
                  <TableCell className="text-sm text-right py-1.5 text-muted-foreground">{row.percentage}%</TableCell>
                  <TableCell className="text-sm text-right py-1.5">{row.capacity.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-bold">
                <TableCell className="text-sm py-1.5">合計</TableCell>
                <TableCell className="text-sm text-right py-1.5">{tableData.total}</TableCell>
                <TableCell className="text-sm text-right py-1.5">100%</TableCell>
                <TableCell className="text-sm text-right py-1.5">{tableData.totalCapacity.toLocaleString()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
