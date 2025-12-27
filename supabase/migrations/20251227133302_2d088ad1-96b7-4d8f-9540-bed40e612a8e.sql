
-- Add tax_id column to partners table
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS tax_id text;

-- Create partner_contacts table
CREATE TABLE IF NOT EXISTS public.partner_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  role text,
  phone text,
  email text,
  note text,
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.partner_contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for partner_contacts
CREATE POLICY "All authenticated can view partner contacts" 
  ON public.partner_contacts 
  FOR SELECT 
  USING (true);

CREATE POLICY "Admin and staff can insert partner contacts" 
  ON public.partner_contacts 
  FOR INSERT 
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role]));

CREATE POLICY "Admin and staff can update partner contacts" 
  ON public.partner_contacts 
  FOR UPDATE 
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role]));

CREATE POLICY "Only admin can delete partner contacts" 
  ON public.partner_contacts 
  FOR DELETE 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_partner_contacts_updated_at
  BEFORE UPDATE ON public.partner_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_partner_contacts_partner_id ON public.partner_contacts(partner_id);
