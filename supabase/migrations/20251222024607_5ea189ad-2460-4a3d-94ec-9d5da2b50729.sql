-- Fix: profiles_email_exposure - Restrict profile visibility to admin/staff or own profile

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create policy allowing admin/staff to view all profiles
CREATE POLICY "Admin and staff can view all profiles" 
  ON public.profiles 
  FOR SELECT 
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'staff'::app_role]));

-- Create policy allowing users to view their own profile
CREATE POLICY "Users can view own profile" 
  ON public.profiles 
  FOR SELECT 
  TO authenticated
  USING (id = auth.uid());