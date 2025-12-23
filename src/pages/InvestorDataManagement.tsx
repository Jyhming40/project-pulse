import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDataExport } from '@/hooks/useDataExport';
import { useDataImport } from '@/hooks/useDataImport';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Users, 
  CreditCard, 
  Contact,
  CheckCircle,
  AlertCircle,
  FileDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type InvestorContact = Database['public']['Tables']['investor_contacts']['Row'];
type InvestorPaymentMethod = Database['public']['Tables']['investor_payment_methods']['Row'];

export default function InvestorDataManagement() {
  const { canEdit } = useAuth();
  const { 
    exportInvestorContacts, 
    exportInvestorPaymentMethods,
    downloadTemplate 
  } = useDataExport();
  const {
    previewInvestorContacts,
    previewInvestorPaymentMethods,
    importInvestorContacts,
    importInvestorPaymentMethods,
    investorContactPreview,
    investorPaymentMethodPreview,
    isProcessing,
    clearInvestorContactPreview,
    clearInvestorPaymentMethodPreview,
  } = useDataImport();

  const [activeTab, setActiveTab] = useState('export');
  const [importType, setImportType] = useState<'contacts' | 'payments'>('contacts');
  const contactsFileRef = useRef<HTMLInputElement>(null);
  const paymentsFileRef = useRef<HTMLInputElement>(null);

  // Fetch all contacts with investor info
  const { data: allContacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['all-investor-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investor_contacts')
        .select('*, investors(investor_code, company_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (InvestorContact & { investors: { investor_code: string; company_name: string } | null })[];
    },
  });

  // Fetch all payment methods with investor info
  const { data: allPaymentMethods = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['all-investor-payment-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investor_payment_methods')
        .select('*, investors(investor_code, company_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (InvestorPaymentMethod & { investors: { investor_code: string; company_name: string } | null })[];
    },
  });

  const handleExportContacts = (format: 'xlsx' | 'csv') => {
    const contactsWithInvestor = allContacts.map(c => ({
      ...c,
      investors: c.investors
    }));
    exportInvestorContacts(contactsWithInvestor as any, format);
  };

  const handleExportPayments = (format: 'xlsx' | 'csv') => {
    const paymentsWithInvestor = allPaymentMethods.map(p => ({
      ...p,
      investors: p.investors
    }));
    exportInvestorPaymentMethods(paymentsWithInvestor as any, format);
  };

  const handleContactsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await previewInvestorContacts(file);
      toast.success('檔案預覽完成');
    } catch (error) {
      toast.error('檔案讀取失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    }
    if (contactsFileRef.current) contactsFileRef.current.value = '';
  };

  const handlePaymentsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await previewInvestorPaymentMethods(file);
      toast.success('檔案預覽完成');
    } catch (error) {
      toast.error('檔案讀取失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    }
    if (paymentsFileRef.current) paymentsFileRef.current.value = '';
  };

  const handleImportContacts = async (strategy: 'skip' | 'update') => {
    if (!investorContactPreview) return;
    try {
      await importInvestorContacts(
        investorContactPreview.data,
        strategy,
        investorContactPreview.duplicates
      );
      toast.success('聯絡人匯入成功');
    } catch (error) {
      toast.error('匯入失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    }
  };

  const handleImportPayments = async (strategy: 'skip' | 'update') => {
    if (!investorPaymentMethodPreview) return;
    try {
      await importInvestorPaymentMethods(
        investorPaymentMethodPreview.data,
        strategy,
        investorPaymentMethodPreview.duplicates
      );
      toast.success('支付方式匯入成功');
    } catch (error) {
      toast.error('匯入失敗', { description: error instanceof Error ? error.message : '未知錯誤' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">投資方資料管理</h1>
        <p className="text-muted-foreground mt-1">批量匯出或匯入投資方聯絡人與支付方式資料</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            批量匯出
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            批量匯入
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Export Contacts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Contact className="w-5 h-5 text-primary" />
                  聯絡人資料
                </CardTitle>
                <CardDescription>
                  匯出所有投資方的聯絡人資料，共 {allContacts.length} 筆
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleExportContacts('xlsx')}
                    disabled={loadingContacts || allContacts.length === 0}
                    className="flex-1"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    匯出 Excel
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleExportContacts('csv')}
                    disabled={loadingContacts || allContacts.length === 0}
                    className="flex-1"
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    匯出 CSV
                  </Button>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => downloadTemplate('investor_contacts', 'xlsx')}
                  className="w-full"
                >
                  下載匯入範本
                </Button>
              </CardContent>
            </Card>

            {/* Export Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  支付方式資料
                </CardTitle>
                <CardDescription>
                  匯出所有投資方的支付方式資料，共 {allPaymentMethods.length} 筆
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleExportPayments('xlsx')}
                    disabled={loadingPayments || allPaymentMethods.length === 0}
                    className="flex-1"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    匯出 Excel
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleExportPayments('csv')}
                    disabled={loadingPayments || allPaymentMethods.length === 0}
                    className="flex-1"
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    匯出 CSV
                  </Button>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => downloadTemplate('investor_payment_methods', 'xlsx')}
                  className="w-full"
                >
                  下載匯入範本
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Summary Stats */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                資料統計
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{allContacts.length}</p>
                  <p className="text-sm text-muted-foreground">聯絡人總數</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">
                    {allContacts.filter(c => c.is_primary).length}
                  </p>
                  <p className="text-sm text-muted-foreground">主要聯絡人</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{allPaymentMethods.length}</p>
                  <p className="text-sm text-muted-foreground">支付方式總數</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">
                    {allPaymentMethods.filter(p => p.is_default).length}
                  </p>
                  <p className="text-sm text-muted-foreground">預設支付方式</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="mt-6">
          {!canEdit ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>權限不足</AlertTitle>
              <AlertDescription>您沒有匯入資料的權限</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {/* Import Type Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>選擇匯入類型</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={importType} onValueChange={(v) => setImportType(v as any)}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contacts">
                        <div className="flex items-center gap-2">
                          <Contact className="w-4 h-4" />
                          聯絡人資料
                        </div>
                      </SelectItem>
                      <SelectItem value="payments">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          支付方式資料
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Import Contacts */}
              {importType === 'contacts' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Contact className="w-5 h-5 text-primary" />
                      匯入聯絡人
                    </CardTitle>
                    <CardDescription>
                      上傳 Excel 或 CSV 檔案匯入聯絡人資料
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      <input
                        ref={contactsFileRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleContactsFileChange}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => contactsFileRef.current?.click()}
                        disabled={isProcessing}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        選擇檔案
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => downloadTemplate('investor_contacts', 'xlsx')}
                      >
                        下載範本
                      </Button>
                    </div>

                    {investorContactPreview && (
                      <div className="space-y-4">
                        {investorContactPreview.errors.length > 0 && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>發現錯誤</AlertTitle>
                            <AlertDescription>
                              <ul className="list-disc list-inside mt-2">
                                {investorContactPreview.errors.slice(0, 5).map((err, i) => (
                                  <li key={i}>{err.message}</li>
                                ))}
                                {investorContactPreview.errors.length > 5 && (
                                  <li>... 還有 {investorContactPreview.errors.length - 5} 個錯誤</li>
                                )}
                              </ul>
                            </AlertDescription>
                          </Alert>
                        )}

                        {investorContactPreview.duplicates.length > 0 && (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>發現重複資料</AlertTitle>
                            <AlertDescription>
                              {investorContactPreview.duplicates.length} 筆資料已存在
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            預覽：{investorContactPreview.data.length} 筆資料
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={clearInvestorContactPreview}
                            >
                              取消
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleImportContacts('skip')}
                              disabled={investorContactPreview.data.length === 0 || isProcessing}
                            >
                              匯入（跳過重複）
                            </Button>
                            {investorContactPreview.duplicates.length > 0 && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleImportContacts('update')}
                                disabled={isProcessing}
                              >
                                匯入（更新重複）
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>投資方編號</TableHead>
                                <TableHead>聯絡人姓名</TableHead>
                                <TableHead>職稱</TableHead>
                                <TableHead>電話</TableHead>
                                <TableHead>Email</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {investorContactPreview.data.slice(0, 10).map((row, i) => (
                                <TableRow key={i}>
                                  <TableCell>{row.investor_code}</TableCell>
                                  <TableCell>{row.contact_name}</TableCell>
                                  <TableCell>{row.title || '-'}</TableCell>
                                  <TableCell>{row.phone || row.mobile || '-'}</TableCell>
                                  <TableCell>{row.email || '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Import Payment Methods */}
              {importType === 'payments' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-primary" />
                      匯入支付方式
                    </CardTitle>
                    <CardDescription>
                      上傳 Excel 或 CSV 檔案匯入支付方式資料
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
                      <input
                        ref={paymentsFileRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handlePaymentsFileChange}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => paymentsFileRef.current?.click()}
                        disabled={isProcessing}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        選擇檔案
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => downloadTemplate('investor_payment_methods', 'xlsx')}
                      >
                        下載範本
                      </Button>
                    </div>

                    {investorPaymentMethodPreview && (
                      <div className="space-y-4">
                        {investorPaymentMethodPreview.errors.length > 0 && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>發現錯誤</AlertTitle>
                            <AlertDescription>
                              <ul className="list-disc list-inside mt-2">
                                {investorPaymentMethodPreview.errors.slice(0, 5).map((err, i) => (
                                  <li key={i}>{err.message}</li>
                                ))}
                                {investorPaymentMethodPreview.errors.length > 5 && (
                                  <li>... 還有 {investorPaymentMethodPreview.errors.length - 5} 個錯誤</li>
                                )}
                              </ul>
                            </AlertDescription>
                          </Alert>
                        )}

                        {investorPaymentMethodPreview.duplicates.length > 0 && (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>發現重複資料</AlertTitle>
                            <AlertDescription>
                              {investorPaymentMethodPreview.duplicates.length} 筆資料已存在
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            預覽：{investorPaymentMethodPreview.data.length} 筆資料
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={clearInvestorPaymentMethodPreview}
                            >
                              取消
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleImportPayments('skip')}
                              disabled={investorPaymentMethodPreview.data.length === 0 || isProcessing}
                            >
                              匯入（跳過重複）
                            </Button>
                            {investorPaymentMethodPreview.duplicates.length > 0 && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleImportPayments('update')}
                                disabled={isProcessing}
                              >
                                匯入（更新重複）
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>投資方編號</TableHead>
                                <TableHead>付款方式</TableHead>
                                <TableHead>銀行名稱</TableHead>
                                <TableHead>戶名</TableHead>
                                <TableHead>帳號</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {investorPaymentMethodPreview.data.slice(0, 10).map((row, i) => (
                                <TableRow key={i}>
                                  <TableCell>{row.investor_code}</TableCell>
                                  <TableCell>{row.method_type}</TableCell>
                                  <TableCell>{row.bank_name || '-'}</TableCell>
                                  <TableCell>{row.account_name || '-'}</TableCell>
                                  <TableCell>{row.account_number || '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
