-- 1. Add unique constraint on investor_code (ensure uppercase)
ALTER TABLE public.investors 
ADD CONSTRAINT investors_investor_code_unique UNIQUE (investor_code);

-- 2. Add new columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS intake_year integer DEFAULT EXTRACT(YEAR FROM now()),
ADD COLUMN IF NOT EXISTS seq integer,
ADD COLUMN IF NOT EXISTS site_code_display text,
ADD COLUMN IF NOT EXISTS approval_date date;

-- 3. Create investor year counter table for atomic sequence generation
CREATE TABLE public.investor_year_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  investor_code text NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, investor_code)
);

-- Enable RLS on counter table
ALTER TABLE public.investor_year_counters ENABLE ROW LEVEL SECURITY;

-- RLS policies for counter table
CREATE POLICY "All authenticated can view counters"
ON public.investor_year_counters FOR SELECT
USING (true);

CREATE POLICY "Admin and staff can insert counters"
ON public.investor_year_counters FOR INSERT
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role]));

CREATE POLICY "Admin and staff can update counters"
ON public.investor_year_counters FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role]));

-- 4. Create unique constraint on projects to prevent duplicate sequences
CREATE UNIQUE INDEX projects_intake_year_investor_seq_unique 
ON public.projects (intake_year, investor_id, seq) 
WHERE seq IS NOT NULL;

-- 5. Function to generate next sequence number atomically
CREATE OR REPLACE FUNCTION public.get_next_project_seq(
  p_year integer,
  p_investor_code text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_seq integer;
BEGIN
  -- Insert or update counter atomically
  INSERT INTO public.investor_year_counters (year, investor_code, last_seq)
  VALUES (p_year, UPPER(p_investor_code), 1)
  ON CONFLICT (year, investor_code)
  DO UPDATE SET 
    last_seq = investor_year_counters.last_seq + 1,
    updated_at = now()
  RETURNING last_seq INTO v_next_seq;
  
  RETURN v_next_seq;
END;
$$;

-- 6. Function to generate site_code_display
CREATE OR REPLACE FUNCTION public.generate_site_code_display(
  p_intake_year integer,
  p_investor_code text,
  p_seq integer,
  p_approval_date date
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_base_code text;
  v_approval_year integer;
BEGIN
  -- Base code: {intake_year}{investor_code}{seq padded to 4 digits}
  v_base_code := p_intake_year::text || UPPER(p_investor_code) || LPAD(p_seq::text, 4, '0');
  
  -- If approval_date exists, append -YYYY
  IF p_approval_date IS NOT NULL THEN
    v_approval_year := EXTRACT(YEAR FROM p_approval_date);
    RETURN v_base_code || '-' || v_approval_year::text;
  END IF;
  
  RETURN v_base_code;
END;
$$;

-- 7. Trigger to update site_code_display when approval_date changes
CREATE OR REPLACE FUNCTION public.update_site_code_display()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_investor_code text;
BEGIN
  -- Get investor_code from investors table
  SELECT investor_code INTO v_investor_code
  FROM public.investors
  WHERE id = NEW.investor_id;
  
  -- Update site_code_display if we have all required fields
  IF NEW.intake_year IS NOT NULL AND v_investor_code IS NOT NULL AND NEW.seq IS NOT NULL THEN
    NEW.site_code_display := public.generate_site_code_display(
      NEW.intake_year,
      v_investor_code,
      NEW.seq,
      NEW.approval_date
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_project_site_code_display
BEFORE INSERT OR UPDATE OF approval_date, intake_year, investor_id, seq
ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_site_code_display();

-- 8. Trigger to enforce uppercase on investor_code
CREATE OR REPLACE FUNCTION public.enforce_investor_code_uppercase()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.investor_code := UPPER(NEW.investor_code);
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_investor_code_uppercase_trigger
BEFORE INSERT OR UPDATE OF investor_code
ON public.investors
FOR EACH ROW
EXECUTE FUNCTION public.enforce_investor_code_uppercase();