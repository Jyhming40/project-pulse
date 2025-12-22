-- Create table for custom dropdown options
CREATE TABLE public.system_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- 'project_status', 'doc_type', 'doc_status'
  value text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(category, value)
);

-- Enable RLS
ALTER TABLE public.system_options ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view options
CREATE POLICY "All authenticated can view system options"
ON public.system_options
FOR SELECT
TO authenticated
USING (true);

-- Only admin can manage options
CREATE POLICY "Only admin can insert system options"
ON public.system_options
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admin can update system options"
ON public.system_options
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admin can delete system options"
ON public.system_options
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_system_options_updated_at
  BEFORE UPDATE ON public.system_options
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Insert default options based on existing enums
-- Project statuses
INSERT INTO public.system_options (category, value, label, sort_order) VALUES
  ('project_status', '開發中', '開發中', 1),
  ('project_status', '土地確認', '土地確認', 2),
  ('project_status', '結構簽證', '結構簽證', 3),
  ('project_status', '台電送件', '台電送件', 4),
  ('project_status', '台電審查', '台電審查', 5),
  ('project_status', '能源局送件', '能源局送件', 6),
  ('project_status', '同意備案', '同意備案', 7),
  ('project_status', '工程施工', '工程施工', 8),
  ('project_status', '報竣掛表', '報竣掛表', 9),
  ('project_status', '設備登記', '設備登記', 10),
  ('project_status', '運維中', '運維中', 11),
  ('project_status', '暫停', '暫停', 12),
  ('project_status', '取消', '取消', 13);

-- Document types
INSERT INTO public.system_options (category, value, label, sort_order) VALUES
  ('doc_type', '台電審查意見書', '台電審查意見書', 1),
  ('doc_type', '能源局同意備案', '能源局同意備案', 2),
  ('doc_type', '結構簽證', '結構簽證', 3),
  ('doc_type', '躉售合約', '躉售合約', 4),
  ('doc_type', '報竣掛表', '報竣掛表', 5),
  ('doc_type', '設備登記', '設備登記', 6),
  ('doc_type', '土地契約', '土地契約', 7),
  ('doc_type', '其他', '其他', 8);

-- Document statuses
INSERT INTO public.system_options (category, value, label, sort_order) VALUES
  ('doc_status', '未開始', '未開始', 1),
  ('doc_status', '進行中', '進行中', 2),
  ('doc_status', '已完成', '已完成', 3),
  ('doc_status', '退件補正', '退件補正', 4);