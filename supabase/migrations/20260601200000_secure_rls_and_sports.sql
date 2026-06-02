-- Secure RLS policies

DROP POLICY IF EXISTS "ll_select_public" ON public.library_loans;
DROP POLICY IF EXISTS "fb_select_public" ON public.fee_balances;
DROP POLICY IF EXISTS "ia_select_public" ON public.ict_assets;
DROP POLICY IF EXISTS "ha_select_public" ON public.hostel_assignments;
DROP POLICY IF EXISTS "cr_select_public" ON public.clearance_requests;
DROP POLICY IF EXISTS "dr_select_public" ON public.dept_reviews;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;

DROP POLICY IF EXISTS "profiles_select_secure" ON public.profiles;
CREATE POLICY "profiles_select_secure" ON public.profiles FOR SELECT USING (
  id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'department')
);

DROP POLICY IF EXISTS "cr_select_secure" ON public.clearance_requests;
CREATE POLICY "cr_select_secure" ON public.clearance_requests FOR SELECT USING (
  student_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'department')
);

DROP POLICY IF EXISTS "dr_select_secure" ON public.dept_reviews;
CREATE POLICY "dr_select_secure" ON public.dept_reviews FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clearance_requests cr WHERE cr.id = request_id AND cr.student_id = auth.uid()) 
  OR public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'department')
);

DROP POLICY IF EXISTS "ll_select_secure" ON public.library_loans;
CREATE POLICY "ll_select_secure" ON public.library_loans FOR SELECT USING (
  student_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'department')
);

DROP POLICY IF EXISTS "fb_select_secure" ON public.fee_balances;
CREATE POLICY "fb_select_secure" ON public.fee_balances FOR SELECT USING (
  student_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'department')
);

DROP POLICY IF EXISTS "ia_select_secure" ON public.ict_assets;
CREATE POLICY "ia_select_secure" ON public.ict_assets FOR SELECT USING (
  student_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'department')
);

DROP POLICY IF EXISTS "ha_select_secure" ON public.hostel_assignments;
CREATE POLICY "ha_select_secure" ON public.hostel_assignments FOR SELECT USING (
  student_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'department')
);

-- Add missing sports_loans table
CREATE TABLE IF NOT EXISTS public.sports_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  equipment text NOT NULL,
  returned boolean NOT NULL DEFAULT false,
  replacement_cost numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sports_loans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sports_loans TO authenticated;
GRANT ALL ON public.sports_loans TO service_role;
ALTER TABLE public.sports_loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sl_select_secure ON public.sports_loans;
CREATE POLICY sl_select_secure ON public.sports_loans FOR SELECT USING (
  student_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'department')
);

DROP POLICY IF EXISTS sl_write_sports_or_admin ON public.sports_loans;
CREATE POLICY sl_write_sports_or_admin ON public.sports_loans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'department') AND public.current_department(auth.uid())='Sports'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'department') AND public.current_department(auth.uid())='Sports'));

-- Safely add to publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sports_loans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_loans;
  END IF;
END $$;
ALTER TABLE public.sports_loans REPLICA IDENTITY FULL;
