import { Info, Key, Link } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export type ImportType = 
  | 'projects' 
  | 'investors' 
  | 'investor_contacts' 
  | 'investor_payment_methods' 
  | 'documents';

interface ConstraintInfo {
  table: string;
  tableName: string;
  uniqueKeys: { columns: string[]; description: string }[];
  foreignKeys: { column: string; references: string; description: string }[];
  notes: string[];
}

const constraintData: Record<ImportType, ConstraintInfo> = {
  projects: {
    table: 'projects',
    tableName: '案場',
    uniqueKeys: [
      { columns: ['project_code'], description: '案場編號必須唯一' },
      { columns: ['site_code_display'], description: '案場代碼（年度+投資方+序號）自動生成，必須唯一' },
    ],
    foreignKeys: [
      { column: 'investor_id', references: 'investors.id', description: '投資方必須存在於系統中' },
    ],
    notes: [
      '匯入時以「案場編號」(project_code) 作為重複判斷依據',
      'site_code_display 由系統根據 intake_year、investor_code、seq 自動生成',
      '若指定投資方名稱，系統會自動查詢對應的 investor_id',
    ],
  },
  investors: {
    table: 'investors',
    tableName: '投資方',
    uniqueKeys: [
      { columns: ['investor_code'], description: '投資方編號必須唯一（自動轉為大寫）' },
    ],
    foreignKeys: [],
    notes: [
      '匯入時以「投資方編號」(investor_code) 作為重複判斷依據',
      '投資方編號會自動轉換為大寫字母',
    ],
  },
  investor_contacts: {
    table: 'investor_contacts',
    tableName: '投資方聯絡人',
    uniqueKeys: [
      { columns: ['investor_id', 'contact_name'], description: '同一投資方下聯絡人姓名必須唯一' },
    ],
    foreignKeys: [
      { column: 'investor_id', references: 'investors.id', description: '投資方必須存在於系統中' },
    ],
    notes: [
      '匯入時以「投資方編號 + 聯絡人姓名」作為重複判斷依據',
      '必須先匯入或建立投資方，才能匯入該投資方的聯絡人',
    ],
  },
  investor_payment_methods: {
    table: 'investor_payment_methods',
    tableName: '投資方支付方式',
    uniqueKeys: [
      { columns: ['investor_id', 'method_type', 'account_number'], description: '同一投資方下相同付款方式與帳號必須唯一' },
    ],
    foreignKeys: [
      { column: 'investor_id', references: 'investors.id', description: '投資方必須存在於系統中' },
    ],
    notes: [
      '匯入時以「投資方編號 + 付款方式 + 帳號」作為重複判斷依據',
      '必須先匯入或建立投資方，才能匯入該投資方的支付方式',
    ],
  },
  documents: {
    table: 'documents',
    tableName: '文件',
    uniqueKeys: [
      { columns: ['project_id', 'doc_type'], description: '同一案場下相同文件類型只能有一筆（建議）' },
    ],
    foreignKeys: [
      { column: 'project_id', references: 'projects.id', description: '案場必須存在於系統中' },
      { column: 'owner_user_id', references: 'profiles.id', description: '負責人必須是系統使用者' },
    ],
    notes: [
      '匯入時以「案場編號 + 文件類型」作為重複判斷依據',
      '必須先匯入或建立案場，才能匯入該案場的文件',
      '負責人欄位會嘗試以姓名匹配系統使用者',
    ],
  },
};

interface ImportConstraintsInfoProps {
  type: ImportType;
  showDetails?: boolean;
}

export function ImportConstraintsInfo({ type, showDetails = true }: ImportConstraintsInfoProps) {
  const info = constraintData[type];

  if (!info) return null;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="constraints" className="border rounded-lg">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex items-center gap-2 text-sm">
            <Info className="w-4 h-4 text-info" />
            <span>{info.tableName}資料表限制說明</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4 text-sm">
            {/* Unique Keys */}
            <div>
              <div className="flex items-center gap-2 font-medium mb-2">
                <Key className="w-4 h-4 text-warning" />
                <span>唯一鍵限制 (Unique Constraints)</span>
              </div>
              <div className="space-y-2 ml-6">
                {info.uniqueKeys.map((uk, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono text-xs shrink-0">
                      {uk.columns.join(' + ')}
                    </Badge>
                    <span className="text-muted-foreground">{uk.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Foreign Keys */}
            {info.foreignKeys.length > 0 && (
              <div>
                <div className="flex items-center gap-2 font-medium mb-2">
                  <Link className="w-4 h-4 text-info" />
                  <span>外鍵關聯 (Foreign Keys)</span>
                </div>
                <div className="space-y-2 ml-6">
                  {info.foreignKeys.map((fk, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge variant="secondary" className="font-mono text-xs shrink-0">
                        {fk.column} → {fk.references}
                      </Badge>
                      <span className="text-muted-foreground">{fk.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {showDetails && info.notes.length > 0 && (
              <Alert className="bg-muted/50">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {info.notes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// Export types for import result
export interface ImportRowResult {
  row: number;
  status: 'success' | 'error' | 'skipped';
  message?: string;
  code?: string;
  errorType?: 'unique_constraint' | 'foreign_key' | 'validation' | 'data_type' | 'unknown';
  field?: string;
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  rowResults: ImportRowResult[];
}
