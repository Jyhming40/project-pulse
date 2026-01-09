import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Play, Trash2, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'pending' | 'running';
  message: string;
  errorCode?: string;
  details?: string;
}

interface DocumentRecord {
  id: string;
  doc_type: string;
  version: number | null;
  is_current: boolean | null;
  is_deleted: boolean | null;
  is_archived: boolean | null;
  created_at: string;
}

const TEST_PROJECT_CODE = '__DEV_VERIFICATION_PROJECT__';

export default function DevVerification() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [testProjectId, setTestProjectId] = useState<string | null>(null);
  const [documentsBefore, setDocumentsBefore] = useState<DocumentRecord[]>([]);
  const [documentsAfter, setDocumentsAfter] = useState<DocumentRecord[]>([]);
  const [cleanupStatus, setCleanupStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const updateResult = (name: string, update: Partial<TestResult>) => {
    setResults(prev => prev.map(r => r.name === name ? { ...r, ...update } : r));
  };

  const addResult = (result: TestResult) => {
    setResults(prev => [...prev, result]);
  };

  // Helper: Get or create test project
  const getOrCreateTestProject = async (): Promise<string> => {
    // Check if test project exists
    const { data: existing, error: findError } = await supabase
      .from('projects')
      .select('id')
      .eq('project_code', TEST_PROJECT_CODE)
      .eq('is_deleted', false)
      .limit(1);

    if (findError) throw findError;

    if (existing && existing.length > 0) {
      return existing[0].id;
    }

    // Create test project - need to get a valid investor first
    const { data: investors, error: invError } = await supabase
      .from('investors')
      .select('id')
      .eq('is_deleted', false)
      .limit(1);

    if (invError) throw invError;

    const investorId = investors?.[0]?.id || null;

    const { data: newProject, error: createError } = await supabase
      .from('projects')
      .insert({
        project_code: TEST_PROJECT_CODE,
        project_name: '開發驗收測試專案（自動建立，可刪除）',
        status: '開發中',
        investor_id: investorId,
      })
      .select('id')
      .single();

    if (createError) throw createError;
    return newProject.id;
  };

  // Helper: Cleanup test documents
  const cleanupTestDocuments = async (projectId: string) => {
    const { error } = await supabase
      .from('documents')
      .update({ is_deleted: true })
      .eq('project_id', projectId);

    if (error) {
      setCleanupStatus('error');
      throw error;
    }
    setCleanupStatus('success');
  };

  // Helper: Get documents snapshot
  const getDocumentsSnapshot = async (projectId: string): Promise<DocumentRecord[]> => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, doc_type, version, is_current, is_deleted, is_archived, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as DocumentRecord[];
  };

  // Test 1: doc_type CHECK constraint
  const runTest1 = async (projectId: string) => {
    const testName = '測試 1：doc_type CHECK constraint';
    updateResult(testName, { status: 'running' });

    try {
      // 1a: Try invalid doc_type (should FAIL)
      const { error: invalidError } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          doc_type: '台電躉售合約', // Invalid - should be just '躉售合約'
        });

      if (!invalidError) {
        updateResult(testName, {
          status: 'fail',
          message: 'CHECK constraint 未生效：非法值「台電躉售合約」被接受',
          details: '應該拒絕帶機關前綴的長值',
        });
        return false;
      }

      // 1b: Try valid doc_type (should PASS)
      const { data: validDoc, error: validError } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          doc_type: '躉售合約', // Valid short value
        })
        .select('id')
        .single();

      if (validError) {
        updateResult(testName, {
          status: 'fail',
          message: '合法值「躉售合約」被拒絕',
          errorCode: validError.code,
          details: validError.message,
        });
        return false;
      }

      // Cleanup
      await supabase.from('documents').update({ is_deleted: true }).eq('id', validDoc.id);

      updateResult(testName, {
        status: 'pass',
        message: 'CHECK constraint 正常：非法值被拒絕，合法值被接受',
        errorCode: invalidError.code,
        details: `非法值錯誤：${invalidError.message}`,
      });
      return true;
    } catch (error: any) {
      updateResult(testName, {
        status: 'fail',
        message: '測試執行錯誤',
        details: error.message,
      });
      return false;
    }
  };

  // Test 2: partial unique index (one current per key)
  const runTest2 = async (projectId: string) => {
    const testName = '測試 2：partial unique index (one current per key)';
    updateResult(testName, { status: 'running' });

    try {
      // Insert A with is_current=true (should PASS)
      const { data: docA, error: errorA } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          doc_type: '躉售合約',
          is_current: true,
          version: 100, // Use high version to avoid conflict with other tests
        })
        .select('id')
        .single();

      if (errorA) {
        updateResult(testName, {
          status: 'fail',
          message: '第一筆 is_current=true 插入失敗',
          errorCode: errorA.code,
          details: errorA.message,
        });
        return false;
      }

      // Insert B with is_current=true (should FAIL with 23505)
      const { error: errorB } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          doc_type: '躉售合約',
          is_current: true,
          version: 101,
        });

      // Cleanup A
      await supabase.from('documents').update({ is_deleted: true }).eq('id', docA.id);

      if (!errorB) {
        updateResult(testName, {
          status: 'fail',
          message: 'Partial unique index 未生效：同時允許兩筆 is_current=true',
          details: '應該只能有一筆 is_current=true（同 project_id + doc_type）',
        });
        return false;
      }

      if (errorB.code !== '23505') {
        updateResult(testName, {
          status: 'fail',
          message: `預期錯誤碼 23505，實際為 ${errorB.code}`,
          errorCode: errorB.code,
          details: errorB.message,
        });
        return false;
      }

      updateResult(testName, {
        status: 'pass',
        message: 'Partial unique index 正常：第二筆 is_current=true 被拒絕',
        errorCode: errorB.code,
        details: `拒絕原因：${errorB.message}`,
      });
      return true;
    } catch (error: any) {
      updateResult(testName, {
        status: 'fail',
        message: '測試執行錯誤',
        details: error.message,
      });
      return false;
    }
  };

  // Test 3: version unique index
  const runTest3 = async (projectId: string) => {
    const testName = '測試 3：version unique index';
    updateResult(testName, { status: 'running' });

    try {
      // Insert version=200 (should PASS)
      const { data: doc1, error: error1 } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          doc_type: '躉售合約',
          version: 200,
          is_current: false,
        })
        .select('id')
        .single();

      if (error1) {
        updateResult(testName, {
          status: 'fail',
          message: '第一筆 version=200 插入失敗',
          errorCode: error1.code,
          details: error1.message,
        });
        return false;
      }

      // Insert another version=200 (should FAIL with 23505)
      const { error: error2 } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          doc_type: '躉售合約',
          version: 200,
          is_current: false,
        });

      // Cleanup
      await supabase.from('documents').update({ is_deleted: true }).eq('id', doc1.id);

      if (!error2) {
        updateResult(testName, {
          status: 'fail',
          message: 'Version unique index 未生效：允許重複 version',
          details: '同 project_id + doc_type 不應允許重複 version',
        });
        return false;
      }

      if (error2.code !== '23505') {
        updateResult(testName, {
          status: 'fail',
          message: `預期錯誤碼 23505，實際為 ${error2.code}`,
          errorCode: error2.code,
          details: error2.message,
        });
        return false;
      }

      updateResult(testName, {
        status: 'pass',
        message: 'Version unique index 正常：重複 version 被拒絕',
        errorCode: error2.code,
        details: `拒絕原因：${error2.message}`,
      });
      return true;
    } catch (error: any) {
      updateResult(testName, {
        status: 'fail',
        message: '測試執行錯誤',
        details: error.message,
      });
      return false;
    }
  };

  // Test 4: Three-stage write (current window safety)
  const runTest4 = async (projectId: string, simulateFail: boolean) => {
    const testName = simulateFail 
      ? '測試 4b：三段式寫入（故意失敗模式）' 
      : '測試 4a：三段式寫入（正常模式）';
    updateResult(testName, { status: 'running' });

    const docType = '同意備案'; // Use different doc_type to avoid conflict
    let newDocId: string | null = null;

    try {
      // Take snapshot before
      const before = await getDocumentsSnapshot(projectId);
      const beforeFiltered = before.filter(d => d.doc_type === docType && !d.is_deleted);
      setDocumentsBefore(beforeFiltered);

      // Stage 1: Get fresh version
      const { data: versionData, error: versionError } = await supabase
        .from('documents')
        .select('version')
        .eq('project_id', projectId)
        .eq('doc_type', docType)
        .eq('is_deleted', false)
        .order('version', { ascending: false })
        .limit(1);

      if (versionError) throw versionError;

      const freshVersion = (versionData && versionData.length > 0 && versionData[0].version)
        ? versionData[0].version + 1
        : 1;

      // Stage 2: Insert with is_current=false
      const { data: docData, error: insertError } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          doc_type: docType,
          version: freshVersion,
          is_current: false,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      newDocId = docData.id;

      // Stage 3a: Clear old current
      const { error: clearError } = await supabase
        .from('documents')
        .update({ is_current: false })
        .eq('project_id', projectId)
        .eq('doc_type', docType)
        .eq('is_current', true)
        .eq('is_deleted', false)
        .eq('is_archived', false);

      if (clearError) {
        // Rollback
        await supabase.from('documents').update({ is_deleted: true }).eq('id', newDocId).eq('is_deleted', false);
        throw clearError;
      }

      // Stage 3b: Set new current (with optional simulated failure)
      if (simulateFail) {
        // Simulate failure by using impossible condition
        const { error: setCurrentError } = await supabase
          .from('documents')
          .update({ is_current: true })
          .eq('id', 'impossible-uuid-that-does-not-exist') // Will match 0 rows
          .eq('is_deleted', false)
          .eq('is_archived', false);

        // This won't error, but it won't update anything either
        // Check if our doc is still is_current=false (it should be)
        const { data: checkDoc } = await supabase
          .from('documents')
          .select('is_current')
          .eq('id', newDocId)
          .single();

        if (!checkDoc?.is_current) {
          // Rollback: mark new doc as deleted
          await supabase.from('documents').update({ is_deleted: true }).eq('id', newDocId).eq('is_deleted', false);

          // Take snapshot after
          const after = await getDocumentsSnapshot(projectId);
          const afterFiltered = after.filter(d => d.doc_type === docType);
          setDocumentsAfter(afterFiltered);

          // Count current
          const currentCountAfter = afterFiltered.filter(d => d.is_current && !d.is_deleted).length;

          // In failure mode, we expect:
          // 1. New doc is marked deleted
          // 2. Old current should still be current (if there was one)
          const newDocAfter = afterFiltered.find(d => d.id === newDocId);
          const oldCurrentStillExists = beforeFiltered.some(d => d.is_current);

          if (newDocAfter?.is_deleted === true) {
            updateResult(testName, {
              status: 'pass',
              message: 'Rollback 成功：新 doc 已標記 is_deleted=true',
              details: `測試後 current 筆數：${currentCountAfter}，舊 current 是否存在：${oldCurrentStillExists ? '是' : '無舊 current'}`,
            });
            return true;
          } else {
            updateResult(testName, {
              status: 'fail',
              message: 'Rollback 失敗：新 doc 未被標記刪除',
              details: `新 doc is_deleted=${newDocAfter?.is_deleted}`,
            });
            return false;
          }
        }
      } else {
        // Normal mode: set current
        const { error: setCurrentError } = await supabase
          .from('documents')
          .update({ is_current: true })
          .eq('id', newDocId)
          .eq('is_deleted', false)
          .eq('is_archived', false);

        if (setCurrentError) {
          await supabase.from('documents').update({ is_deleted: true }).eq('id', newDocId).eq('is_deleted', false);
          throw setCurrentError;
        }
      }

      // Take snapshot after
      const after = await getDocumentsSnapshot(projectId);
      const afterFiltered = after.filter(d => d.doc_type === docType && !d.is_deleted);
      setDocumentsAfter(afterFiltered);

      // Verify: exactly 1 current
      const currentCount = afterFiltered.filter(d => d.is_current).length;

      if (currentCount !== 1) {
        updateResult(testName, {
          status: 'fail',
          message: `Current 筆數異常：預期 1，實際 ${currentCount}`,
          details: afterFiltered.map(d => `v${d.version}: current=${d.is_current}`).join(', '),
        });
        return false;
      }

      updateResult(testName, {
        status: 'pass',
        message: `三段式寫入成功：恆有且僅有 1 筆 is_current=true`,
        details: `版本分布：${afterFiltered.map(d => `v${d.version}`).join(', ')}`,
      });
      return true;
    } catch (error: any) {
      // Rollback if needed
      if (newDocId) {
        await supabase.from('documents').update({ is_deleted: true }).eq('id', newDocId).eq('is_deleted', false);
      }

      updateResult(testName, {
        status: 'fail',
        message: '測試執行錯誤',
        details: error.message,
      });
      return false;
    }
  };

  // Run all tests
  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);
    setCleanupStatus('idle');
    setDocumentsBefore([]);
    setDocumentsAfter([]);

    // Initialize results
    const testNames = [
      '測試 1：doc_type CHECK constraint',
      '測試 2：partial unique index (one current per key)',
      '測試 3：version unique index',
      simulateFailure ? '測試 4b：三段式寫入（故意失敗模式）' : '測試 4a：三段式寫入（正常模式）',
    ];
    testNames.forEach(name => addResult({ name, status: 'pending', message: '等待執行...' }));

    try {
      // Get or create test project
      const projectId = await getOrCreateTestProject();
      setTestProjectId(projectId);

      // Run tests sequentially
      await runTest1(projectId);
      await runTest2(projectId);
      await runTest3(projectId);
      await runTest4(projectId, simulateFailure);

      // Cleanup
      await cleanupTestDocuments(projectId);
    } catch (error: any) {
      console.error('Test suite error:', error);
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'running':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const allPassed = results.length > 0 && results.every(r => r.status === 'pass');
  const anyFailed = results.some(r => r.status === 'fail');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import Batch 黑箱驗收</h1>
          <p className="text-muted-foreground">開發用驗證頁面（僅限開發環境）</p>
        </div>
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          DEV ONLY
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>測試控制</CardTitle>
          <CardDescription>設定測試參數並執行驗收</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="simulate-failure"
                checked={simulateFailure}
                onCheckedChange={setSimulateFailure}
                disabled={isRunning}
              />
              <Label htmlFor="simulate-failure">
                模擬 Stage 3b 失敗（測試 rollback 機制）
              </Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={runAllTests} disabled={isRunning}>
              {isRunning ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  執行中...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  執行全部測試
                </>
              )}
            </Button>
          </div>

          {testProjectId && (
            <p className="text-sm text-muted-foreground">
              測試專案 ID: <code className="bg-muted px-1 rounded">{testProjectId}</code>
            </p>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>測試結果</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span className="font-medium">{result.name}</span>
                      <Badge variant={result.status === 'pass' ? 'default' : result.status === 'fail' ? 'destructive' : 'secondary'}>
                        {result.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm">{result.message}</p>
                    {result.errorCode && (
                      <p className="text-xs text-muted-foreground">
                        錯誤碼: <code className="bg-muted px-1 rounded">{result.errorCode}</code>
                      </p>
                    )}
                    {result.details && (
                      <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        {result.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {(documentsBefore.length > 0 || documentsAfter.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>測試 4 文件快照</CardTitle>
            <CardDescription>三段式寫入前後的 documents 狀態</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">測試前</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Deleted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentsBefore.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">無記錄</TableCell>
                    </TableRow>
                  ) : (
                    documentsBefore.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell>v{doc.version}</TableCell>
                        <TableCell>{doc.is_current ? '✓' : '-'}</TableCell>
                        <TableCell>{doc.is_deleted ? '✓' : '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div>
              <h4 className="font-medium mb-2">測試後</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Current</TableHead>
                    <TableHead>Deleted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentsAfter.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">無記錄</TableCell>
                    </TableRow>
                  ) : (
                    documentsAfter.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell>v{doc.version}</TableCell>
                        <TableCell>{doc.is_current ? '✓' : '-'}</TableCell>
                        <TableCell>{doc.is_deleted ? '✓' : '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {cleanupStatus !== 'idle' && (
        <Alert variant={cleanupStatus === 'success' ? 'default' : 'destructive'}>
          <Trash2 className="h-4 w-4" />
          <AlertTitle>清理狀態</AlertTitle>
          <AlertDescription>
            {cleanupStatus === 'success' 
              ? '測試文件已成功標記為 is_deleted=true' 
              : '清理失敗，請手動檢查'}
          </AlertDescription>
        </Alert>
      )}

      {results.length > 0 && !isRunning && (
        <Card className={allPassed ? 'border-green-500' : anyFailed ? 'border-destructive' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {allPassed ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  驗收結論：PASS
                </>
              ) : anyFailed ? (
                <>
                  <XCircle className="h-6 w-6 text-destructive" />
                  驗收結論：FAIL
                </>
              ) : (
                <>
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                  驗收進行中
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allPassed ? (
              <p className="text-green-700">
                ✅ 所有測試通過，Import Batch MVP 可以進入交付階段。
              </p>
            ) : anyFailed ? (
              <p className="text-destructive">
                ❌ 部分測試失敗，請檢查上方詳細結果並修復問題。
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
