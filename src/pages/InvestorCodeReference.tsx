import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Book, Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Investor = Database['public']['Tables']['investors']['Row'];

export default function InvestorCodeReference() {
  const [search, setSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch investors with project counts
  const { data: investors = [], isLoading } = useQuery({
    queryKey: ['investors-with-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investors')
        .select('*')
        .order('investor_code');
      if (error) throw error;
      
      // Fetch project counts for each investor
      const investorIds = data.map(inv => inv.id);
      const { data: projects } = await supabase
        .from('projects')
        .select('investor_id')
        .in('investor_id', investorIds);
      
      const countMap = new Map<string, number>();
      projects?.forEach(p => {
        if (p.investor_id) {
          countMap.set(p.investor_id, (countMap.get(p.investor_id) || 0) + 1);
        }
      });
      
      return data.map(inv => ({
        ...inv,
        projectCount: countMap.get(inv.id) || 0
      }));
    },
  });

  // Filter investors
  const filteredInvestors = investors.filter(inv => {
    const searchLower = search.toLowerCase();
    return (
      inv.company_name.toLowerCase().includes(searchLower) ||
      inv.investor_code.toLowerCase().includes(searchLower)
    );
  });

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success('已複製代碼');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error('複製失敗');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Book className="w-6 h-6 text-primary" />
            投資方代碼對照表
          </h1>
          <p className="text-muted-foreground mt-1">
            共 {investors.length} 個投資方代碼，用於案場編號自動生成
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜尋公司名稱或代碼..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Info Card */}
      <div className="bg-info/10 border border-info/20 rounded-lg p-4">
        <h3 className="font-medium text-info mb-2">案場編號規則</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• 格式：<code className="bg-muted px-1 rounded">進件年度 + 投資方代碼 + 4位流水號</code></li>
          <li>• 範例：<code className="bg-muted px-1 rounded">2025YP0001</code>（2025年永沛第1案）</li>
          <li>• 同意備案後：<code className="bg-muted px-1 rounded">2025YP0001-2026</code>（加上備案年度）</li>
        </ul>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">代碼</TableHead>
              <TableHead>公司名稱</TableHead>
              <TableHead className="w-[100px] text-center">案場數</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  載入中...
                </TableCell>
              </TableRow>
            ) : filteredInvestors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  {search ? '無符合的搜尋結果' : '暫無資料'}
                </TableCell>
              </TableRow>
            ) : (
              filteredInvestors.map(investor => (
                <TableRow key={investor.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-sm">
                      {investor.investor_code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{investor.company_name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="min-w-[40px]">
                      {investor.projectCount}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyCode(investor.investor_code)}
                    >
                      {copiedCode === investor.investor_code ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
