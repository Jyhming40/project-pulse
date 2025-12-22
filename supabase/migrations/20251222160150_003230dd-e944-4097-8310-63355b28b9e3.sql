-- Fix function search_path for enforce_investor_code_uppercase
CREATE OR REPLACE FUNCTION public.enforce_investor_code_uppercase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.investor_code := UPPER(NEW.investor_code);
  RETURN NEW;
END;
$$;

-- Fix function search_path for generate_site_code_display
CREATE OR REPLACE FUNCTION public.generate_site_code_display(
  p_intake_year integer,
  p_investor_code text,
  p_seq integer,
  p_approval_date date
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_code text;
  v_approval_year integer;
BEGIN
  v_base_code := p_intake_year::text || UPPER(p_investor_code) || LPAD(p_seq::text, 4, '0');
  
  IF p_approval_date IS NOT NULL THEN
    v_approval_year := EXTRACT(YEAR FROM p_approval_date);
    RETURN v_base_code || '-' || v_approval_year::text;
  END IF;
  
  RETURN v_base_code;
END;
$$;