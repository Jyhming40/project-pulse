-- Drop existing FK to auth.users and add FK to profiles
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_owner_user_id_fkey;

ALTER TABLE public.documents
ADD CONSTRAINT documents_owner_user_id_fkey
FOREIGN KEY (owner_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;