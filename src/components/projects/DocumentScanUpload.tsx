import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Camera, Upload, FileText, Loader2, Check, X, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ExtractedField {
  key: string;
  label: string;
  value: any;
}

const FIELD_LABELS: Record<string, string> = {
  project_name: '案場名稱',
  capacity_kwp: '容量 (kWp)',
  actual_installed_capacity: '實際裝置容量 (kWp)',
  city: '縣市',
  district: '區/鄉/鎮',
  address: '地址',
  feeder_code: '饋線代號',
  taipower_pv_id: '台電 PV 編號',
  grid_connection_type: '併聯方式',
  power_voltage: '供電電壓',
  land_owner: '承租/所有權人',
  land_owner_contact: '所有權人聯絡方式',
  contact_person: '聯絡人',
  contact_phone: '聯絡電話',
  note: '備註',
};

interface DocumentScanUploadProps {
  onExtracted: (data: Record<string, any>) => void;
  disabled?: boolean;
}

export function DocumentScanUpload({ onExtracted, disabled }: DocumentScanUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (file: File) => {
    // Validate file
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('請上傳圖片或 PDF 檔案');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('檔案大小不可超過 10MB');
      return;
    }

    // Preview
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }

    setIsProcessing(true);
    setShowResults(false);

    try {
      // Convert to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke('extract-project-from-document', {
        body: {
          imageBase64: base64,
          mimeType: file.type,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const extracted = data.extractedData || {};
      const fields: ExtractedField[] = Object.entries(extracted).map(([key, value]) => ({
        key,
        label: FIELD_LABELS[key] || key,
        value,
      }));

      setExtractedFields(fields);
      setShowResults(true);

      if (fields.length === 0) {
        toast.info('未能從文件中辨識出案場資料', { description: '請嘗試拍攝更清晰的照片' });
      } else {
        toast.success(`成功辨識 ${fields.length} 個欄位`, { description: '請確認後填入表單' });
      }
    } catch (err) {
      const error = err as Error;
      toast.error('辨識失敗', { description: error.message });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
    e.target.value = '';
  }, [processImage]);

  const handleApply = useCallback(() => {
    const data: Record<string, any> = {};
    extractedFields.forEach(f => {
      data[f.key] = f.value;
    });
    onExtracted(data);
    toast.success('已將辨識結果填入表單');
    // Reset
    setShowResults(false);
    setExtractedFields([]);
    setPreviewUrl(null);
  }, [extractedFields, onExtracted]);

  const handleReset = useCallback(() => {
    setShowResults(false);
    setExtractedFields([]);
    setPreviewUrl(null);
  }, []);

  return (
    <div className="space-y-3">
      {/* Upload buttons */}
      {!showResults && !isProcessing && (
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-5 h-5" />
              <span>上傳函文或拍照，AI 自動辨識案場資料</span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-1" />
                上傳檔案
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-1" />
                拍照上傳
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Processing state */}
      {isProcessing && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center gap-3">
            {previewUrl && (
              <img src={previewUrl} alt="掃描文件" className="w-16 h-16 object-cover rounded border" />
            )}
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">AI 正在辨識文件內容...</span>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {showResults && (
        <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {previewUrl && (
                <img src={previewUrl} alt="掃描文件" className="w-10 h-10 object-cover rounded border" />
              )}
              <div>
                <p className="text-sm font-medium">辨識結果</p>
                <p className="text-xs text-muted-foreground">
                  共辨識 {extractedFields.length} 個欄位
                </p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {extractedFields.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {extractedFields.map((field) => (
                  <div key={field.key} className="flex items-start gap-1.5 text-sm p-1.5 rounded bg-background border">
                    <Check className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <span className="text-muted-foreground text-xs">{field.label}</span>
                      <p className="font-medium truncate">{String(field.value)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                  重新掃描
                </Button>
                <Button type="button" size="sm" onClick={handleApply}>
                  <Check className="w-4 h-4 mr-1" />
                  填入表單
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
              <AlertCircle className="w-4 h-4" />
              <span>未能辨識出資料，請嘗試更清晰的照片或其他文件</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
