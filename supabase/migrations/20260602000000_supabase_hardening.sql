-- Drop old select policies to replace them with hardened ones
DROP POLICY IF EXISTS "profiles_select_secure" ON public.profiles;
DROP POLICY IF EXISTS "cr_select_secure" ON public.clearance_requests;
DROP POLICY IF EXISTS "dr_select_secure" ON public.dept_reviews;
DROP POLICY IF EXISTS "ll_select_secure" ON public.library_loans;
DROP POLICY IF EXISTS "fb_select_secure" ON public.fee_balances;
DROP POLICY IF EXISTS "ia_select_secure" ON public.ict_assets;
DROP POLICY IF EXISTS "ha_select_secure" ON public.hostel_assignments;
DROP POLICY IF EXISTS "sl_select_secure" ON public.sports_loans;

-- Hardened profiles select: Student sees self, Admin/Department sees all
CREATE POLICY "profiles_select_secure" ON public.profiles FOR SELECT USING (
  id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'department')
);

-- Hardened clearance_requests select: Student sees self, Admin sees all, 
-- Department officer ONLY sees requests routed to their department
CREATE POLICY "cr_select_secure" ON public.clearance_requests FOR SELECT USING (
  student_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin') 
  OR (
    public.has_role(auth.uid(), 'department')
    AND EXISTS (
      SELECT 1 FROM public.dept_reviews dr 
      WHERE dr.request_id = id 
      AND dr.department = public.current_department(auth.uid())
    )
  )
);

-- Hardened dept_reviews select: Student sees own request reviews, Admin sees all,
-- Department officer ONLY sees reviews for requests routed to their department
CREATE POLICY "dr_select_secure" ON public.dept_reviews FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clearance_requests cr WHERE cr.id = request_id AND cr.student_id = auth.uid()) 
  OR public.has_role(auth.uid(), 'admin') 
  OR (
    public.has_role(auth.uid(), 'department')
    AND EXISTS (
      SELECT 1 FROM public.dept_reviews dr2
      WHERE dr2.request_id = request_id 
      AND dr2.department = public.current_department(auth.uid())
    )
  )
);

-- Hardened obligation table select: Student sees self, Admin sees all,
-- Department officer ONLY sees their own department's data
CREATE POLICY "ll_select_secure" ON public.library_loans FOR SELECT USING (
  student_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin') 
  OR (public.has_role(auth.uid(), 'department') AND public.current_department(auth.uid()) = 'Library')
);

CREATE POLICY "fb_select_secure" ON public.fee_balances FOR SELECT USING (
  student_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin') 
  OR (public.has_role(auth.uid(), 'department') AND public.current_department(auth.uid()) = 'Finance')
);

CREATE POLICY "ia_select_secure" ON public.ict_assets FOR SELECT USING (
  student_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin') 
  OR (public.has_role(auth.uid(), 'department') AND public.current_department(auth.uid()) = 'ICT')
);

CREATE POLICY "ha_select_secure" ON public.hostel_assignments FOR SELECT USING (
  student_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin') 
  OR (public.has_role(auth.uid(), 'department') AND public.current_department(auth.uid()) = 'Hostel')
);

CREATE POLICY "sl_select_secure" ON public.sports_loans FOR SELECT USING (
  student_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin') 
  OR (public.has_role(auth.uid(), 'department') AND public.current_department(auth.uid()) = 'Sports')
);

-- Add missing performance indexes to accelerate student_id filters and RLS checks
CREATE INDEX IF NOT EXISTS idx_clearance_requests_student_id ON public.clearance_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_library_loans_student_id ON public.library_loans(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_balances_student_id ON public.fee_balances(student_id);
CREATE INDEX IF NOT EXISTS idx_ict_assets_student_id ON public.ict_assets(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_assignments_student_id ON public.hostel_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_sports_loans_student_id ON public.sports_loans(student_id);
