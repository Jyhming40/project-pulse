-- Create construction status history table
CREATE TABLE public.construction_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status construction_status NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  note TEXT
);

-- Enable RLS
ALTER TABLE public.construction_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "All authenticated can view construction status history"
ON public.construction_status_history
FOR SELECT
USING (true);

CREATE POLICY "Admin and staff can insert construction status history"
ON public.construction_status_history
FOR INSERT
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role]));

CREATE POLICY "Admin and staff can update construction status history"
ON public.construction_status_history
FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role]));

CREATE POLICY "Only admin can delete construction status history"
ON public.construction_status_history
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger function to record construction status changes
CREATE OR REPLACE FUNCTION public.record_construction_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.construction_status IS DISTINCT FROM NEW.construction_status)) THEN
    INSERT INTO public.construction_status_history (project_id, status, changed_by)
    VALUES (NEW.id, NEW.construction_status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER record_construction_status_change
AFTER INSERT OR UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.record_construction_status_history();