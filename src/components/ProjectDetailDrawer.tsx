import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { getDerivedDocStatus, getDerivedDocStatusColor } from '@/lib/documentStatus';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  Building2,
  MapPin,
  Zap,
  User,
  Phone,
  Calendar,
  FileText,
  ExternalLink,
  X,
  Plug,
  Wrench,
  HardHat,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ProjectConstructionAssignments from '@/components/ProjectConstructionAssignments';
import { ProjectMilestones } from '@/components/ProjectMilestones';

interface ProjectDetailDrawerProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Dynamic status color mapping
const getStatusColor = (status: string) => {
  const statusColorMap: Record<string, string> = {
    '開發中': 'bg-info/15 text-info',
    '土地確認': 'bg-warning/15 text-warning',
    '結構簽證': 'bg-primary/15 text-primary',
    '台電送件': 'bg-info/15 text-info',
    '台電審查': 'bg-warning/15 text-warning',
    '能源局送件': 'bg-info/15 text-info',
    '同意備案': 'bg-success/15 text-success',
    '工程施工': 'bg-primary/15 text-primary',
    '報竣掛表': 'bg-info/15 text-info',
    '設備登記': 'bg-success/15 text-success',
    '運維中': 'bg-success/15 text-success',
    '暫停': 'bg-muted text-muted-foreground',
    '取消': 'bg-destructive/15 text-destructive',
  };
  return statusColorMap[status] || 'bg-muted text-muted-foreground';
};

// Document status is now derived from dates - use getDerivedDocStatus from lib

const getConstructionStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    '已開工': 'bg-primary/15 text-primary',
    '尚未開工': 'bg-muted text-muted-foreground',
    '已掛錶': 'bg-success/15 text-success',
    '待掛錶': 'bg-warning/15 text-warning',
    '暫緩': 'bg-muted text-muted-foreground',
    '取消': 'bg-destructive/15 text-destructive',
  };
  return colorMap[status] || 'bg-muted text-muted-foreground';
};

