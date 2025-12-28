import { useState, useRef } from 'react';
import { useAppSettings, AppSettingsUpdate } from '@/hooks/useAppSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  Upload, 
  X, 
  Building2, 
  Palette, 
  Image as ImageIcon,
  Globe,
  Phone,
  Mail,
  MapPin,
  FileText,
  Save,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export default function BrandingSettings() {
  const { 
    settings, 
    isLoading, 
    updateSettings, 
    isUpdating, 
    uploadFile,
    refetch 
  } = useAppSettings();

  const [formData, setFormData] = useState<AppSettingsUpdate>({});
  const [isDirty, setIsDirty] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const logoLightRef = useRef<HTMLInputElement>(null);
  const logoDarkRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  // Initialize form when settings load
  const initForm = () => {
    if (settings) {
      setFormData({
        system_name_zh: settings.system_name_zh,
        system_name_en: settings.system_name_en || '',
        company_name_zh: settings.company_name_zh || '',
        company_name_en: settings.company_name_en || '',
        tax_id: settings.tax_id || '',
        address: settings.address || '',
        phone: settings.phone || '',
        email: settings.email || '',
        website: settings.website || '',
        logo_light_url: settings.logo_light_url || '',
        logo_dark_url: settings.logo_dark_url || '',
        favicon_url: settings.favicon_url || '',
        primary_color: settings.primary_color || '',
      });
      setIsDirty(false);
    }
  };

  // Initialize on first load
  if (settings && Object.keys(formData).length === 0) {
    initForm();
  }

  const handleChange = (field: keyof AppSettingsUpdate, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logo_light_url' | 'logo_dark_url' | 'favicon_url'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/ico'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.ico')) {
      toast.error('請上傳 PNG、JPG、SVG 或 ICO 格式的圖片');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('檔案大小不可超過 2MB');
      return;
    }

    setUploadingField(field);
    try {
      const timestamp = Date.now();
      const ext = file.name.split('.').pop();
      const path = `${field.replace('_url', '')}-${timestamp}.${ext}`;
      
      const url = await uploadFile(file, path);
      if (url) {
        handleChange(field, url);
        toast.success('圖片上傳成功');
      }
    } finally {
      setUploadingField(null);
      // Reset input
      if (field === 'logo_light_url' && logoLightRef.current) {
        logoLightRef.current.value = '';
      } else if (field === 'logo_dark_url' && logoDarkRef.current) {
        logoDarkRef.current.value = '';
      } else if (field === 'favicon_url' && faviconRef.current) {
        faviconRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    try {
      await updateSettings(formData);
      setIsDirty(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleReset = () => {
    initForm();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Alert variant="destructive">
        <AlertDescription>無法載入品牌設定</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">品牌與公司資訊</h2>
          <p className="text-sm text-muted-foreground">
            設定系統名稱、公司識別與 Logo，變更將即時套用至全站
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button variant="outline" onClick={handleReset} disabled={isUpdating}>
              <RefreshCw className="w-4 h-4 mr-2" />
              重設
            </Button>
          )}
          <Button onClick={handleSave} disabled={!isDirty || isUpdating}>
            {isUpdating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            儲存變更
          </Button>
        </div>
      </div>

      <Tabs defaultValue="identity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="identity" className="gap-2">
            <Building2 className="w-4 h-4" />
            系統識別
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-2">
            <FileText className="w-4 h-4" />
            公司資訊
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <ImageIcon className="w-4 h-4" />
            Logo 與圖示
          </TabsTrigger>
          <TabsTrigger value="theme" className="gap-2">
            <Palette className="w-4 h-4" />
            主題色彩
          </TabsTrigger>
        </TabsList>

        {/* System Identity */}
        <TabsContent value="identity">
          <Card>
            <CardHeader>
              <CardTitle>系統識別</CardTitle>
              <CardDescription>設定系統顯示名稱，將顯示於選單與頁首</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="system_name_zh">系統名稱（中文）*</Label>
                  <Input
                    id="system_name_zh"
                    value={formData.system_name_zh || ''}
                    onChange={(e) => handleChange('system_name_zh', e.target.value)}
                    placeholder="例：光電專案管理系統"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="system_name_en">系統名稱（英文）</Label>
                  <Input
                    id="system_name_en"
                    value={formData.system_name_en || ''}
                    onChange={(e) => handleChange('system_name_en', e.target.value)}
                    placeholder="e.g. Solar Project Management System"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Info */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>公司資訊</CardTitle>
              <CardDescription>用於匯出報表、頁尾顯示等</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name_zh">公司名稱（中文）</Label>
                  <Input
                    id="company_name_zh"
                    value={formData.company_name_zh || ''}
                    onChange={(e) => handleChange('company_name_zh', e.target.value)}
                    placeholder="例：明群環能有限公司"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name_en">公司名稱（英文）</Label>
                  <Input
                    id="company_name_en"
                    value={formData.company_name_en || ''}
                    onChange={(e) => handleChange('company_name_en', e.target.value)}
                    placeholder="e.g. MingChun Energy Co., Ltd."
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tax_id" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    統一編號
                  </Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id || ''}
                    onChange={(e) => handleChange('tax_id', e.target.value)}
                    placeholder="例：12345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    公司電話
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="例：02-1234-5678"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    電子信箱
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="例：contact@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    公司網站
                  </Label>
                  <Input
                    id="website"
                    value={formData.website || ''}
                    onChange={(e) => handleChange('website', e.target.value)}
                    placeholder="例：https://www.company.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  公司地址
                </Label>
                <Textarea
                  id="address"
                  value={formData.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="例：台北市中山區XX路XX號"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logo & Icons */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Logo 與圖示</CardTitle>
              <CardDescription>上傳公司 Logo 與網站 Favicon（支援 PNG、JPG、SVG、ICO，最大 2MB）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Light Logo */}
              <div className="space-y-3">
                <Label>淺色模式 Logo</Label>
                <p className="text-xs text-muted-foreground">用於深色背景（如側邊欄）</p>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-16 border rounded-lg flex items-center justify-center bg-sidebar overflow-hidden">
                    {formData.logo_light_url ? (
                      <img 
                        src={formData.logo_light_url} 
                        alt="Light logo" 
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={logoLightRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      onChange={(e) => handleFileUpload(e, 'logo_light_url')}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoLightRef.current?.click()}
                      disabled={uploadingField === 'logo_light_url'}
                    >
                      {uploadingField === 'logo_light_url' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      上傳
                    </Button>
                    {formData.logo_light_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleChange('logo_light_url', '')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Dark Logo */}
              <div className="space-y-3">
                <Label>深色模式 Logo</Label>
                <p className="text-xs text-muted-foreground">用於淺色背景</p>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-16 border rounded-lg flex items-center justify-center bg-background overflow-hidden">
                    {formData.logo_dark_url ? (
                      <img 
                        src={formData.logo_dark_url} 
                        alt="Dark logo" 
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={logoDarkRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      onChange={(e) => handleFileUpload(e, 'logo_dark_url')}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoDarkRef.current?.click()}
                      disabled={uploadingField === 'logo_dark_url'}
                    >
                      {uploadingField === 'logo_dark_url' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      上傳
                    </Button>
                    {formData.logo_dark_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleChange('logo_dark_url', '')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Favicon */}
              <div className="space-y-3">
                <Label>網站圖示 (Favicon)</Label>
                <p className="text-xs text-muted-foreground">瀏覽器分頁上顯示的小圖示，建議使用 32x32 或 64x64 的 ICO/PNG</p>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 border rounded-lg flex items-center justify-center bg-muted overflow-hidden">
                    {formData.favicon_url ? (
                      <img 
                        src={formData.favicon_url} 
                        alt="Favicon" 
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={faviconRef}
                      type="file"
                      accept="image/png,image/x-icon,image/ico,.ico"
                      onChange={(e) => handleFileUpload(e, 'favicon_url')}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => faviconRef.current?.click()}
                      disabled={uploadingField === 'favicon_url'}
                    >
                      {uploadingField === 'favicon_url' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      上傳
                    </Button>
                    {formData.favicon_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleChange('favicon_url', '')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Theme */}
        <TabsContent value="theme">
          <Card>
            <CardHeader>
              <CardTitle>主題色彩</CardTitle>
              <CardDescription>自訂系統主色（選用功能，未來擴充）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">主要色彩</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.primary_color || '#2a9d8f'}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color || ''}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    placeholder="#2a9d8f"
                    className="w-32"
                  />
                  <div 
                    className="w-10 h-10 rounded-lg border"
                    style={{ backgroundColor: formData.primary_color || '#2a9d8f' }}
                  />
                  {formData.primary_color && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleChange('primary_color', '')}
                    >
                      <X className="w-4 h-4" />
                      恢復預設
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  變更將套用至系統的主色調（按鈕、連結、強調色等）
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
