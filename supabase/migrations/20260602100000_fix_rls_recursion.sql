-- Break mutual RLS recursion between clearance_requests and dept_reviews

CREATE OR REPLACE FUNCTION public.get_request_student_id(req_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT student_id FROM public.clearance_requests WHERE id = req_id;
$$;

CREATE OR REPLACE FUNCTION public.is_request_routed_to_department(req_id uuid, dept public.department_t)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dept_reviews 
    WHERE request_id = req_id AND department = dept
  );
$$;

DROP POLICY IF EXISTS "cr_select_secure" ON public.clearance_requests;
CREATE POLICY "cr_select_secure" ON public.clearance_requests FOR SELECT USING (
  student_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin') 
  OR (
    public.has_role(auth.uid(), 'department')
    AND public.is_request_routed_to_department(id, public.current_department(auth.uid()))
  )
);

DROP POLICY IF EXISTS "dr_select_secure" ON public.dept_reviews;
CREATE POLICY "dr_select_secure" ON public.dept_reviews FOR SELECT USING (
  public.get_request_student_id(request_id) = auth.uid()
  OR public.has_role(auth.uid(), 'admin') 
  OR (
    public.has_role(auth.uid(), 'department')
    AND public.is_request_routed_to_department(request_id, public.current_department(auth.uid()))
  )
);
