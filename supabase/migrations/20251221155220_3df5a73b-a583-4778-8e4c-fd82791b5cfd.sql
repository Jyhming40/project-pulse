-- Add google_email column to user_drive_tokens table
ALTER TABLE public.user_drive_tokens 
ADD COLUMN IF NOT EXISTS google_email text,
ADD COLUMN IF NOT EXISTS google_error text;