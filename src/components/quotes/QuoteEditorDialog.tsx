import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, FileText, TrendingUp, Calendar } from "lucide-react";
import { toast } from "sonner";
import QuoteBasicInfoTab from "./QuoteBasicInfoTab";
import QuoteCostCalculatorTab from "./QuoteCostCalculatorTab";
import QuoteFinancialAnalysisTab from "./QuoteFinancialAnalysisTab";
import QuoteScheduleTab from "./QuoteScheduleTab";
import { calculate20YearProjection, QuoteParams } from "@/lib/quoteCalculations";

interface QuoteEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string | null;
}

export default function QuoteEditorDialog({
  open,
  onOpenChange,
  quoteId,
}: QuoteEditorDialogProps) {
  const [activeTab, setActiveTab] = useState("basic");
  const [formData, setFormData] = useState<Partial<QuoteParams>>({
    capacityKwp: 100,
    panelWattage: 590,
    panelCount: 170,
    inverterCapacityKw: 50,
    inverterCount: 2,
    pricePerKwp: 45000,
    taxRate: 0.05,
    tariffRate: 4.5,
    highEfficiencyBonus: 0.06,
    sunshineHours: 3.2,
    annualDegradationRate: 0.01,
    loanPercentage: 70,
    loanInterestRate: 0.0245,
    loanTermMonths: 180,
    insuranceRate: 0.0055,
    maintenanceRate6To10: 6,
    maintenanceRate11To15: 7,
    maintenanceRate16To20: 8,
    rentRate: 8,
  });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [investorId, setInvestorId] = useState<string | null>(null);

  // Calculate projections
  const projections = formData.capacityKwp
    ? calculate20YearProjection(formData as QuoteParams)
    : null;

  const handleSave = () => {
    toast.success("報價資料已暫存（資料庫功能開發中）");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {quoteId ? `編輯報價` : "新增報價"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic" className="gap-2">
              <FileText className="w-4 h-4" />
              基本資訊
            </TabsTrigger>
            <TabsTrigger value="cost" className="gap-2">
              <Calculator className="w-4 h-4" />
              成本報價
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              投資分析
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <Calendar className="w-4 h-4" />
              工程時程
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="basic" className="m-0">
              <QuoteBasicInfoTab
                formData={formData}
                setFormData={setFormData}
                projectId={projectId}
                setProjectId={setProjectId}
                investorId={investorId}
                setInvestorId={setInvestorId}
                onSave={handleSave}
                isSaving={false}
              />
            </TabsContent>

            <TabsContent value="cost" className="m-0">
              <QuoteCostCalculatorTab
                formData={formData}
                setFormData={setFormData}
              />
            </TabsContent>

            <TabsContent value="financial" className="m-0">
              <QuoteFinancialAnalysisTab
                formData={formData as QuoteParams}
                projections={projections}
              />
            </TabsContent>

            <TabsContent value="schedule" className="m-0">
              <QuoteScheduleTab quoteId={quoteId} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
