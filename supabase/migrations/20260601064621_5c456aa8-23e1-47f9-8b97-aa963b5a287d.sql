
-- 1) Request type enum + column
CREATE TYPE public.request_type_t AS ENUM ('library','finance','ict','hostel','general','graduation');

ALTER TABLE public.clearance_requests
  ADD COLUMN IF NOT EXISTS request_type public.request_type_t NOT NULL DEFAULT 'graduation';

-- 2) Update seed_dept_reviews trigger to route by request_type
CREATE OR REPLACE FUNCTION public.seed_dept_reviews()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  depts public.department_t[];
BEGIN
  depts := CASE NEW.request_type
    WHEN 'library'    THEN ARRAY['Library']::public.department_t[]
    WHEN 'finance'    THEN ARRAY['Finance']::public.department_t[]
    WHEN 'ict'        THEN ARRAY['ICT']::public.department_t[]
    WHEN 'hostel'     THEN ARRAY['Hostel']::public.department_t[]
    WHEN 'general'    THEN ARRAY['Finance','Library','Registrar']::public.department_t[]
    WHEN 'graduation' THEN ARRAY['Finance','Library','ICT','Registrar','Hostel','Sports']::public.department_t[]
  END;
  INSERT INTO public.dept_reviews (request_id, department, status)
  SELECT NEW.id, d, 'pending' FROM unnest(depts) d
  ON CONFLICT (request_id, department) DO NOTHING;
  RETURN NEW;
END $$;

-- 3) Recompute trigger: approve when all dept reviews approved (regardless of count)
CREATE OR REPLACE FUNCTION public.recompute_overall_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rid uuid; total int; approved int; rejected int;
  new_status public.clearance_status;
BEGIN
  rid := COALESCE(NEW.request_id, OLD.request_id);
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status='approved'), COUNT(*) FILTER (WHERE status='rejected')
    INTO total, approved, rejected FROM public.dept_reviews WHERE request_id = rid;
  IF total > 0 AND approved = total THEN new_status := 'approved';
  ELSIF rejected > 0 THEN new_status := 'rejected';
  ELSE new_status := 'pending';
  END IF;
  UPDATE public.clearance_requests SET overall_status = new_status WHERE id = rid;
  RETURN NULL;
END $$;

-- 4) Obligation tables
CREATE TABLE public.library_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  book_title text NOT NULL,
  due_date date NOT NULL,
  returned boolean NOT NULL DEFAULT false,
  fine_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.library_loans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.library_loans TO authenticated;
GRANT ALL ON public.library_loans TO service_role;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY ll_select_public ON public.library_loans FOR SELECT USING (true);
CREATE POLICY ll_write_lib_or_admin ON public.library_loans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'department') AND public.current_department(auth.uid())='Library'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'department') AND public.current_department(auth.uid())='Library'));

CREATE TABLE public.fee_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  item text NOT NULL,
  amount_due numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fee_balances TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fee_balances TO authenticated;
GRANT ALL ON public.fee_balances TO service_role;
ALTER TABLE public.fee_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY fb_select_public ON public.fee_balances FOR SELECT USING (true);
CREATE POLICY fb_write_fin_or_admin ON public.fee_balances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'department') AND public.current_department(auth.uid())='Finance'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'department') AND public.current_department(auth.uid())='Finance'));

CREATE TABLE public.ict_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  asset text NOT NULL,
  returned boolean NOT NULL DEFAULT false,
  replacement_cost numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ict_assets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ict_assets TO authenticated;
GRANT ALL ON public.ict_assets TO service_role;
ALTER TABLE public.ict_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY ia_select_public ON public.ict_assets FOR SELECT USING (true);
CREATE POLICY ia_write_ict_or_admin ON public.ict_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'department') AND public.current_department(auth.uid())='ICT'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'department') AND public.current_department(auth.uid())='ICT'));

CREATE TABLE public.hostel_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  room text NOT NULL,
  checked_out boolean NOT NULL DEFAULT false,
  damage_fee numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hostel_assignments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hostel_assignments TO authenticated;
GRANT ALL ON public.hostel_assignments TO service_role;
ALTER TABLE public.hostel_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ha_select_public ON public.hostel_assignments FOR SELECT USING (true);
CREATE POLICY ha_write_hostel_or_admin ON public.hostel_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'department') AND public.current_department(auth.uid())='Hostel'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'department') AND public.current_department(auth.uid())='Hostel'));
