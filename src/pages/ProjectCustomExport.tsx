import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Download,
  Loader2,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Building2,
  Calendar,
  MapPin,
  Users,
  Zap,
  Settings2,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';
import { useAppSettings } from '@/hooks/useAppSettings';

// Register font for PDF
Font.register({
  family: 'NotoSansTC',
  src: '/fonts/NotoSansTC-Regular.ttf',
});

// Field definition
interface FieldDef {
  key: string;
  label: string;
}

interface CategoryDef {
  label: string;
  icon: typeof Building2;
  fields: FieldDef[];
}

// Field categories
const FIELD_CATEGORIES: Record<string, CategoryDef> = {
  basic: {
    label: '基本資料',
    icon: Building2,
    fields: [
      { key: 'row_number', label: '項次' },
      { key: 'project_code', label: '案場編號' },
      { key: 'project_name', label: '案場名稱' },
      { key: 'site_code_display', label: '顯示編號' },
      { key: 'status', label: '案場狀態' },
      { key: 'fiscal_year', label: '年度' },
      { key: 'intake_year', label: '收件年度' },
      { key: 'note', label: '備註' },
    ],
  },
  location: {
    label: '地址與位置',
    icon: MapPin,
    fields: [
      { key: 'city', label: '行政區(縣市)' },
      { key: 'district', label: '鄉鎮區' },
      { key: 'address', label: '位址' },
      { key: 'coordinates', label: '座標' },
      { key: 'feeder_code', label: '饋線代號' },
    ],
  },
  contact: {
    label: '聯絡與地主',
    icon: Users,
    fields: [
      { key: 'investor_name', label: '申請人(業務單位)' },
      { key: 'land_owner', label: '案廠所有人' },
      { key: 'land_owner_contact', label: '地主聯絡方式' },
      { key: 'contact_person', label: '聯絡人' },
      { key: 'contact_phone', label: '聯絡電話' },
    ],
  },
  capacity: {
    label: '容量與設備',
    icon: Zap,
    fields: [
      { key: 'capacity_kwp', label: '規劃容量(kWp)' },
      { key: 'actual_installed_capacity', label: '實際容量(kWp)' },
      { key: 'installation_type', label: '設施種類' },
      { key: 'taipower_pv_id', label: 'PV編號' },
      { key: 'revenue_model', label: '售電模式' },
    ],
  },
  power: {
    label: '電力資訊',
    icon: Settings2,
    fields: [
      { key: 'grid_connection_type', label: '與台電併聯方式' },
      { key: 'power_phase_type', label: '電網型式' },
      { key: 'power_voltage', label: '電壓等級' },
      { key: 'pole_status', label: '電桿狀態' },
    ],
  },
  milestones: {
    label: '里程碑日期',
    icon: Calendar,
    fields: [
      { key: 'initial_survey_date', label: '初步現勘日期' },
      { key: 'contract_signed_at', label: '簽訂合約日期' },
      { key: 'doc_審查意見書_issued', label: '台電審查意見書日期' },
      { key: 'doc_同意備案_issued', label: '能源署同意備案日期' },
      { key: 'structural_cert_date', label: '結構技師簽證日期' },
      { key: 'doc_免雜項申請_issued', label: '免雜項執照同意日期' },
      { key: 'doc_躉售合約_issued', label: '台電躉售合約日期' },
      { key: 'electrical_cert_date', label: '電機技師簽證日期' },
      { key: 'construction_start_date', label: '材料進場日期' },
      { key: 'actual_meter_date', label: '台電掛表日期' },
      { key: 'doc_設備登記_issued', label: '設備登記核准日期' },
      { key: 'approval_date', label: '同意備案日期(專案欄位)' },
    ],
  },
  construction: {
    label: '工程狀態',
    icon: Building2,
    fields: [
      { key: 'construction_status', label: '工程狀態' },
    ],
  },
  investor: {
    label: '業務單位資訊',
    icon: Users,
    fields: [
      { key: 'investor_code', label: '單位編號' },
      { key: 'investor_type', label: '單位類型' },
      { key: 'investor_contact_person', label: '單位聯絡人' },
      { key: 'investor_phone', label: '單位電話' },
      { key: 'investor_email', label: '單位Email' },
    ],
  },
  documents: {
    label: '文件統計',
    icon: FileText,
    fields: [
      { key: 'doc_total_count', label: '文件總數' },
      { key: 'doc_completed_count', label: '已完成文件數' },
      { key: 'doc_pending_count', label: '待處理文件數' },
    ],
  },
  system: {
    label: '系統資訊',
    icon: Settings2,
    fields: [
      { key: 'id', label: 'ID' },
      { key: 'created_at', label: '建立時間' },
      { key: 'updated_at', label: '更新時間' },
      { key: 'overall_progress', label: '整體進度(%)' },
    ],
  },
};

