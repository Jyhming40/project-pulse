import { FieldConfig, CustomField } from '@/hooks/useProjectFieldConfig';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Edit, Trash2, ExternalLink } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'];

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

interface ProjectDynamicTableProps {
  projects: any[];
  visibleFields: FieldConfig[];
  activeCustomFields: CustomField[];
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  getSortInfo: (key: string) => { direction: 'asc' | 'desc' | null; index: number };
  handleSort: (key: string) => void;
  batchSelect: {
    isAllSelected: boolean;
    toggleAll: () => void;
    isSelected: (id: string) => boolean;
    toggle: (id: string) => void;
  };
  canEditProjects: boolean;
  isEnrichmentMode: boolean;
  isLoading: boolean;
  onRowClick: (project: any) => void;
  onViewProject: (project: any) => void;
  onEditProject: (project: any) => void;
  onDeleteProject: (project: any) => void;
  onNavigateToProject: (projectId: string) => void;
  canEdit: boolean;
  isAdmin: boolean;
}

export function ProjectDynamicTable({
  projects,
  visibleFields,
  activeCustomFields,
  sortConfig,
  getSortInfo,
  handleSort,
  batchSelect,
  canEditProjects,
  isEnrichmentMode,
  isLoading,
  onRowClick,
  onViewProject,
  onEditProject,
  onDeleteProject,
  onNavigateToProject,
  canEdit,
  isAdmin,
}: ProjectDynamicTableProps) {
  
  // Get cell value based on field key
  const getCellValue = (project: any, fieldKey: string) => {
    switch (fieldKey) {
      case 'project_code':
        return <span className="font-mono text-sm">{project.site_code_display || project.project_code}</span>;
      
      case 'project_name':
        return <span className="font-medium">{project.project_name}</span>;
      
      case 'investor_name':
        return project.investors?.company_name || '-';
      
      case 'status':
        return (
          <Badge className={getStatusColor(project.status)} variant="secondary">
            {project.status}
          </Badge>
        );
      
      case 'construction_status':
        return project.construction_status ? (
          <Badge className={getConstructionStatusColor(project.construction_status)} variant="secondary">
            {project.construction_status}
          </Badge>
        ) : '-';
      
      case 'overall_progress':
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${project.overall_progress || 0}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-8">{Math.round(project.overall_progress || 0)}%</span>
          </div>
        );
      
      case 'admin_progress':
        return <span className="text-xs">{Math.round(project.admin_progress || 0)}%</span>;
      
      case 'engineering_progress':
        return <span className="text-xs">{Math.round(project.engineering_progress || 0)}%</span>;
      
      case 'capacity_kwp':
        return project.capacity_kwp || '-';
      
      case 'city':
      case 'district':
      case 'address':
      case 'contact_person':
      case 'contact_phone':
      case 'grid_connection_type':
      case 'power_phase_type':
      case 'power_voltage':
      case 'pole_status':
      case 'installation_type':
      case 'feeder_code':
      case 'taipower_pv_id':
      case 'note':
        return project[fieldKey] || '-';
      
      case 'site_code_display':
        return <span className="font-mono text-sm">{project.site_code_display || '-'}</span>;
      
      case 'intake_year':
      case 'fiscal_year':
        return project[fieldKey] || '-';
      
      case 'approval_date':
        return project.approval_date ? new Date(project.approval_date).toLocaleDateString('zh-TW') : '-';
      
      default:
        return project[fieldKey] ?? '-';
    }
  };

  // Get sort key for a field
  const getSortKey = (fieldKey: string) => {
    if (fieldKey === 'investor_name') return 'investors.company_name';
    if (fieldKey === 'project_code') return 'site_code_display';
    return fieldKey;
  };

  const totalColumns = visibleFields.length + (canEditProjects || isEnrichmentMode ? 2 : 1);

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {(canEditProjects || isEnrichmentMode) && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={batchSelect.isAllSelected}
                    onCheckedChange={() => batchSelect.toggleAll()}
                    aria-label="全選"
                  />
                </TableHead>
              )}
              {visibleFields.map(field => (
                <SortableTableHead 
                  key={field.id}
                  sortKey={getSortKey(field.field_key)} 
                  currentSortKey={sortConfig.key} 
                  currentDirection={getSortInfo(getSortKey(field.field_key)).direction} 
                  sortIndex={getSortInfo(getSortKey(field.field_key)).index} 
                  onSort={handleSort}
                >
                  {field.field_label}
                </SortableTableHead>
              ))}
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center py-12 text-muted-foreground">
                  {isLoading ? '載入中...' : '暫無資料'}
                </TableCell>
              </TableRow>
            ) : (
              projects.map(project => (
                <TableRow 
                  key={project.id} 
                  className={`cursor-pointer hover:bg-muted/50 ${
                    isEnrichmentMode && batchSelect.isSelected(project.id) 
                      ? 'bg-warning/10 hover:bg-warning/15' 
                      : ''
                  }`}
                  onClick={() => onRowClick(project)}
                >
                  {(canEditProjects || isEnrichmentMode) && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={batchSelect.isSelected(project.id)}
                        onCheckedChange={() => batchSelect.toggle(project.id)}
                        aria-label={`選取 ${project.project_name}`}
                      />
                    </TableCell>
                  )}
                  {visibleFields.map(field => (
                    <TableCell key={field.id}>
                      {getCellValue(project, field.field_key)}
                    </TableCell>
                  ))}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewProject(project)}>
                          <Eye className="w-4 h-4 mr-2" />
                          快速檢視
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onNavigateToProject(project.id)}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          完整頁面
                        </DropdownMenuItem>
                        {canEdit && (
                          <DropdownMenuItem onClick={() => onEditProject(project)}>
                            <Edit className="w-4 h-4 mr-2" />
                            編輯
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => onDeleteProject(project)}
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
      </div>
    </div>
  );
}