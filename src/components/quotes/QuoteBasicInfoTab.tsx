import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Loader2, Building2, MapPin, Phone, User } from "lucide-react";
import { QuoteParams } from "@/lib/quoteCalculations";
import { format } from "date-fns";
import QuotePricingSummaryCard from "./QuotePricingSummaryCard";
import QuoteSuggestionCard from "./QuoteSuggestionCard";

interface CostBreakdown {
  engineeringTotal: number;
  modulesTotal: number;
  invertersTotal: number;
}

interface QuoteBasicInfoTabProps {
  formData: Partial<QuoteParams>;
  setFormData: (data: Partial<QuoteParams>) => void;
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  investorId: string | null;
  setInvestorId: (id: string | null) => void;
  onSave: () => void;
  isSaving: boolean;
  costs?: CostBreakdown;
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
  costs,
}: QuoteBasicInfoTabProps) {
  // Fetch projects with full details
  const { data: projects } = useQuery({
    queryKey: ["projects-for-quote"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          id, 
          project_name, 
          site_code_display, 
          capacity_kwp, 
          investor_id,
          address,
          installation_type,
          intake_year,
          fiscal_year,
          approval_date,
          contract_signed_at,
          land_owner,
          land_owner_contact,
          contact_person,
          contact_phone
        `)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Fetch investors
  const { data: investors } = useQuery({
    queryKey: ["investors-for-quote"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investors")
        .select("id, company_name, investor_code, contact_person, phone, email")
        .eq("is_deleted", false)
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  // Get selected project and investor
  const selectedProject = projects?.find((p) => p.id === projectId);
  const selectedInvestor = investors?.find((i) => i.id === investorId);

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

  // Format date helper
  const formatDate = (date: string | null) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "yyyy-MM-dd");
    } catch {
      return "-";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Row: Selectors */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column - Project & Business Unit */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">案場與業務單位</CardTitle>
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
              <Label>業務單位</Label>
              <Select value={investorId || "__none__"} onValueChange={(v) => setInvestorId(v === "__none__" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇業務單位 (選填)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不關聯業務單位</SelectItem>
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

        {/* Right Column - Project Info Summary */}
        {selectedProject && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                案場資訊
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">案場編號</span>
                  <p className="font-medium text-primary">{selectedProject.site_code_display || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">進件年度</span>
                  <p className="font-medium">{selectedProject.intake_year || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">業績年度</span>
                  <p className="font-medium">{selectedProject.fiscal_year || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">裝置類型</span>
                  <p className="font-medium">{selectedProject.installation_type || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">同意備案日期</span>
                  <p className="font-medium">{formatDate(selectedProject.approval_date)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">與客戶簽訂合約日期</span>
                  <p className="font-medium">{formatDate(selectedProject.contract_signed_at)}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    地址
                  </span>
                  <p className="font-medium">{selectedProject.address || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Second Row: Contact & Investor Info */}
      {(selectedProject || selectedInvestor) && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact Info */}
          {selectedProject && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  聯絡資訊
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">聯絡人</span>
                    <p className="font-medium">{selectedProject.contact_person || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">聯絡電話</span>
                    <p className="font-medium">{selectedProject.contact_phone || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">土地所有人</span>
                    <p className="font-medium">{selectedProject.land_owner || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">所有人電話</span>
                    <p className="font-medium">{selectedProject.land_owner_contact || "-"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Investor (Business Unit) Info */}
          {selectedInvestor && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  業務單位資訊
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">公司名稱</span>
                    <p className="font-medium">{selectedInvestor.company_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">聯絡人</span>
                    <p className="font-medium">{selectedInvestor.contact_person || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">電話</span>
                    <p className="font-medium">{selectedInvestor.phone || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email</span>
                    <p className="font-medium text-primary">{selectedInvestor.email || "-"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pricing Summary Card */}
      <QuotePricingSummaryCard
        capacityKwp={formData.capacityKwp || 0}
        pricePerKwp={formData.pricePerKwp || 0}
        taxRate={formData.taxRate || 0.05}
        onPricePerKwpChange={(value) => setFormData({ ...formData, pricePerKwp: value })}
      />

      {/* Quote Suggestion / Insights Card */}
      {costs && (
        <QuoteSuggestionCard
          costs={costs}
          capacityKwp={formData.capacityKwp || 0}
          taxRate={formData.taxRate || 0.05}
        />
      )}

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
