-- 1. Add work_capabilities column to partners table
ALTER TABLE public.partners 
ADD COLUMN IF NOT EXISTS work_capabilities text[] DEFAULT '{}';

-- 2. Migrate existing contact data to partner_contacts table
INSERT INTO public.partner_contacts (partner_id, contact_name, phone, email, is_primary, note)
SELECT 
  id as partner_id,
  contact_person as contact_name,
  contact_phone as phone,
  email,
  true as is_primary,
  '從主表遷移' as note
FROM public.partners
WHERE contact_person IS NOT NULL 
  AND contact_person != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.partner_contacts pc 
    WHERE pc.partner_id = partners.id 
    AND pc.contact_name = partners.contact_person
  );