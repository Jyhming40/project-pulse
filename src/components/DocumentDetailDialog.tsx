import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  ExternalLink,
  Calendar,
  User,
  Clock,
  Building2,
  AlertCircle,
  CheckCircle2,
  File,
} from 'lucide-react';
import { getDerivedDocStatus, getDerivedDocStatusColor } from '@/lib/documentStatus';

interface DocumentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
}

export function DocumentDetailDialog({
  open,
  onOpenChange,
  documentId,
}: DocumentDetailDialogProps) {
  // Fetch document with all versions
  const { data: document, isLoading } = useQuery({
    queryKey: ['document-detail', documentId],
    queryFn: async () => {
      if (!documentId) return null;
      
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          projects(project_code, project_name),
          owner:profiles!documents_owner_user_id_fkey(full_name, email)
        `)
        .eq('id', documentId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!documentId,
  });

  // Fetch all versions of the same document (same project, doc_type, title)
  const { data: versions = [] } = useQuery({
    queryKey: ['document-versions', documentId],
    queryFn: async () => {
      if (!document) return [];
      
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          owner:profiles!documents_owner_user_id_fkey(full_name, email)
        `)
        .eq('project_id', document.project_id)
        .eq('doc_type', document.doc_type)
        .eq('is_deleted', false)
        .order('version', { ascending: false });
      
      if (error) throw error;
      
      // Filter by title if exists
      if (document.title) {
        return data.filter(d => d.title === document.title);
      }
      
      return data;
    },
    enabled: open && !!document,
  });

  // Fetch files for each version
  const { data: files = [] } = useQuery({
    queryKey: ['document-files', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      
      const versionIds = versions.map(v => v.id);
      if (versionIds.length === 0) versionIds.push(documentId);
      
      const { data, error } = await supabase
        .from('document_files')
        .select('*')
        .in('document_id', versionIds)
        .eq('is_deleted', false)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open && (versions.length > 0 || !!documentId),
  });

  if (!open) return null;

  const project = document?.projects as { project_code: string; project_name: string } | null;
  const owner = document?.owner as { full_name?: string; email?: string } | null;
  const derivedStatus = document ? getDerivedDocStatus(document) : '未開始';
  const statusColor = getDerivedDocStatusColor(derivedStatus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            文件詳情
          </DialogTitle>
          <DialogDescription>
            查看文件完整資訊與歷史版本
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !document ? (
            <div className="text-center py-12 text-muted-foreground">
              找不到文件
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {document.title || document.doc_type}
                    </h3>
                    {project && (
                      <p className="text-sm text-muted-foreground mt-1">
                        <span className="font-mono">{project.project_code}</span>
                        {' '}• {project.project_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{document.doc_type}</Badge>
                    <Badge className={statusColor}>{derivedStatus}</Badge>
                  </div>
                </div>

                {document.note && (
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {document.note}
                  </p>
                )}
              </div>

              <Separator />

              {/* Key Dates */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    送件日
                  </p>
                  <p className="text-sm font-medium">
                    {document.submitted_at
                      ? format(new Date(document.submitted_at), 'yyyy/MM/dd')
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    核發日
                  </p>
                  <p className="text-sm font-medium">
                    {document.issued_at
                      ? format(new Date(document.issued_at), 'yyyy/MM/dd')
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    到期日
                  </p>
                  <p className="text-sm font-medium">
                    {document.due_at
                      ? format(new Date(document.due_at), 'yyyy/MM/dd')
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" />
                    負責人
                  </p>
                  <p className="text-sm font-medium">
                    {owner?.full_name || '-'}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Current Version & Drive Link */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-sm">
                    版本 {document.version || 1}
                  </Badge>
                  {document.is_current && (
                    <Badge variant="default" className="text-xs">
                      目前版本
                    </Badge>
                  )}
                </div>
                {document.drive_web_view_link && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(document.drive_web_view_link!, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    在 Drive 中開啟
                  </Button>
                )}
              </div>

              {/* Version History */}
              {versions.length > 1 && (
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    版本歷史 ({versions.length} 個版本)
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>版本</TableHead>
                          <TableHead>上傳時間</TableHead>
                          <TableHead>上傳者</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {versions.map((v) => {
                          const vOwner = v.owner as { full_name?: string } | null;
                          const isCurrent = v.id === document.id;
                          
                          return (
                            <TableRow key={v.id} className={isCurrent ? 'bg-primary/5' : ''}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant={isCurrent ? 'default' : 'outline'}>
                                    v{v.version || 1}
                                  </Badge>
                                  {v.is_current && (
                                    <span className="text-xs text-muted-foreground">目前</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {v.created_at
                                  ? format(new Date(v.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {vOwner?.full_name || '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {v.drive_web_view_link && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(v.drive_web_view_link!, '_blank')}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Files */}
              {files.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <File className="w-4 h-4" />
                    附件檔案 ({files.length} 個)
                  </h4>
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{file.original_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {file.file_size
                                ? `${(file.file_size / 1024 / 1024).toFixed(2)} MB`
                                : '-'}
                              {' '}•{' '}
                              {file.uploaded_at
                                ? format(new Date(file.uploaded_at), 'yyyy/MM/dd HH:mm')
                                : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-muted-foreground pt-4 border-t">
                <div className="flex flex-wrap gap-4">
                  <span>
                    建立時間：{document.created_at
                      ? format(new Date(document.created_at), 'yyyy/MM/dd HH:mm')
                      : '-'}
                  </span>
                  <span>
                    最後更新：{document.updated_at
                      ? format(new Date(document.updated_at), 'yyyy/MM/dd HH:mm')
                      : '-'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
