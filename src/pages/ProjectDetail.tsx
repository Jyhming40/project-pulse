import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDriveAuth } from '@/hooks/useDriveAuth';
import { useOptionsForCategory } from '@/hooks/useSystemOptions';
import { CodebookSelect } from '@/components/CodebookSelect';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Zap,
  User,
  Phone,
  Calendar,
  FileText,
  History,
  Plus,
  Upload,
  Download,
  Trash2,
  Edit,
  X,
  FolderOpen,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Link,
  Wrench,
  Plug,
  HardHat
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import ProjectConstructionAssignments from '@/components/ProjectConstructionAssignments';
import { ProjectMilestones } from '@/components/ProjectMilestones';

type ProjectStatus = Database['public']['Enums']['project_status'];
type DocType = Database['public']['Enums']['doc_type'];
type DocStatus = Database['public']['Enums']['doc_status'];

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

const getDocStatusColor = (status: string) => {
  const docStatusColorMap: Record<string, string> = {
    '未開始': 'bg-muted text-muted-foreground',
    '進行中': 'bg-info/15 text-info',
    '已完成': 'bg-success/15 text-success',
    '退件補正': 'bg-warning/15 text-warning',
  };
  return docStatusColorMap[status] || 'bg-muted text-muted-foreground';
};

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

