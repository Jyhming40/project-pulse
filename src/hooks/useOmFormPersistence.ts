import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type OmTable =
  | 'om_inspections'
  | 'om_dc_tests'
  | 'om_ac_tests'
  | 'om_cleaning_reports'
  | 'om_incident_reports'
  | 'om_site_access_requests'
  | 'om_personnel_rosters'
  | 'om_toolbox_meetings';

interface UseOmFormOptions<T> {
  table: OmTable;
  toRow: (data: T) => Record<string, unknown>;
  fromRow: (row: Record<string, unknown>) => T;
}

// Use `any` casts on supabase.from() because these new tables
// won't appear in the auto-generated types until the next sync.
export function useOmFormPersistence<T>({ table, toRow, fromRow }: UseOmFormOptions<T>) {
  const [recordId, setRecordId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savedRecords, setSavedRecords] = useState<{ id: string; label: string; date: string }[]>([]);

  const db = () => (supabase as any).from(table);

  const save = useCallback(async (data: T) => {
    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const row = { ...toRow(data), created_by: userData?.user?.id ?? null };

      if (recordId) {
        const { created_by: _, ...updateRow } = row;
        const { error } = await db().update(updateRow).eq('id', recordId);
        if (error) throw error;
        toast.success('已更新紀錄');
      } else {
        const { data: inserted, error } = await db().insert(row).select('id').single();
        if (error) throw error;
        setRecordId(inserted.id);
        toast.success('已儲存紀錄');
      }
    } catch (err) {
      console.error(err);
      toast.error('儲存失敗：' + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }, [table, toRow, recordId]);

  const loadRecord = useCallback(async (id: string): Promise<T | null> => {
    setIsLoading(true);
    try {
      const { data: row, error } = await db().select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!row) { toast.error('找不到紀錄'); return null; }
      setRecordId(row.id);
      const parsed = fromRow(row);
      toast.success('已載入紀錄');
      return parsed;
    } catch (err) {
      console.error(err);
      toast.error('載入失敗：' + (err as Error).message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [table, fromRow]);

  const fetchList = useCallback(async (labelField: string, dateField: string) => {
    try {
      const { data: rows, error } = await db()
        .select(`id, ${labelField}, ${dateField}`)
        .order(dateField, { ascending: false })
        .limit(50);
      if (error) throw error;
      setSavedRecords(
        (rows || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          label: (r[labelField] as string) || '(未命名)',
          date: (r[dateField] as string) || '',
        }))
      );
    } catch (err) {
      console.error(err);
    }
  }, [table]);

  const resetRecord = useCallback(() => setRecordId(null), []);

  return { recordId, isSaving, isLoading, save, loadRecord, fetchList, savedRecords, setRecordId, resetRecord };
}
