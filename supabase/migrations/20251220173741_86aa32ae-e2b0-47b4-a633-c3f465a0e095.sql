-- Create enums for roles and statuses
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'viewer');
CREATE TYPE public.project_status AS ENUM (
  '開發中', '土地確認', '結構簽證', '台電送件', '台電審查', 
  '能源局送件', '同意備案', '工程施工', '報竣掛表', '設備登記', 
  '運維中', '暫停', '取消'
);
CREATE TYPE public.doc_status AS ENUM ('未開始', '進行中', '已完成', '退件補正');
CREATE TYPE public.doc_type AS ENUM (
  '台電審查意見書', '能源局同意備案', '結構簽證', '躉售合約', 
  '報竣掛表', '設備登記', '土地契約', '其他'
);

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Investors table
CREATE TABLE public.investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_code TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  tax_id TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  investor_id UUID REFERENCES public.investors(id),
  status project_status NOT NULL DEFAULT '開發中',
  capacity_kwp DECIMAL(10,2),
  feeder_code TEXT,
  city TEXT,
  district TEXT,
  address TEXT,
  coordinates TEXT,
  land_owner TEXT,
  land_owner_contact TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  note TEXT,
  fiscal_year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Project status history
CREATE TABLE public.project_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status project_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  attachment_path TEXT,
  changed_by UUID REFERENCES auth.users(id)
);

-- Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  doc_type doc_type NOT NULL,
  doc_status doc_status NOT NULL DEFAULT '未開始',
  submitted_at DATE,
  issued_at DATE,
  due_at DATE,
  owner_user_id UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Document files
CREATE TABLE public.document_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_projects_investor ON public.projects(investor_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_city ON public.projects(city);
CREATE INDEX idx_projects_fiscal_year ON public.projects(fiscal_year);
CREATE INDEX idx_project_status_history_project ON public.project_status_history(project_id);
CREATE INDEX idx_project_status_history_changed_at ON public.project_status_history(changed_at);
CREATE INDEX idx_documents_project ON public.documents(project_id);
CREATE INDEX idx_documents_due_at ON public.documents(due_at);
CREATE INDEX idx_documents_status ON public.documents(doc_status);
CREATE INDEX idx_document_files_document ON public.document_files(document_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user has any of the specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- Function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'staff' THEN 2 
      WHEN 'viewer' THEN 3 
    END
  LIMIT 1
$$;

-- Profiles RLS Policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- User Roles RLS Policies
CREATE POLICY "Users can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Investors RLS Policies
CREATE POLICY "All authenticated can view investors"
  ON public.investors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and staff can insert investors"
  ON public.investors FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'staff']::app_role[]));

CREATE POLICY "Admin and staff can update investors"
  ON public.investors FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'staff']::app_role[]));

CREATE POLICY "Only admin can delete investors"
  ON public.investors FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Projects RLS Policies
CREATE POLICY "All authenticated can view projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and staff can insert projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'staff']::app_role[]));

CREATE POLICY "Admin and staff can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'staff']::app_role[]));

CREATE POLICY "Only admin can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Project Status History RLS Policies
CREATE POLICY "All authenticated can view status history"
  ON public.project_status_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and staff can insert status history"
  ON public.project_status_history FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'staff']::app_role[]));

CREATE POLICY "Admin and staff can update status history"
  ON public.project_status_history FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'staff']::app_role[]));

CREATE POLICY "Only admin can delete status history"
  ON public.project_status_history FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Documents RLS Policies
CREATE POLICY "All authenticated can view documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and staff can insert documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'staff']::app_role[]));

CREATE POLICY "Admin and staff can update documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'staff']::app_role[]));

CREATE POLICY "Only admin can delete documents"
  ON public.documents FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Document Files RLS Policies
CREATE POLICY "All authenticated can view document files"
  ON public.document_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and staff can insert document files"
  ON public.document_files FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'staff']::app_role[]));

CREATE POLICY "Admin and staff can update document files"
  ON public.document_files FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'staff']::app_role[]));

CREATE POLICY "Only admin can delete document files"
  ON public.document_files FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  
  -- Assign viewer role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update fiscal_year when status changes to '同意備案'
CREATE OR REPLACE FUNCTION public.update_fiscal_year()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = '同意備案' AND (OLD.status IS NULL OR OLD.status != '同意備案') THEN
    NEW.fiscal_year := EXTRACT(YEAR FROM now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_status_change
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_fiscal_year();

-- Trigger to auto-record status history
CREATE OR REPLACE FUNCTION public.record_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
    INSERT INTO public.project_status_history (project_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_insert_or_update
  AFTER INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.record_status_history();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_investors_updated_at
  BEFORE UPDATE ON public.investors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false);

-- Storage RLS policies
CREATE POLICY "Authenticated users can view documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Admin and staff can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' 
    AND public.has_any_role(auth.uid(), ARRAY['admin', 'staff']::app_role[])
  );

CREATE POLICY "Admin and staff can update documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents' 
    AND public.has_any_role(auth.uid(), ARRAY['admin', 'staff']::app_role[])
  );

CREATE POLICY "Only admin can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents' 
    AND public.has_role(auth.uid(), 'admin')
  );