import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2 } from "lucide-react";
import { QuoteParams, formatCurrency } from "@/lib/quoteCalculations";

interface QuoteBasicInfoTabProps {
  formData: Partial<QuoteParams>;
  setFormData: (data: Partial<QuoteParams>) => void;
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  investorId: string | null;
  setInvestorId: (id: string | null) => void;
  onSave: () => void;
  isSaving: boolean;
}

export default function QuoteBasicInfoTab({
  formData,
  setFormData,
  projectId,
  setProjectId,
  investorId,
  setInvestorId,
  onSave,
  isSaving,
}: QuoteBasicInfoTabProps) {
  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ["projects-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_name, site_code_display, capacity_kwp, investor_id")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Fetch investors
  const { data: investors } = useQuery({
    queryKey: ["investors-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investors")
        .select("id, company_name, investor_code")
        .eq("is_deleted", false)
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });
  // Handle project selection
  const handleProjectChange = (id: string) => {
    const project = projects?.find((p) => p.id === id);
    setProjectId(id === "__none__" ? null : id);
    
    if (project) {
      // Auto-fill capacity and investor
      if (project.capacity_kwp) {
        setFormData({
          ...formData,
          capacityKwp: Number(project.capacity_kwp),
          panelCount: Math.ceil((Number(project.capacity_kwp) * 1000) / (formData.panelWattage || 590)),
        });
      }
      if (project.investor_id) {
        setInvestorId(project.investor_id);
      }
    }
  };

  // Calculate totals
  const totalPrice = (formData.capacityKwp || 0) * (formData.pricePerKwp || 0);
  const totalPriceWithTax = totalPrice * (1 + (formData.taxRate || 0.05));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column - Project & Investor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">案場與投資方</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>關聯案場</Label>
              <Select value={projectId || "__none__"} onValueChange={handleProjectChange}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇案場 (選填)" />
                </SelectTrigger>
              <SelectContent>
                  <SelectItem value="__none__">不關聯案場</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.site_code_display || p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>投資方</Label>
              <Select value={investorId || "__none__"} onValueChange={(v) => setInvestorId(v === "__none__" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇投資方 (選填)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不關聯投資方</SelectItem>
                  {investors?.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.company_name} ({i.investor_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Basic Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">系統規格</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>規劃容量 (kWp)</Label>
                <Input
                  type="number"
                  value={formData.capacityKwp || ""}
                  onChange={(e) => {
                    const capacity = parseFloat(e.target.value) || 0;
                    setFormData({
                      ...formData,
                      capacityKwp: capacity,
                      panelCount: Math.ceil((capacity * 1000) / (formData.panelWattage || 590)),
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>模組功率 (W)</Label>
                <Input
                  type="number"
                  value={formData.panelWattage || ""}
                  onChange={(e) => setFormData({ ...formData, panelWattage: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>模組數量</Label>
                <Input
                  type="number"
                  value={formData.panelCount || ""}
                  onChange={(e) => setFormData({ ...formData, panelCount: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>逆變器容量 (kW)</Label>
                <Input
                  type="number"
                  value={formData.inverterCapacityKw || ""}
                  onChange={(e) => setFormData({ ...formData, inverterCapacityKw: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>逆變器數量</Label>
              <Input
                type="number"
                value={formData.inverterCount || ""}
                onChange={(e) => setFormData({ ...formData, inverterCount: parseInt(e.target.value) || 1 })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">報價參數</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>每 kWp 報價 (未稅)</Label>
              <Input
                type="number"
                value={formData.pricePerKwp || ""}
                onChange={(e) => setFormData({ ...formData, pricePerKwp: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>稅率 (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={(formData.taxRate || 0) * 100}
                onChange={(e) => setFormData({ ...formData, taxRate: (parseFloat(e.target.value) || 0) / 100 })}
              />
            </div>
            <div className="space-y-2">
              <Label>躉購費率 (元/度)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.tariffRate || ""}
                onChange={(e) => setFormData({ ...formData, tariffRate: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <Separator />

          {/* Summary */}
          <div className="grid gap-4 md:grid-cols-3 bg-muted/50 rounded-lg p-4">
            <div>
              <p className="text-sm text-muted-foreground">總建置價格 (未稅)</p>
              <p className="text-xl font-semibold">{formatCurrency(totalPrice, 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">總建置價格 (含稅)</p>
              <p className="text-xl font-semibold text-primary">{formatCurrency(totalPriceWithTax, 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">每 kWp 單價 (含稅)</p>
              <p className="text-xl font-semibold">
                {formatCurrency((formData.pricePerKwp || 0) * (1 + (formData.taxRate || 0.05)), 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          儲存報價
        </Button>
      </div>
    </div>
  );
}