export function ProjectDetailDrawer({ projectId, open, onOpenChange }: ProjectDetailDrawerProps) {
  const navigate = useNavigate();

  // Fetch project
  const { data: project, isLoading } = useQuery({
    queryKey: ['project-drawer', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('*, investors(company_name, contact_person, phone, email)')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && open,
  });

  // Fetch status history
  const { data: statusHistory = [] } = useQuery({
    queryKey: ['project-status-history-drawer', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_status_history')
        .select('*, profiles(full_name, email)')
        .eq('project_id', projectId)
        .order('changed_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && open,
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ['project-documents-drawer', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('documents')
        .select('*, owner:profiles!documents_owner_user_id_fkey(full_name, email)')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && open,
  });

  const investor = project?.investors as any;

  const handleGoToFullPage = () => {
    onOpenChange(false);
    navigate(`/projects/${projectId}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[540px] md:w-[640px] lg:w-[720px] xl:w-[800px] p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {isLoading || !project ? (
                  <div className="space-y-2">
                    <div className="h-6 w-48 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  </div>
                ) : (
                  <>
                    <SheetTitle className="text-lg font-display font-bold text-foreground flex items-center gap-2 flex-wrap">
                      {project.project_name}
                      <Badge className={getStatusColor(project.status)} variant="secondary">
                        {project.status}
                      </Badge>
                      {(project as any).construction_status && (
                        <Badge className={getConstructionStatusColor((project as any).construction_status)} variant="secondary">
                          施工：{(project as any).construction_status}
                        </Badge>
                      )}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(project as any).site_code_display || project.project_code} • {project.city} {project.district}
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={handleGoToFullPage}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  完整頁
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Content */}
          <ScrollArea className="flex-1">
            {isLoading || !project ? (
              <div className="p-6 space-y-4">
                <div className="h-32 bg-muted animate-pulse rounded" />
                <div className="h-32 bg-muted animate-pulse rounded" />
              </div>
            ) : (
              <Tabs defaultValue="basic" className="w-full">
                <div className="px-6 pt-4 border-b sticky top-0 bg-background z-10">
                  <TabsList className="flex flex-wrap h-auto gap-1 w-full justify-start">
                    <TabsTrigger value="basic" className="text-xs">基本資料</TabsTrigger>
                    <TabsTrigger value="technical" className="text-xs">技術 / 設備</TabsTrigger>
                    <TabsTrigger value="admin-progress" className="text-xs">行政流程</TabsTrigger>
                    <TabsTrigger value="financial" className="text-xs">金流 / 投資</TabsTrigger>
                    <TabsTrigger value="documents" className="text-xs">關聯文件</TabsTrigger>
                  </TabsList>
                </div>

                {/* 基本資料 Tab */}
                <TabsContent value="basic" className="p-6 space-y-4 mt-0">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        案場資訊
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">案場編號</p>
                          <p className="font-mono font-medium text-primary">
                            {(project as any).site_code_display || project.project_code}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">進件年度</p>
                          <p>{(project as any).intake_year || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">業績年度</p>
                          <p>{project.fiscal_year || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">裝置類型</p>
                          <p>{(project as any).installation_type || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">同意備案日期</p>
                          <p>{(project as any).approval_date || '-'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">地址</p>
                        <p className="text-sm flex items-start gap-1">
                          <MapPin className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                          {project.address || '-'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 聯絡資訊 */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        聯絡資訊
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">聯絡人</p>
                          <p>{project.contact_person || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">聯絡電話</p>
                          <p>{project.contact_phone || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">土地所有權人</p>
                          <p>{project.land_owner || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">所有權人電話</p>
                          <p>{project.land_owner_contact || '-'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 投資方資訊 */}
                  {investor && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Zap className="w-4 h-4 text-primary" />
                          投資方資訊
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">公司名稱</p>
                            <p className="font-medium">{investor.company_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">聯絡人</p>
                            <p>{investor.contact_person || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">電話</p>
                            <p>{investor.phone || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="text-xs truncate">{investor.email || '-'}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* 技術 / 設備資料 Tab */}
                <TabsContent value="technical" className="p-6 space-y-4 mt-0">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        容量與設備
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">設計容量 (kWp)</p>
                          <p className="font-medium">{project.capacity_kwp || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">實際裝置容量 (kWp)</p>
                          <p className="font-medium">{(project as any).actual_installed_capacity || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">饋線代號</p>
                          <p>{project.feeder_code || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">台電 PV 編號</p>
                          <p className="font-mono text-xs">{(project as any).taipower_pv_id || '-'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Plug className="w-4 h-4 text-primary" />
                        電力規格
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">併聯方式</p>
                          <p>{(project as any).grid_connection_type || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">供電模式</p>
                          <p>{(project as any).power_phase_type || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">供電電壓</p>
                          <p>{(project as any).power_voltage || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">立桿狀態</p>
                          <p>{(project as any).pole_status || '-'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 施工派工 */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <HardHat className="w-4 h-4 text-primary" />
                        施工派工
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ProjectConstructionAssignments projectId={projectId!} />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 行政流程 / 進度 Tab */}
                <TabsContent value="admin-progress" className="p-6 space-y-4 mt-0">

                  {/* 里程碑 - 不再重複顯示進度條 */}
                  <ProjectMilestones 
                    projectId={projectId!} 
                    adminProgress={(project as any).admin_progress || 0}
                    engineeringProgress={(project as any).engineering_progress || 0}
                    overallProgress={(project as any).overall_progress || 0}
                    adminStage={(project as any).admin_stage}
                    engineeringStage={(project as any).engineering_stage}
                  />

                  {/* 狀態歷史 */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        近期狀態變更
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {statusHistory.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">暫無狀態歷史</p>
                      ) : (
                        <div className="space-y-2">
                          {statusHistory.map((history: any) => (
                            <div key={history.id} className="flex items-start gap-2 text-xs">
                              <Badge className={`${getStatusColor(history.status)} text-xs`} variant="secondary">
                                {history.status}
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <p className="text-muted-foreground truncate">
                                  {history.profiles?.full_name || '系統'}
                                </p>
                                {history.note && (
                                  <p className="text-muted-foreground truncate">{history.note}</p>
                                )}
                              </div>
                              <span className="text-muted-foreground flex-shrink-0">
                                {format(new Date(history.changed_at), 'MM/dd', { locale: zhTW })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 金流 / 投資資訊 Tab */}
                <TabsContent value="financial" className="p-6 space-y-4 mt-0">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        投資方摘要
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {investor ? (
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">公司名稱</p>
                            <p className="font-medium">{investor.company_name}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">聯絡人</p>
                              <p>{investor.contact_person || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="truncate">{investor.email || '-'}</p>
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => {
                              onOpenChange(false);
                              navigate(`/investors`);
                            }}
                          >
                            檢視完整投資方資料
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-4">尚未關聯投資方</p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">
                      詳細金流與投報資訊請前往
                    </p>
                    <Button 
                      variant="link" 
                      className="h-auto p-0 mt-1"
                      onClick={handleGoToFullPage}
                    >
                      完整案場頁面
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </TabsContent>

                {/* 關聯文件 Tab */}
                <TabsContent value="documents" className="p-6 space-y-4 mt-0">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        案場文件 ({documents.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {documents.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">尚無文件</p>
                      ) : (
                        <div className="space-y-2">
                          {documents.map((doc: any) => {
                            const derivedStatus = getDerivedDocStatus(doc);
                            return (
                            <div 
                              key={doc.id} 
                              className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm truncate">{doc.doc_type}</span>
                              </div>
                              <Badge className={`${getDerivedDocStatusColor(derivedStatus)} text-xs flex-shrink-0`} variant="secondary">
                                {derivedStatus}
                              </Badge>
                            </div>
                            );
                          })}
                        </div>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-3"
                        onClick={handleGoToFullPage}
                      >
                        檢視完整文件列表
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
