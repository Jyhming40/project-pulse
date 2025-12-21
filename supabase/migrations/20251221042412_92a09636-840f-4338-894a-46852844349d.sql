-- Add folder_status enum
CREATE TYPE public.folder_status AS ENUM ('pending', 'created', 'failed');

-- Add Google Drive folder columns to projects table
ALTER TABLE public.projects
ADD COLUMN drive_folder_id text,
ADD COLUMN drive_folder_url text,
ADD COLUMN folder_status public.folder_status DEFAULT 'pending',
ADD COLUMN folder_error text;