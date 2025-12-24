-- Convert projects table enum columns to TEXT for dynamic Codebook support
-- This allows new options to be added via the Codebook without modifying the database schema

-- 1. construction_status: enum -> text
ALTER TABLE public.projects 
ALTER COLUMN construction_status TYPE TEXT USING construction_status::TEXT;

-- 2. installation_type: enum -> text
ALTER TABLE public.projects 
ALTER COLUMN installation_type TYPE TEXT USING installation_type::TEXT;

-- 3. grid_connection_type: enum -> text
ALTER TABLE public.projects 
ALTER COLUMN grid_connection_type TYPE TEXT USING grid_connection_type::TEXT;

-- 4. power_phase_type: enum -> text
ALTER TABLE public.projects 
ALTER COLUMN power_phase_type TYPE TEXT USING power_phase_type::TEXT;

-- 5. power_voltage: enum -> text
ALTER TABLE public.projects 
ALTER COLUMN power_voltage TYPE TEXT USING power_voltage::TEXT;

-- 6. pole_status: enum -> text
ALTER TABLE public.projects 
ALTER COLUMN pole_status TYPE TEXT USING pole_status::TEXT;

-- 7. project_status: enum -> text
ALTER TABLE public.projects 
ALTER COLUMN status TYPE TEXT USING status::TEXT;

-- 8. folder_status: enum -> text (for consistency)
ALTER TABLE public.projects 
ALTER COLUMN folder_status TYPE TEXT USING folder_status::TEXT;

-- Also convert related history tables
-- construction_status_history
ALTER TABLE public.construction_status_history 
ALTER COLUMN status TYPE TEXT USING status::TEXT;

-- project_status_history
ALTER TABLE public.project_status_history 
ALTER COLUMN status TYPE TEXT USING status::TEXT;

-- documents table
ALTER TABLE public.documents 
ALTER COLUMN doc_type TYPE TEXT USING doc_type::TEXT;

ALTER TABLE public.documents 
ALTER COLUMN doc_status TYPE TEXT USING doc_status::TEXT;

-- investors table
ALTER TABLE public.investors 
ALTER COLUMN investor_type TYPE TEXT USING investor_type::TEXT;

-- investor_payment_methods table
ALTER TABLE public.investor_payment_methods 
ALTER COLUMN method_type TYPE TEXT USING method_type::TEXT;

-- investor_contacts table (role_tags is an array of enum)
ALTER TABLE public.investor_contacts 
ALTER COLUMN role_tags TYPE TEXT[] USING role_tags::TEXT[];