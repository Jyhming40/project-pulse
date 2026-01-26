import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Download, 
  Loader2, 
  Search,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Building2,
  FileText,
  Calendar,
  MapPin,
  Users,
  Zap,
  Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// Field definition type
interface FieldDef {
  key: string;
  label: string;
}

interface CategoryDef {
  label: string;
  icon: typeof Building2;
  fields: FieldDef[];
}

// Field categories with icons
const FIELD_CATEGORIES: Record<string, CategoryDef> = {
  basic: {
    label: '基本資料',
    icon: Building2,
    fields: [
      { key: 'project_code', label: '案場編號' },
      { key: 'project_name', label: '案場名稱' },
      { key: 'site_code_display', label: '顯示編號' },
      { key: 'status', label: '案場狀態' },
      { key: 'fiscal_year', label: '年度' },
      { key: 'intake_year', label: '收件年度' },
      { key: 'seq', label: '序號' },
      { key: 'note', label: '備註' },
    ]
  },
  capacity: {
    label: '容量與設備',
    icon: Zap,
    fields: [
      { key: 'capacity_kwp', label: '設置容量(kWp)' },
      { key: 'actual_installed_capacity', label: '實際容量(kWp)' },
      { key: 'installation_type', label: '安裝類型' },
      { key: 'taipower_pv_id', label: '台電太陽光電識別碼' },
    ]
  },
  location: {
    label: '地址與位置',
    icon: MapPin,
    fields: [
      { key: 'city', label: '縣市' },
      { key: 'district', label: '鄉鎮區' },
      { key: 'address', label: '地址' },
      { key: 'coordinates', label: '座標' },
      { key: 'feeder_code', label: '饋線代號' },
    ]
  },
  power: {
    label: '電力資訊',
    icon: Settings2,
    fields: [
      { key: 'grid_connection_type', label: '併網類型' },
      { key: 'power_phase_type', label: '相位類型' },
      { key: 'power_voltage', label: '電壓' },
      { key: 'pole_status', label: '電桿狀態' },
    ]
  },
  contact: {
    label: '聯絡資訊',
    icon: Users,
    fields: [
      { key: 'land_owner', label: '地主' },
      { key: 'land_owner_contact', label: '地主聯絡方式' },
      { key: 'contact_person', label: '聯絡人' },
      { key: 'contact_phone', label: '聯絡電話' },
    ]
  },
  construction: {
    label: '工程狀態',
    icon: Building2,
    fields: [
      { key: 'construction_status', label: '工程狀態' },
      { key: 'construction_start_date', label: '材料進場日期' },
    ]
  },
  milestones: {
    label: '里程碑日期',
    icon: Calendar,
    fields: [
      { key: 'initial_survey_date', label: '初步現勘日期' },
      { key: 'contract_signed_at', label: '與客戶簽訂合約' },
      { key: 'doc_審查意見書_issued', label: '台電審查意見書日期' },
      { key: 'doc_同意備案_issued', label: '能源署同意備案日期' },
      { key: 'structural_cert_date', label: '結構技師簽證日期' },
      { key: 'doc_免雜項申請_issued', label: '免雜項執照同意日期' },
      { key: 'doc_躉售合約_issued', label: '台電躉售合約日期' },
      { key: 'electrical_cert_date', label: '電機技師簽證日期' },
      { key: 'construction_start_date', label: '材料進場/施工日期' },
      { key: 'doc_免雜項竣工_issued', label: '免雜項執照竣工日期' },
      { key: 'actual_meter_date', label: '台電掛表/完工日期' },
      { key: 'doc_設備登記_issued', label: '設備登記核准日期' },
      { key: 'approval_date', label: '同意備案日期(專案欄位)' },
    ]
  },
  investor: {
    label: '投資方資訊',
    icon: Users,
    fields: [
      { key: 'investor_code', label: '投資方編號' },
      { key: 'investor_name', label: '投資方名稱' },
      { key: 'investor_type', label: '投資方類型' },
      { key: 'investor_contact_person', label: '投資方聯絡人' },
      { key: 'investor_phone', label: '投資方電話' },
      { key: 'investor_email', label: '投資方 Email' },
    ]
  },
  documents: {
    label: '文件統計',
    icon: FileText,
    fields: [
      { key: 'doc_total_count', label: '文件總數' },
      { key: 'doc_completed_count', label: '已完成文件數' },
      { key: 'doc_pending_count', label: '待處理文件數' },
    ]
  },
  system: {
    label: '系統資訊',
    icon: Settings2,
    fields: [
      { key: 'id', label: 'ID' },
      { key: 'created_at', label: '建立時間' },
      { key: 'updated_at', label: '更新時間' },
      { key: 'overall_progress', label: '整體進度(%)' },
    ]
  },
};

// Get all field keys as a flat list
const ALL_FIELDS: FieldDef[] = Object.values(FIELD_CATEGORIES).flatMap(cat => cat.fields);

