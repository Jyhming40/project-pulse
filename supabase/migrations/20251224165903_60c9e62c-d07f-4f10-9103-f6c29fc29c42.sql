-- ========================================
-- Partners/Contractors Management Tables
-- ========================================

-- Create partner_type enum for Codebook usage
-- Note: We'll use system_options table (Codebook) for partner_type values

-- Create partners table (外包夥伴主資料)
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  partner_type TEXT, -- References system_options (Codebook) for 'partner_type'
  contact_person TEXT,
  contact_phone TEXT,
  email TEXT,
  address TEXT,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on partner name for upsert operations
CREATE UNIQUE INDEX idx_partners_name_unique ON public.partners (name) WHERE is_active = true;

-- Create project_construction_assignments table (案場工程項目指派)
CREATE TABLE public.project_construction_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  construction_work_type TEXT NOT NULL, -- References system_options (Codebook) for 'construction_work_type'
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  assignment_status TEXT NOT NULL DEFAULT '預計', -- References system_options for 'construction_assignment_status'
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_project_construction_assignments_project ON public.project_construction_assignments(project_id);
CREATE INDEX idx_project_construction_assignments_partner ON public.project_construction_assignments(partner_id);

-- Enable RLS on partners table
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Enable RLS on project_construction_assignments table
ALTER TABLE public.project_construction_assignments ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS Policies for partners
-- ========================================

-- All authenticated users can view partners
CREATE POLICY "All authenticated can view partners"
ON public.partners
FOR SELECT
USING (true);

-- Admin and staff can insert partners
CREATE POLICY "Admin and staff can insert partners"
ON public.partners
FOR INSERT
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role]));

-- Admin and staff can update partners
CREATE POLICY "Admin and staff can update partners"
ON public.partners
FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role]));

-- Only admin can delete partners
CREATE POLICY "Only admin can delete partners"
ON public.partners
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ========================================
-- RLS Policies for project_construction_assignments
-- ========================================

-- All authenticated users can view assignments
CREATE POLICY "All authenticated can view construction assignments"
ON public.project_construction_assignments
FOR SELECT
USING (true);

-- Admin and staff can insert assignments
CREATE POLICY "Admin and staff can insert construction assignments"
ON public.project_construction_assignments
FOR INSERT
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role]));

-- Admin and staff can update assignments
CREATE POLICY "Admin and staff can update construction assignments"
ON public.project_construction_assignments
FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role]));

-- Only admin can delete assignments
CREATE POLICY "Only admin can delete construction assignments"
ON public.project_construction_assignments
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ========================================
-- Triggers for updated_at
-- ========================================

CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_project_construction_assignments_updated_at
  BEFORE UPDATE ON public.project_construction_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();