const ALL_FIELDS: FieldDef[] = Object.values(FIELD_CATEGORIES).flatMap((cat) => cat.fields);

// PDF report preset
const PDF_PRESET_FIELDS = new Set([
  'row_number', 'city', 'address', 'investor_name', 'land_owner',
  'installation_type', 'grid_connection_type', 'taipower_pv_id',
  'capacity_kwp', 'status', 'note', 'power_phase_type', 'power_voltage',
  'doc_審查意見書_issued', 'approval_date',
]);

type ExportFormat = 'xlsx' | 'pdf';

export default function ProjectCustomExport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useAppSettings();
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(PDF_PRESET_FIELDS));
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(FIELD_CATEGORIES))
  );

  // Get selected IDs from URL params
  const selectedProjects = useMemo(() => {
    const ids = searchParams.get('ids');
    return ids ? new Set(ids.split(',')) : new Set<string>();
  }, [searchParams]);

  // Project count for display
  const projectCount = selectedProjects.size;

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);

  const toggleField = useCallback((key: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const toggleCategoryFields = useCallback(
    (catKey: string) => {
      const cat = FIELD_CATEGORIES[catKey];
      if (!cat) return;
      const keys = cat.fields.map((f) => f.key);
      const allSelected = keys.every((k) => selectedFields.has(k));
      setSelectedFields((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => (allSelected ? next.delete(k) : next.add(k)));
        return next;
      });
    },
    [selectedFields]
  );

  const toggleAllFields = useCallback(() => {
    setSelectedFields((prev) =>
      prev.size === ALL_FIELDS.length ? new Set() : new Set(ALL_FIELDS.map((f) => f.key))
    );
  }, []);

  const applyPreset = useCallback(() => {
    setSelectedFields(new Set(PDF_PRESET_FIELDS));
  }, []);

  // Build export rows
  const buildExportData = async () => {
    const ids = Array.from(selectedProjects);
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select(`*, investors(investor_code, company_name, investor_type, contact_person, phone, email)`)
      .in('id', ids)
      .eq('is_deleted', false);
    if (projectError) throw projectError;

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select('project_id, doc_status, doc_type, issued_at')
      .in('project_id', ids)
      .eq('is_deleted', false);
    if (docError) throw docError;

    const docStatsMap = new Map<string, { total: number; completed: number; pending: number }>();
    const docDatesMap = new Map<string, Record<string, string | null>>();
    (docData || []).forEach((doc) => {
      if (!docStatsMap.has(doc.project_id)) docStatsMap.set(doc.project_id, { total: 0, completed: 0, pending: 0 });
      const stats = docStatsMap.get(doc.project_id)!;
      stats.total++;
      if (doc.doc_status === '已完成' || doc.doc_status === '已核發') stats.completed++;
      else if (doc.doc_status !== '未開始') stats.pending++;

      if (!docDatesMap.has(doc.project_id)) docDatesMap.set(doc.project_id, {});
      const dates = docDatesMap.get(doc.project_id)!;
      const t = doc.doc_type;
      if (t === '審查意見書') dates['doc_審查意見書_issued'] = doc.issued_at;
      else if (t === '同意備案') dates['doc_同意備案_issued'] = doc.issued_at;
      else if (t === '免雜項申請') dates['doc_免雜項申請_issued'] = doc.issued_at;
      else if (t === '躉售合約') dates['doc_躉售合約_issued'] = doc.issued_at;
      else if (t === '免雜項竣工') dates['doc_免雜項竣工_issued'] = doc.issued_at;
      else if (t === '設備登記') dates['doc_設備登記_issued'] = doc.issued_at;
    });

    const selectedFieldList = ALL_FIELDS.filter((f) => selectedFields.has(f.key));

    const rows = (projectData || []).map((project, idx) => {
      const row: Record<string, any> = {};
      const docStat = docStatsMap.get(project.id) || { total: 0, completed: 0, pending: 0 };
      const docDates = docDatesMap.get(project.id) || {};

      selectedFieldList.forEach((field) => {
        let value: any = '';
        switch (field.key) {
          case 'row_number': value = idx + 1; break;
          case 'investor_name': value = project.investors?.company_name || ''; break;
          case 'investor_code': value = project.investors?.investor_code || ''; break;
          case 'investor_type': value = project.investors?.investor_type || ''; break;
          case 'investor_contact_person': value = project.investors?.contact_person || ''; break;
          case 'investor_phone': value = project.investors?.phone || ''; break;
          case 'investor_email': value = project.investors?.email || ''; break;
          case 'doc_total_count': value = docStat.total; break;
          case 'doc_completed_count': value = docStat.completed; break;
          case 'doc_pending_count': value = docStat.pending; break;
          case 'doc_審查意見書_issued':
          case 'doc_同意備案_issued':
          case 'doc_免雜項申請_issued':
          case 'doc_躉售合約_issued':
          case 'doc_免雜項竣工_issued':
          case 'doc_設備登記_issued':
            value = docDates[field.key] || '';
            break;
          default:
            value = (project as any)[field.key] ?? '';
        }
        if (value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
          value = value.substring(0, 10);
        }
        row[field.label] = value;
      });
      return row;
    });

    return { rows, selectedFieldList };
  };

  // Excel export
  const exportExcel = async () => {
    const { rows, selectedFieldList } = await buildExportData();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = selectedFieldList.map((f) => ({ wch: Math.max(f.label.length * 2, 12) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '案件列表');
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `案件列表_${selectedProjects.size}筆_${timestamp}.xlsx`);
  };

  // PDF export
  const exportPdf = async () => {
    const { rows, selectedFieldList } = await buildExportData();
    const companyName = settings?.company_name_zh || settings?.system_name_zh || '案件列表';
    const timestamp = new Date().toISOString().slice(0, 10);
    const colCount = selectedFieldList.length;
    const colWidth = `${Math.floor(100 / colCount)}%`;

    const pdfStyles = StyleSheet.create({
      page: { padding: 20, fontFamily: 'NotoSansTC', fontSize: 7 },
      title: { fontSize: 14, textAlign: 'center', marginBottom: 4 },
      subtitle: { fontSize: 8, textAlign: 'center', marginBottom: 10, color: '#666' },
      table: { width: '100%' },
      headerRow: { flexDirection: 'row', backgroundColor: '#2563eb', minHeight: 18 },
      headerCell: { width: colWidth, padding: 3, color: '#ffffff', fontSize: 6.5, fontWeight: 700, borderRight: '0.5px solid #93c5fd' },
      row: { flexDirection: 'row', minHeight: 16, borderBottom: '0.5px solid #e5e7eb' },
      rowAlt: { flexDirection: 'row', minHeight: 16, borderBottom: '0.5px solid #e5e7eb', backgroundColor: '#f8fafc' },
      cell: { width: colWidth, padding: 3, fontSize: 6, borderRight: '0.5px solid #e5e7eb' },
      footer: { position: 'absolute', bottom: 15, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6, color: '#999' },
    });

    const PdfDoc = (
      <Document>
        <Page size="A4" orientation={colCount > 8 ? 'landscape' : 'portrait'} style={pdfStyles.page}>
          <Text style={pdfStyles.title}>{companyName} - 申請案件列表</Text>
          <Text style={pdfStyles.subtitle}>匯出日期：{timestamp}　共 {rows.length} 筆</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.headerRow}>
              {selectedFieldList.map((f, i) => (
                <Text key={i} style={pdfStyles.headerCell}>{f.label}</Text>
              ))}
            </View>
            {rows.map((row, rIdx) => (
              <View key={rIdx} style={rIdx % 2 === 0 ? pdfStyles.row : pdfStyles.rowAlt} wrap={false}>
                {selectedFieldList.map((f, cIdx) => (
                  <Text key={cIdx} style={pdfStyles.cell}>
                    {row[f.label] !== undefined && row[f.label] !== null ? String(row[f.label]) : ''}
                  </Text>
                ))}
              </View>
            ))}
          </View>
          <View style={pdfStyles.footer} fixed>
            <Text>{companyName}</Text>
            <Text render={({ pageNumber, totalPages }) => `第 ${pageNumber} / ${totalPages} 頁`} />
          </View>
        </Page>
      </Document>
    );

    const blob = await pdf(PdfDoc).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `案件列表_${rows.length}筆_${timestamp}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (projectCount === 0) { toast.error('請先在案場管理頁面選擇案件'); return; }
    if (selectedFields.size === 0) { toast.error('請至少選擇一個欄位'); return; }

    setIsExporting(true);
    try {
      if (exportFormat === 'xlsx') {
        await exportExcel();
      } else {
        await exportPdf();
      }
      toast.success(`成功匯出 ${projectCount} 筆案件（${exportFormat === 'xlsx' ? 'Excel' : 'PDF'}）`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('匯出失敗：' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6" />
              自訂欄位匯出
            </h1>
            <p className="text-sm text-muted-foreground">已從案場管理選取 {projectCount} 筆案件，選擇欄位後匯出</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {projectCount} 筆案件 × {selectedFields.size} 個欄位
          </p>
          <Button onClick={handleExport} disabled={isExporting || projectCount === 0 || selectedFields.size === 0} size="lg">
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {isExporting ? '匯出中...' : exportFormat === 'xlsx' ? '匯出 Excel' : '匯出 PDF'}
          </Button>
        </div>
      </div>

      {/* Format Selection */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-sm font-medium mb-3 block">匯出格式</Label>
          <RadioGroup value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)} className="flex gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="xlsx" id="fmt-xlsx" />
              <Label htmlFor="fmt-xlsx" className="flex items-center gap-1.5 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-success" />
                Excel (.xlsx)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="pdf" id="fmt-pdf" />
              <Label htmlFor="fmt-pdf" className="flex items-center gap-1.5 cursor-pointer">
                <FileText className="w-4 h-4 text-destructive" />
                PDF
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <div>
        {/* Field Selection - full width */}
        <Card className="flex flex-col">
          <CardContent className="pt-6 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">
                選擇欄位
                <Badge variant="secondary" className="ml-2">{selectedFields.size}/{ALL_FIELDS.length}</Badge>
              </Label>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={applyPreset} className="h-7 text-xs">
                  報表預設
                </Button>
                <Button variant="ghost" size="sm" onClick={toggleAllFields} className="h-7 text-xs">
                  {selectedFields.size === ALL_FIELDS.length ? (
                    <><Square className="w-3 h-3 mr-1" />取消全選</>
                  ) : (
                    <><CheckSquare className="w-3 h-3 mr-1" />全選</>
                  )}
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 border rounded-md" style={{ maxHeight: 'calc(100vh - 380px)' }}>
              <div className="p-2 space-y-2">
                {Object.entries(FIELD_CATEGORIES).map(([catKey, cat]) => {
                  const Icon = cat.icon;
                  const catFields = cat.fields;
                  const selCount = catFields.filter((f) => selectedFields.has(f.key)).length;
                  const isExpanded = expandedCategories.has(catKey);
                  return (
                    <Collapsible key={catKey} open={isExpanded} onOpenChange={() => toggleCategory(catKey)}>
                      <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
                        <Checkbox
                          checked={selCount === catFields.length}
                          onCheckedChange={() => toggleCategoryFields(catKey)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-2 flex-1 text-left">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{cat.label}</span>
                            <Badge variant="outline" className="text-xs ml-auto mr-2">{selCount}/{catFields.length}</Badge>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="pl-8 py-1 space-y-1">
                          {catFields.map((field) => (
                            <div key={field.key} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 cursor-pointer" onClick={() => toggleField(field.key)}>
                              <Checkbox checked={selectedFields.has(field.key)} onCheckedChange={() => toggleField(field.key)} />
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
