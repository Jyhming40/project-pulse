import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, FileText, Calculator, Calendar, TrendingUp, Eye, Pencil, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/quoteCalculations";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

// Temporary type until DB table is created
interface QuoteData {
  id: string;
  quote_number: string;
  project_id: string | null;
  investor_id: string | null;
  capacity_kwp: number | null;
  total_price_with_tax: number | null;
  irr_20_year: number | null;
  quote_status: string;
  created_at: string;
  project?: { site_name: string; site_code_display: string } | null;
  investor?: { company_name: string; investor_code: string } | null;
}

export default function Quotes() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Placeholder data until DB table is created
  const quotes: QuoteData[] = [];
  const isLoading = false;

  // Delete mutation - placeholder until DB table is created
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Will be implemented after DB table is created
      toast.info("資料庫表尚未建立");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-quotes"] });
      toast.success("報價單已刪除");
    },
    onError: () => {
      toast.error("刪除失敗");
    },
  });

  const filteredQuotes = quotes?.filter(
    (q) =>
      q.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.project?.site_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.investor?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">草稿</Badge>;
      case "sent":
        return <Badge variant="default">已發送</Badge>;
      case "accepted":
        return <Badge className="bg-success text-success-foreground">已接受</Badge>;
      case "rejected":
        return <Badge variant="destructive">已拒絕</Badge>;
      case "expired":
        return <Badge variant="outline">已過期</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleCreate = () => {
    navigate("/quotes/new");
  };

  const handleEdit = (id: string) => {
    navigate(`/quotes/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">報價管理</h1>
          <p className="text-muted-foreground">管理案場報價單、成本計算與投資評估</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          新增報價
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">報價總數</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quotes?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">待審核</CardTitle>
            <Calculator className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quotes?.filter((q) => q.quote_status === "sent").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已成交</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {quotes?.filter((q) => q.quote_status === "accepted").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">總報價金額</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                quotes?.reduce((sum, q) => sum + (q.total_price_with_tax || 0), 0) || 0,
                0
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋報價單號、案場名稱、投資方..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>報價單號</TableHead>
                <TableHead>案場</TableHead>
                <TableHead>投資方</TableHead>
                <TableHead className="text-right">容量 (kWp)</TableHead>
                <TableHead className="text-right">報價金額</TableHead>
                <TableHead className="text-right">IRR</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>建立日期</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    載入中...
                  </TableCell>
                </TableRow>
              ) : filteredQuotes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    尚無報價資料
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuotes?.map((quote) => (
                  <TableRow key={quote.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{quote.quote_number}</TableCell>
                    <TableCell>
                      {quote.project?.site_name || (
                        <span className="text-muted-foreground">未關聯</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {quote.investor?.company_name || (
                        <span className="text-muted-foreground">未關聯</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{quote.capacity_kwp?.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(quote.total_price_with_tax || 0, 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {quote.irr_20_year ? `${quote.irr_20_year.toFixed(2)}%` : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(quote.quote_status)}</TableCell>
                    <TableCell>
                      {format(new Date(quote.created_at), "yyyy/MM/dd", { locale: zhTW })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(quote.id)}>
                            <Eye className="w-4 h-4 mr-2" />
                            檢視 / 編輯
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info("資料庫表尚未建立")}>
                            <Copy className="w-4 h-4 mr-2" />
                            複製報價
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(quote.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              刪除
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