// Hardcoded arrays removed - now using CodebookSelect component which reads from system_options table

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit, isAdmin, user } = useAuth();
  const { isAuthorized: isDriveAuthorized, isLoading: isDriveLoading, authorize: authorizeDrive, isAuthorizing } = useDriveAuth();
  const queryClient = useQueryClient();

  // Fetch dynamic options
  const { options: statusOptions } = useOptionsForCategory('project_status');
  const { options: docTypeOptions } = useOptionsForCategory('doc_type');
  const { options: docStatusOptions } = useOptionsForCategory('doc_status');

  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [isAddStatusOpen, setIsAddStatusOpen] = useState(false);
  const [isEditConstructionOpen, setIsEditConstructionOpen] = useState(false);
  const [isEditApprovalDateOpen, setIsEditApprovalDateOpen] = useState(false);
  const [approvalDateForm, setApprovalDateForm] = useState('');
  const [docForm, setDocForm] = useState<{
    doc_type?: DocType;
    doc_status?: DocStatus;
    submitted_at?: string;
    issued_at?: string;
    due_at?: string;
    note?: string;
  }>({});
  const [statusForm, setStatusForm] = useState<{
    status?: ProjectStatus;
    note?: string;
  }>({});
  const [constructionForm, setConstructionForm] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Fetch project
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, investors(company_name, contact_person, phone, email)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch status history
  const { data: statusHistory = [] } = useQuery({
    queryKey: ['project-status-history', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_status_history')
        .select('*, profiles(full_name, email)')
        .eq('project_id', id)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch construction status history
  const { data: constructionHistory = [] } = useQuery({
    queryKey: ['construction-status-history', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('construction_status_history')
        .select('*, profiles:changed_by(full_name, email)')
        .eq('project_id', id)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ['project-documents', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*, owner:profiles!documents_owner_user_id_fkey(full_name, email)')
        .eq('project_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch document files
  const { data: documentFiles = [] } = useQuery({
    queryKey: ['project-document-files', id],
    queryFn: async () => {
      const docIds = documents.map(d => d.id);
      if (docIds.length === 0) return [];
      const { data, error } = await supabase
        .from('document_files')
        .select('*')
        .in('document_id', docIds);
      if (error) throw error;
      return data;
    },
    enabled: documents.length > 0,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: ProjectStatus) => {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-status-history', id] });
      toast.success('狀態已更新');
    },
  });

  // Add status history mutation
  const addStatusHistoryMutation = useMutation({
    mutationFn: async (data: { status: ProjectStatus; note?: string }) => {
      // First update the project status
      const { error: projectError } = await supabase
        .from('projects')
        .update({ status: data.status })
        .eq('id', id);
      if (projectError) throw projectError;

      // Note will be added via trigger, but we can update with note
      if (data.note) {
        const { data: historyData } = await supabase
          .from('project_status_history')
          .select('id')
          .eq('project_id', id)
          .order('changed_at', { ascending: false })
          .limit(1)
          .single();
        
        if (historyData) {
          await supabase
            .from('project_status_history')
            .update({ note: data.note })
            .eq('id', historyData.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-status-history', id] });
      toast.success('狀態變更已記錄');
      setIsAddStatusOpen(false);
      setStatusForm({});
    },
  });

  // Update construction status mutation
  const updateConstructionMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('projects')
        .update({ construction_status: newStatus as any })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['construction-status-history', id] });
      toast.success('施工狀態已更新');
      setIsEditConstructionOpen(false);
    },
  });

  // Update approval date mutation - triggers site_code_display auto-update
  const updateApprovalDateMutation = useMutation({
    mutationFn: async (newDate: string | null) => {
      const { error } = await supabase
        .from('projects')
        .update({ approval_date: newDate })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('同意備案日期已更新，案場編號已自動更新');
      setIsEditApprovalDateOpen(false);
    },
    onError: (error: Error) => {
      toast.error('更新失敗', { description: error.message });
    },
  });

  // Add document mutation
  const addDocumentMutation = useMutation({
    mutationFn: async (data: typeof docForm) => {
      const { error } = await supabase.from('documents').insert({
        project_id: id,
        doc_type: data.doc_type!,
        doc_status: data.doc_status || '未開始',
        submitted_at: data.submitted_at || null,
        issued_at: data.issued_at || null,
        due_at: data.due_at || null,
        note: data.note || null,
        created_by: user?.id,
        owner_user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', id] });
      toast.success('文件已新增');
      setIsAddDocOpen(false);
      setDocForm({});
    },
  });

  // Create Drive folder handler
  const handleCreateDriveFolder = async () => {
    if (!id || !user) return;
    
    // Check if user has authorized Drive
    if (!isDriveAuthorized) {
      try {
        await authorizeDrive();
      } catch (err) {
        toast.error('Google Drive 授權失敗');
      }
      return;
    }
    
    setIsCreatingFolder(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-drive-folder', {
        body: { projectId: id },
      });
      
      if (error) throw new Error(error.message);
      
      // Check if response indicates need for auth
      if (data?.error === 'NEED_AUTH') {
        try {
          await authorizeDrive();
        } catch (err) {
          toast.error('Google Drive 授權失敗');
        }
        return;
      }
      
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Google Drive 資料夾已建立');
    } catch (err) {
      const error = err as Error;
      toast.error('建立資料夾失敗', { description: error.message });
    } finally {
      setIsCreatingFolder(false);
    }
  };
  
  // Handle Drive authorization
  const handleAuthorizeDrive = async () => {
    try {
      await authorizeDrive();
    } catch (err) {
      toast.error('Google Drive 授權失敗');
    }
  };

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">載入中...</div>
      </div>
    );
  }

  const investor = project.investors as any;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-display font-bold text-foreground">
              {project.project_name}
            </h1>
            <Badge className={getStatusColor(project.status)} variant="secondary">
              {project.status}
            </Badge>
            {(project as any).construction_status && (
              <Badge className={getConstructionStatusColor((project as any).construction_status)} variant="secondary">
                施工：{(project as any).construction_status}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {(project as any).site_code_display || project.project_code} • {project.city} {project.district}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setIsAddStatusOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            變更狀態
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">基本資料</TabsTrigger>
          <TabsTrigger value="progress">進度追蹤</TabsTrigger>
          <TabsTrigger value="power">用電資訊</TabsTrigger>
          <TabsTrigger value="construction">施工進度</TabsTrigger>
          <TabsTrigger value="partners">施工工班</TabsTrigger>
          <TabsTrigger value="status">狀態紀錄</TabsTrigger>
          <TabsTrigger value="documents">文件</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="info" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  案場資訊
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">案場編號</p>
                    <p className="font-mono text-lg font-semibold text-primary">
                      {(project as any).site_code_display || project.project_code}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">進件年度</p>
                    <p>{(project as any).intake_year || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">容量 (kWp)</p>
                    <p>{project.capacity_kwp || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">實際裝置容量 (kWp)</p>
                    <p>{(project as any).actual_installed_capacity || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">饋線代號</p>
                    <p>{project.feeder_code || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">業績年度</p>
                    <p>{project.fiscal_year || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">裝置類型</p>
                    <p>{(project as any).installation_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">同意備案日期</p>
                    <div className="flex items-center gap-2">
                      <p>{(project as any).approval_date || '-'}</p>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => {
                            setApprovalDateForm((project as any).approval_date || '');
                            setIsEditApprovalDateOpen(true);
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">地址</p>
                  <p className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {project.city} {project.district} {project.address || '-'}
                  </p>
                </div>
                {project.coordinates && (
                  <div>
                    <p className="text-sm text-muted-foreground">座標</p>
                    <p className="font-mono text-sm">{project.coordinates}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Investor Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  投資方資訊
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {investor ? (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">公司名稱</p>
                      <p className="font-medium">{investor.company_name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">聯絡人</p>
                        <p>{investor.contact_person || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">電話</p>
                        <p>{investor.phone || '-'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p>{investor.email || '-'}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">尚未指定投資方</p>
                )}
              </CardContent>
            </Card>

            {/* Land Owner Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  土地資訊
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">承租/所有權人</p>
                    <p>{project.land_owner || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">聯絡方式</p>
                    <p>{project.land_owner_contact || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="w-5 h-5 text-primary" />
                  聯絡資訊
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">聯絡人</p>
                    <p>{project.contact_person || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">電話</p>
                    <p>{project.contact_phone || '-'}</p>
                  </div>
                </div>
                {project.note && (
                  <div>
                    <p className="text-sm text-muted-foreground">備註</p>
                    <p className="text-sm whitespace-pre-wrap">{project.note}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Google Drive Folder Card */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-primary" />
                  Google Drive 資料夾
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drive Authorization Status */}
                {canEdit && !isDriveLoading && (
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    {isDriveAuthorized ? (
                      <>
                        <div className="flex items-center gap-2 text-success">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-sm">已連結 Google Drive</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Link className="w-4 h-4" />
                          <span className="text-sm">尚未連結 Google Drive</span>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleAuthorizeDrive}
                          disabled={isAuthorizing}
                        >
                          {isAuthorizing ? '授權中...' : '連結 Google Drive'}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Folder Status */}
                {(project as any).folder_status === 'created' && (project as any).drive_folder_url ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>資料夾已建立</span>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a 
                        href={(project as any).drive_folder_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        開啟 Drive 資料夾
                      </a>
                    </Button>
                  </div>
                ) : (project as any).folder_status === 'failed' ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="w-5 h-5" />
                      <span>建立失敗</span>
                    </div>
                    {(project as any).folder_error && (
                      <span className="text-sm text-muted-foreground">
                        {(project as any).folder_error}
                      </span>
                    )}
                    {canEdit && isDriveAuthorized && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleCreateDriveFolder}
                        disabled={isCreatingFolder}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isCreatingFolder ? 'animate-spin' : ''}`} />
                        重新建立
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">尚未建立資料夾</span>
                    {canEdit && isDriveAuthorized && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleCreateDriveFolder}
                        disabled={isCreatingFolder}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isCreatingFolder ? 'animate-spin' : ''}`} />
                        {isCreatingFolder ? '建立中...' : '建立資料夾'}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Progress Tracking Tab */}
        <TabsContent value="progress" className="mt-6">
          <ProjectMilestones 
            projectId={id!}
            adminProgress={(project as any).admin_progress || 0}
            engineeringProgress={(project as any).engineering_progress || 0}
            overallProgress={(project as any).overall_progress || 0}
            adminStage={(project as any).admin_stage}
            engineeringStage={(project as any).engineering_stage}
          />
        </TabsContent>

        {/* Power Information Tab */}
        <TabsContent value="power" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plug className="w-5 h-5 text-primary" />
                用電資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">台電 PV 編號</p>
                  <p className="font-mono">{(project as any).taipower_pv_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">併聯方式</p>
                  <p>{(project as any).grid_connection_type || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">供電模式</p>
                  <p>{(project as any).power_phase_type || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">供電電壓</p>
                  <p>{(project as any).power_voltage || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">立桿狀態</p>
                  <p>{(project as any).pole_status || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Construction Status Tab */}
        <TabsContent value="construction" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                施工進度狀況
              </CardTitle>
              {canEdit && (
                <Button 
                  size="sm" 
                  onClick={() => {
                    setConstructionForm((project as any).construction_status || '');
                    setIsEditConstructionOpen(true);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  變更狀態
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">目前施工狀態：</span>
                {(project as any).construction_status ? (
                  <Badge className={getConstructionStatusColor((project as any).construction_status)} variant="secondary">
                    {(project as any).construction_status}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">尚未設定</span>
                )}
              </div>

              {/* Construction Status History */}
              <div>
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  施工狀態變更紀錄
                </h4>
                {constructionHistory.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground text-sm">暫無紀錄</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-4">
                      {constructionHistory.map((history: any) => (
                        <div key={history.id} className="relative pl-10">
                          <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center gap-3 mb-1">
                              <Badge className={getConstructionStatusColor(history.status)} variant="secondary">
                                {history.status}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(history.changed_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                              </span>
                            </div>
                            {history.note && (
                              <p className="text-sm text-foreground">{history.note}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              變更人：{history.profiles?.full_name || history.profiles?.email || '系統'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Partners/Construction Assignments Tab */}
        <TabsContent value="partners" className="mt-6">
          <ProjectConstructionAssignments projectId={id!} />
        </TabsContent>

        {/* Status History Tab */}
        <TabsContent value="status" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                狀態變更紀錄
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusHistory.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">暫無紀錄</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-6">
                    {statusHistory.map((history, index) => (
                      <div key={history.id} className="relative pl-10">
                        <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                        <div className="bg-muted/50 rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className={getStatusColor(history.status)} variant="secondary">
                              {history.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(history.changed_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                            </span>
                          </div>
                          {history.note && (
                            <p className="text-sm text-foreground">{history.note}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            變更人：{(history.profiles as any)?.full_name || (history.profiles as any)?.email || '系統'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                文件列表
              </CardTitle>
              {canEdit && (
                <Button size="sm" onClick={() => setIsAddDocOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增文件
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">暫無文件</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>文件類型</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>送件日</TableHead>
                      <TableHead>核發日</TableHead>
                      <TableHead>到期日</TableHead>
                      <TableHead>負責人</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.doc_type}</TableCell>
                        <TableCell>
                          <Badge className={getDocStatusColor(doc.doc_status)} variant="secondary">
                            {doc.doc_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {doc.submitted_at ? format(new Date(doc.submitted_at), 'yyyy/MM/dd') : '-'}
                        </TableCell>
                        <TableCell>
                          {doc.issued_at ? format(new Date(doc.issued_at), 'yyyy/MM/dd') : '-'}
                        </TableCell>
                        <TableCell>
                          {doc.due_at ? format(new Date(doc.due_at), 'yyyy/MM/dd') : '-'}
                        </TableCell>
                        <TableCell>
                          {(doc.owner as any)?.full_name || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Status Dialog */}
      <Dialog open={isAddStatusOpen} onOpenChange={setIsAddStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>變更案場狀態</DialogTitle>
            <DialogDescription>選擇新狀態並可添加備註</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>新狀態</Label>
              <Select
                value={statusForm.status}
                onValueChange={(value) => setStatusForm({ ...statusForm, status: value as ProjectStatus })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇狀態" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>備註</Label>
              <Textarea
                value={statusForm.note || ''}
                onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })}
                placeholder="選填"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStatusOpen(false)}>取消</Button>
            <Button
              onClick={() => statusForm.status && addStatusHistoryMutation.mutate(statusForm as { status: ProjectStatus; note?: string })}
              disabled={!statusForm.status || addStatusHistoryMutation.isPending}
            >
              確認變更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Construction Status Dialog */}
      <Dialog open={isEditConstructionOpen} onOpenChange={setIsEditConstructionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>變更施工狀態</DialogTitle>
            <DialogDescription>選擇新的施工進度狀態</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>施工狀態</Label>
              <CodebookSelect
                category="construction_status"
                value={constructionForm}
                onValueChange={setConstructionForm}
                placeholder="選擇狀態"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditConstructionOpen(false)}>取消</Button>
            <Button
              onClick={() => constructionForm && updateConstructionMutation.mutate(constructionForm)}
              disabled={!constructionForm || updateConstructionMutation.isPending}
            >
              確認變更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Document Dialog */}
      <Dialog open={isAddDocOpen} onOpenChange={setIsAddDocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增文件</DialogTitle>
            <DialogDescription>建立新的文件追蹤記錄</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>文件類型 *</Label>
              <Select
                value={docForm.doc_type}
                onValueChange={(value) => setDocForm({ ...docForm, doc_type: value as DocType })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇文件類型" />
                </SelectTrigger>
                <SelectContent>
                  {docTypeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>狀態</Label>
              <Select
                value={docForm.doc_status || '未開始'}
                onValueChange={(value) => setDocForm({ ...docForm, doc_status: value as DocStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {docStatusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>送件日</Label>
                <Input
                  type="date"
                  value={docForm.submitted_at || ''}
                  onChange={(e) => setDocForm({ ...docForm, submitted_at: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>到期日</Label>
                <Input
                  type="date"
                  value={docForm.due_at || ''}
                  onChange={(e) => setDocForm({ ...docForm, due_at: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>備註</Label>
              <Textarea
                value={docForm.note || ''}
                onChange={(e) => setDocForm({ ...docForm, note: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDocOpen(false)}>取消</Button>
            <Button
              onClick={() => addDocumentMutation.mutate(docForm)}
              disabled={!docForm.doc_type || addDocumentMutation.isPending}
            >
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Approval Date Dialog */}
      <Dialog open={isEditApprovalDateOpen} onOpenChange={setIsEditApprovalDateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              編輯同意備案日期
            </DialogTitle>
            <DialogDescription>
              設定同意備案日期後，案場編號將自動加上年份後綴（例：2025YP0001-2026）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>同意備案日期</Label>
              <Input
                type="date"
                value={approvalDateForm}
                onChange={(e) => setApprovalDateForm(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                清空日期可移除案場編號的年份後綴
              </p>
            </div>
            {approvalDateForm && (
              <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                <p className="text-sm text-success">
                  案場編號將更新為：{(project as any).intake_year || ''}{(project?.investor_id ? '' : '')}{(project as any).seq ? String((project as any).seq).padStart(4, '0') : ''}-{new Date(approvalDateForm).getFullYear()}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditApprovalDateOpen(false)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => updateApprovalDateMutation.mutate(null)}
              disabled={!approvalDateForm || updateApprovalDateMutation.isPending}
            >
              清除日期
            </Button>
            <Button
              onClick={() => updateApprovalDateMutation.mutate(approvalDateForm || null)}
              disabled={updateApprovalDateMutation.isPending}
            >
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
