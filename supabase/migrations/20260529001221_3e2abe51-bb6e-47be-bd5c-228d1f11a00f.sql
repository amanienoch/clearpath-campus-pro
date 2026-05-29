
-- Enums
CREATE TYPE public.app_role AS ENUM ('student','department','admin');
CREATE TYPE public.department_t AS ENUM ('Finance','Library','ICT','Registrar','Hostel','Sports');
CREATE TYPE public.clearance_status AS ENUM ('pending','approved','rejected');

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  department public.department_t,
  matric_no text,
  program text,
  faculty text,
  level text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_department(_user_id uuid)
RETURNS public.department_t LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department FROM public.profiles WHERE id = _user_id
$$;

-- clearance_requests
CREATE TABLE public.clearance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clearance_id text NOT NULL UNIQUE,
  student_id uuid NOT NULL,
  student_name text NOT NULL,
  matric_no text NOT NULL,
  program text NOT NULL,
  faculty text NOT NULL,
  level text NOT NULL,
  email text NOT NULL,
  reason text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  overall_status public.clearance_status NOT NULL DEFAULT 'pending'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clearance_requests TO authenticated;
GRANT SELECT ON public.clearance_requests TO anon;
GRANT ALL ON public.clearance_requests TO service_role;
ALTER TABLE public.clearance_requests ENABLE ROW LEVEL SECURITY;

-- dept_reviews
CREATE TABLE public.dept_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.clearance_requests(id) ON DELETE CASCADE,
  department public.department_t NOT NULL,
  status public.clearance_status NOT NULL DEFAULT 'pending',
  remarks text,
  reviewed_by text,
  reviewed_at timestamptz,
  UNIQUE(request_id, department)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dept_reviews TO authenticated;
GRANT SELECT ON public.dept_reviews TO anon;
GRANT ALL ON public.dept_reviews TO service_role;
ALTER TABLE public.dept_reviews ENABLE ROW LEVEL SECURITY;

-- activity_logs
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL,
  target text
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies

-- profiles
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- clearance_requests
CREATE POLICY "cr_select_public" ON public.clearance_requests FOR SELECT USING (true);
CREATE POLICY "cr_insert_student_self" ON public.clearance_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id AND public.has_role(auth.uid(),'student'));
CREATE POLICY "cr_update_admin" ON public.clearance_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (true);
CREATE POLICY "cr_delete_admin" ON public.clearance_requests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- dept_reviews
CREATE POLICY "dr_select_public" ON public.dept_reviews FOR SELECT USING (true);
CREATE POLICY "dr_insert_dept_or_admin" ON public.dept_reviews FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'department') AND department = public.current_department(auth.uid()))
  );
CREATE POLICY "dr_update_dept_or_admin" ON public.dept_reviews FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'department') AND department = public.current_department(auth.uid()))
  ) WITH CHECK (true);

-- activity_logs
CREATE POLICY "al_select_admin" ON public.activity_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "al_insert_auth" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger: recompute clearance_requests.overall_status when dept_reviews change
CREATE OR REPLACE FUNCTION public.recompute_overall_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rid uuid;
  total int;
  approved int;
  rejected int;
  new_status public.clearance_status;
BEGIN
  rid := COALESCE(NEW.request_id, OLD.request_id);
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status='approved'), COUNT(*) FILTER (WHERE status='rejected')
    INTO total, approved, rejected FROM public.dept_reviews WHERE request_id = rid;
  IF total = 6 AND approved = 6 THEN
    new_status := 'approved';
  ELSIF rejected > 0 THEN
    new_status := 'rejected';
  ELSE
    new_status := 'pending';
  END IF;
  UPDATE public.clearance_requests SET overall_status = new_status WHERE id = rid;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_dept_reviews_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.dept_reviews
FOR EACH ROW EXECUTE FUNCTION public.recompute_overall_status();

-- When a clearance_request is created, seed 6 pending dept_reviews
CREATE OR REPLACE FUNCTION public.seed_dept_reviews()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.dept_reviews (request_id, department, status)
  SELECT NEW.id, d, 'pending'
  FROM unnest(ARRAY['Finance','Library','ICT','Registrar','Hostel','Sports']::public.department_t[]) d
  ON CONFLICT (request_id, department) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_cr_seed_reviews
AFTER INSERT ON public.clearance_requests
FOR EACH ROW EXECUTE FUNCTION public.seed_dept_reviews();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.clearance_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dept_reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER TABLE public.clearance_requests REPLICA IDENTITY FULL;
ALTER TABLE public.dept_reviews REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.activity_logs REPLICA IDENTITY FULL;
