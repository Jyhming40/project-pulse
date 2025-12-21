-- Create table to store user's Google Drive OAuth tokens
CREATE TABLE public.user_drive_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_drive_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only view and manage their own tokens
CREATE POLICY "Users can view own drive tokens"
ON public.user_drive_tokens
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drive tokens"
ON public.user_drive_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drive tokens"
ON public.user_drive_tokens
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drive tokens"
ON public.user_drive_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_drive_tokens_updated_at
BEFORE UPDATE ON public.user_drive_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();