export function ProjectCustomExportPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(ALL_FIELDS.map(f => f.key))
  );
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(FIELD_CATEGORIES))
  );

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects-for-export'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id, project_code, project_name, status, city, district, capacity_kwp,
          investors (investor_code, company_name)
        `)
        .eq('is_deleted', false)
        .order('project_code', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Filtered projects based on search
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(p => 
      p.project_code?.toLowerCase().includes(query) ||
      p.project_name?.toLowerCase().includes(query) ||
      p.investors?.company_name?.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  // Toggle category expansion
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Toggle field selection
  const toggleField = useCallback((fieldKey: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(fieldKey)) {
        next.delete(fieldKey);
      } else {
        next.add(fieldKey);
      }
      return next;
    });
  }, []);

  // Toggle all fields in a category
  const toggleCategory_ = useCallback((categoryKey: string) => {
    const category = FIELD_CATEGORIES[categoryKey as keyof typeof FIELD_CATEGORIES];
    if (!category) return;
    
    const categoryFields = category.fields.map(f => f.key);
    const allSelected = categoryFields.every(f => selectedFields.has(f));
    
    setSelectedFields(prev => {
      const next = new Set(prev);
      categoryFields.forEach(f => {
        if (allSelected) {
          next.delete(f);
        } else {
          next.add(f);
        }
      });
      return next;
    });
  }, [selectedFields]);

  // Toggle project selection
  const toggleProject = useCallback((projectId: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  // Select/Deselect all projects
  const toggleAllProjects = useCallback(() => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
    }
  }, [selectedProjects.size, filteredProjects]);

  // Select/Deselect all fields
  const toggleAllFields = useCallback(() => {
    if (selectedFields.size === ALL_FIELDS.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(ALL_FIELDS.map(f => f.key)));
    }
  }, [selectedFields.size]);

  // Export handler
  const handleExport = async () => {
    if (selectedProjects.size === 0) {
      toast.error('請至少選擇一個案件');
      return;
    }
    if (selectedFields.size === 0) {
      toast.error('請至少選擇一個欄位');
      return;
    }

    setIsExporting(true);

    try {
      // Fetch full project data for selected projects
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          investors (
            investor_code, company_name, investor_type, 
            contact_person, phone, email
          )
        `)
        .in('id', Array.from(selectedProjects))
        .eq('is_deleted', false);

      if (projectError) throw projectError;

      // Fetch document stats and dates per project
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('project_id, doc_status, doc_type, doc_type_code, submitted_at, issued_at')
        .in('project_id', Array.from(selectedProjects))
        .eq('is_deleted', false);

      if (docError) throw docError;

      // Aggregate document stats and extract document dates
      const docStatsMap = new Map<string, { total: number; completed: number; pending: number }>();
      const docDatesMap = new Map<string, Record<string, string | null>>();
      
      (docData || []).forEach(doc => {
        // Stats aggregation
        if (!docStatsMap.has(doc.project_id)) {
          docStatsMap.set(doc.project_id, { total: 0, completed: 0, pending: 0 });
        }
        const stats = docStatsMap.get(doc.project_id)!;
        stats.total++;
        if (doc.doc_status === '已完成' || doc.doc_status === '已核發') {
          stats.completed++;
        } else if (doc.doc_status !== '未開始') {
          stats.pending++;
        }
        
        // Document dates extraction - use doc_type for matching
        if (!docDatesMap.has(doc.project_id)) {
          docDatesMap.set(doc.project_id, {});
        }
        const dates = docDatesMap.get(doc.project_id)!;
        const docType = doc.doc_type;
        
        // Map doc_type to our field keys
        if (docType === '審查意見書') {
          dates['doc_審查意見書_issued'] = doc.issued_at;
        } else if (docType === '同意備案') {
          dates['doc_同意備案_issued'] = doc.issued_at;
        } else if (docType === '免雜項申請') {
          dates['doc_免雜項申請_issued'] = doc.issued_at;
        } else if (docType === '躉售合約') {
          dates['doc_躉售合約_issued'] = doc.issued_at;
        } else if (docType === '免雜項竣工') {
          dates['doc_免雜項竣工_issued'] = doc.issued_at;
        } else if (docType === '設備登記') {
          dates['doc_設備登記_issued'] = doc.issued_at;
        }
      });

      // Build export data
      const selectedFieldList = ALL_FIELDS.filter(f => selectedFields.has(f.key));
      
      const exportRows = (projectData || []).map(project => {
        const row: Record<string, any> = {};
        const docStat = docStatsMap.get(project.id) || { total: 0, completed: 0, pending: 0 };
        const docDates = docDatesMap.get(project.id) || {};

        selectedFieldList.forEach(field => {
          let value: any = '';
          
          // Handle special computed fields
          switch (field.key) {
            case 'investor_code':
              value = project.investors?.investor_code || '';
              break;
            case 'investor_name':
              value = project.investors?.company_name || '';
              break;
            case 'investor_type':
              value = project.investors?.investor_type || '';
              break;
            case 'investor_contact_person':
              value = project.investors?.contact_person || '';
              break;
            case 'investor_phone':
              value = project.investors?.phone || '';
              break;
            case 'investor_email':
              value = project.investors?.email || '';
              break;
            case 'doc_total_count':
              value = docStat.total;
              break;
            case 'doc_completed_count':
              value = docStat.completed;
              break;
            case 'doc_pending_count':
              value = docStat.pending;
              break;
            // Handle document-based date fields
            case 'doc_審查意見書_issued':
            case 'doc_同意備案_issued':
            case 'doc_免雜項申請_issued':
            case 'doc_躉售合約_issued':
            case 'doc_免雜項竣工_issued':
            case 'doc_設備登記_issued':
              value = docDates[field.key] || '';
              break;
            default:
              value = project[field.key as keyof typeof project] ?? '';
          }

          // Format dates
          if (value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
            value = value.substring(0, 10);
          }

          row[field.label] = value;
        });

        return row;
      });

      // Create Excel file
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      
      // Auto-size columns
      const colWidths = selectedFieldList.map(f => ({
        wch: Math.max(f.label.length * 2, 12)
      }));
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '案件資料');

      // Download
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `案件匯出_${selectedProjects.size}筆_${timestamp}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success(`成功匯出 ${selectedProjects.size} 筆案件資料`);
      setIsOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('匯出失敗：' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          案件自訂匯出
        </CardTitle>
        <CardDescription>
          選擇特定案件與欄位，匯出自訂 Excel 報表
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button className="w-full" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              開始自訂匯出
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col h-full">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                自訂欄位匯出
              </SheetTitle>
              <SheetDescription>
                選擇要匯出的案件與欄位，所有資料將放在同一個 Excel 標籤頁
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
              {/* Project Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    選擇案件 
                    <Badge variant="secondary" className="ml-2">
                      {selectedProjects.size} / {projects.length}
                    </Badge>
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={toggleAllProjects}
                    className="h-7 text-xs"
                  >
                    {selectedProjects.size === filteredProjects.length ? (
                      <>
                        <Square className="w-3 h-3 mr-1" />
                        取消全選
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-3 h-3 mr-1" />
                        全選
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜尋案件編號、名稱..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>

                <ScrollArea className="h-40 border rounded-md">
                  <div className="p-2 space-y-1">
                    {projectsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    ) : filteredProjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        無符合條件的案件
                      </p>
                    ) : (
                      filteredProjects.map(project => (
                        <div
                          key={project.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleProject(project.id)}
                        >
                          <Checkbox
                            checked={selectedProjects.has(project.id)}
                            onCheckedChange={() => toggleProject(project.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {project.project_code} - {project.project_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {project.investors?.company_name || '無投資方'} • {project.city} {project.district}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {project.status}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              <Separator />

              {/* Field Selection */}
              <div className="space-y-2 flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    選擇欄位
                    <Badge variant="secondary" className="ml-2">
                      {selectedFields.size} / {ALL_FIELDS.length}
                    </Badge>
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={toggleAllFields}
                    className="h-7 text-xs"
                  >
                    {selectedFields.size === ALL_FIELDS.length ? (
                      <>
                        <Square className="w-3 h-3 mr-1" />
                        取消全選
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-3 h-3 mr-1" />
                        全選
                      </>
                    )}
                  </Button>
                </div>

                <ScrollArea className="flex-1 border rounded-md">
                  <div className="p-2 space-y-2">
                    {Object.entries(FIELD_CATEGORIES).map(([categoryKey, category]) => {
                      const Icon = category.icon;
                      const categoryFields = category.fields;
                      const selectedCount = categoryFields.filter(f => selectedFields.has(f.key)).length;
                      const isExpanded = expandedCategories.has(categoryKey);

                      return (
                        <Collapsible 
                          key={categoryKey} 
                          open={isExpanded}
                          onOpenChange={() => toggleCategory(categoryKey)}
                        >
                          <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
                            <Checkbox
                              checked={selectedCount === categoryFields.length}
                              onCheckedChange={() => toggleCategory_(categoryKey)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <CollapsibleTrigger asChild>
                              <button className="flex items-center gap-2 flex-1 text-left">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{category.label}</span>
                                <Badge variant="outline" className="text-xs ml-auto mr-2">
                                  {selectedCount}/{categoryFields.length}
                                </Badge>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                              </button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent>
                            <div className="pl-8 py-1 space-y-1">
                              {categoryFields.map(field => (
                                <div
                                  key={field.key}
                                  className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 cursor-pointer"
                                  onClick={() => toggleField(field.key)}
                                >
                                  <Checkbox
                                    checked={selectedFields.has(field.key)}
                                    onCheckedChange={() => toggleField(field.key)}
                                  />
                                  <span className="text-sm">{field.label}</span>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <SheetFooter className="border-t pt-4">
              <div className="flex items-center justify-between w-full gap-3">
                <p className="text-sm text-muted-foreground">
                  {selectedProjects.size} 筆案件 × {selectedFields.size} 個欄位
                </p>
                <Button 
                  onClick={handleExport} 
                  disabled={isExporting || selectedProjects.size === 0 || selectedFields.size === 0}
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {isExporting ? '匯出中...' : '匯出 Excel'}
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  );
}
