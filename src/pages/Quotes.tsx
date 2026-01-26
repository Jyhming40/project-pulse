import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import QuoteEditorDialog from "@/components/quotes/QuoteEditorDialog";

export default function Quotes() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Fetch quotes
  const { data: quotes, isLoading } = useQuery({
    queryKey: ["project-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_quotes")
        .select(`
          *,
          project:projects(site_name, site_code_display),
          investor:investors(company_name, investor_code)
        `)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_quotes")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
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
    setSelectedQuoteId(null);
    setEditorOpen(true);
  };

  const handleEdit = (id: string) => {
    setSelectedQuoteId(id);
    setEditorOpen(true);
  };

  const handleDuplicate = async (quote: any) => {
    // Generate new quote number
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from("project_quotes")
      .select("*", { count: "exact", head: true })
      .ilike("quote_number", `Q-${year}-%`);
    
    const newNumber = `Q-${year}-${String((count || 0) + 1).padStart(3, "0")}`;

    const { id, quote_number, created_at, updated_at, ...rest } = quote;
    const { error } = await supabase.from("project_quotes").insert({
      ...rest,
      quote_number: newNumber,
      quote_status: "draft",
    });

    if (error) {
      toast.error("複製失敗");
    } else {
      queryClient.invalidateQueries({ queryKey: ["project-quotes"] });
      toast.success("報價單已複製");
    }
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
                          <DropdownMenuItem onClick={() => handleDuplicate(quote)}>
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

      {/* Quote Editor Dialog */}
      <QuoteEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        quoteId={selectedQuoteId}
      />
    </div>
  );
}
