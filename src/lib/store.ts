import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ActivityItem,
  ClearanceRequest,
  DEPARTMENTS,
  Department,
  DeptStatus,
  Role,
  User,
} from "./types";

interface State {
  users: User[];
  requests: ClearanceRequest[];
  activity: ActivityItem[];
  hydrated: boolean;
}

let state: State = { users: [], requests: [], activity: [], hydrated: false };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
function setState(updater: (s: State) => State) {
  state = updater(state);
  notify();
}

// ---------- helpers ----------
function rowsToRequests(
  reqs: Array<Record<string, unknown>>,
  reviews: Array<Record<string, unknown>>,
): ClearanceRequest[] {
  const byReq = new Map<string, DeptStatus[]>();
  for (const r of reviews) {
    const list = byReq.get(r.request_id as string) ?? [];
    list.push({
      department: r.department as Department,
      status: r.status as DeptStatus["status"],
      remarks: (r.remarks as string) ?? undefined,
      reviewedBy: (r.reviewed_by as string) ?? undefined,
      reviewedAt: (r.reviewed_at as string) ?? undefined,
    });
    byReq.set(r.request_id as string, list);
  }
  return reqs.map((r) => {
    const departments = DEPARTMENTS.map<DeptStatus>(
      (d) =>
        (byReq.get(r.id as string) ?? []).find((x) => x.department === d) ?? {
          department: d,
          status: "pending",
        },
    );
    return {
      id: r.id as string,
      clearanceId: r.clearance_id as string,
      studentId: r.student_id as string,
      studentName: r.student_name as string,
      matricNo: r.matric_no as string,
      program: r.program as string,
      faculty: r.faculty as string,
      level: r.level as string,
      email: r.email as string,
      submittedAt: r.submitted_at as string,
      reason: r.reason as string,
      departments,
      overallStatus: r.overall_status as ClearanceRequest["overallStatus"],
    };
  });
}

function profileRowToUser(
  p: Record<string, unknown>,
  role: Role,
): User {
  return {
    id: p.id as string,
    name: p.name as string,
    email: p.email as string,
    role,
    department: (p.department as Department) ?? undefined,
    matricNo: (p.matric_no as string) ?? undefined,
    program: (p.program as string) ?? undefined,
    faculty: (p.faculty as string) ?? undefined,
    level: (p.level as string) ?? undefined,
    password: "",
  };
}

// ---------- data loading ----------
async function loadAll() {
  const [profilesRes, rolesRes, reqsRes, revsRes, actsRes] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("clearance_requests").select("*").order("submitted_at", { ascending: false }),
    supabase.from("dept_reviews").select("*"),
    supabase.from("activity_logs").select("*").order("at", { ascending: false }).limit(100),
  ]);

  const roleMap = new Map<string, Role>();
  for (const r of rolesRes.data ?? []) {
    // prefer most-privileged role if multiple
    const existing = roleMap.get(r.user_id as string);
    const order: Role[] = ["student", "department", "admin"];
    if (!existing || order.indexOf(r.role as Role) > order.indexOf(existing)) {
      roleMap.set(r.user_id as string, r.role as Role);
    }
  }

  const users: User[] = (profilesRes.data ?? []).map((p) =>
    profileRowToUser(p as Record<string, unknown>, roleMap.get((p as { id: string }).id) ?? "student"),
  );

  const requests = rowsToRequests(
    (reqsRes.data ?? []) as Array<Record<string, unknown>>,
    (revsRes.data ?? []) as Array<Record<string, unknown>>,
  );

  const activity: ActivityItem[] = (actsRes.data ?? []).map((a) => ({
    id: a.id as string,
    at: a.at as string,
    actor: a.actor as string,
    action: a.action as string,
    target: (a.target as string) ?? undefined,
  }));

  setState(() => ({ users, requests, activity, hydrated: true }));
}

let realtimeAttached = false;
function attachRealtime() {
  if (realtimeAttached) return;
  realtimeAttached = true;
  supabase
    .channel("eclearance-all")
    .on("postgres_changes", { event: "*", schema: "public", table: "clearance_requests" }, () => loadAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "dept_reviews" }, () => loadAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => loadAll())
    .subscribe();
}

async function logActivity(actor: string, action: string, target?: string) {
  await supabase.from("activity_logs").insert({ actor, action, target: target ?? null });
}

// ---------- public store ----------
export const store = {
  getState: () => state,
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  refresh: () => loadAll(),
  reset: () => loadAll(),

  createRequest: async (
    input: Omit<ClearanceRequest, "id" | "clearanceId" | "submittedAt" | "departments" | "overallStatus">,
  ) => {
    const year = new Date().getFullYear();
    const clearance_id = `ECL-${year}-${Math.floor(1000 + Math.random() * 8999)}`;
    const { data, error } = await supabase
      .from("clearance_requests")
      .insert({
        clearance_id,
        student_id: input.studentId,
        student_name: input.studentName,
        matric_no: input.matricNo,
        program: input.program,
        faculty: input.faculty,
        level: input.level,
        email: input.email,
        reason: input.reason,
      })
      .select("*")
      .single();
    if (error) throw error;
    await logActivity(input.studentName, "submitted clearance request", data.clearance_id);
    await loadAll();
    return data;
  },

  reviewDepartment: async (
    requestId: string,
    department: Department,
    status: "approved" | "rejected",
    remarks: string,
    reviewer: string,
  ) => {
    const { error } = await supabase
      .from("dept_reviews")
      .update({
        status,
        remarks,
        reviewed_by: reviewer,
        reviewed_at: new Date().toISOString(),
      })
      .eq("request_id", requestId)
      .eq("department", department);
    if (error) throw error;
    await logActivity(reviewer, `${status} ${department} clearance`, requestId);
    await loadAll();
  },

  upsertUser: async (u: User) => {
    // Updates a profile + role. Does NOT create auth accounts here (admin-only flow).
    const { error } = await supabase.from("profiles").upsert({
      id: u.id,
      name: u.name,
      email: u.email,
      department: u.department ?? null,
      matric_no: u.matricNo ?? null,
      program: u.program ?? null,
      faculty: u.faculty ?? null,
      level: u.level ?? null,
    });
    if (error) throw error;
    // Replace role
    await supabase.from("user_roles").delete().eq("user_id", u.id);
    await supabase.from("user_roles").insert({ user_id: u.id, role: u.role });
    await logActivity("Admin", "saved user", u.email);
    await loadAll();
  },

  deleteUser: async (id: string) => {
    await supabase.from("user_roles").delete().eq("user_id", id);
    await supabase.from("profiles").delete().eq("id", id);
    await logActivity("Admin", "deleted user", id);
    await loadAll();
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(state),
    () => selector({ users: [], requests: [], activity: [], hydrated: false }),
  );
}

// ---------- auth ----------
interface AuthState {
  user: User | null;
}
let auth: AuthState = { user: null };
const authListeners = new Set<() => void>();
const notifyAuth = () => authListeners.forEach((l) => l());

async function hydrateAuthUser(userId: string | null) {
  if (!userId) {
    auth = { user: null };
    notifyAuth();
    return;
  }
  const [{ data: p }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!p) {
    auth = { user: null };
    notifyAuth();
    return;
  }
  const order: Role[] = ["student", "department", "admin"];
  let best: Role = "student";
  for (const r of roles ?? []) {
    const rr = r.role as Role;
    if (order.indexOf(rr) > order.indexOf(best)) best = rr;
  }
  auth = { user: profileRowToUser(p as Record<string, unknown>, best) };
  notifyAuth();
}

// Bootstrap once in browser
let bootstrapped = false;
function bootstrap() {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;
  supabase.auth.getSession().then(({ data }) => {
    hydrateAuthUser(data.session?.user.id ?? null);
    loadAll();
    attachRealtime();
  });
  supabase.auth.onAuthStateChange((_e, session) => {
    hydrateAuthUser(session?.user.id ?? null);
    loadAll();
  });
}
bootstrap();

export const authStore = {
  getUser: () => auth.user,
  login: async (email: string, password: string): Promise<Role | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;
    await hydrateAuthUser(data.user.id);
    await loadAll();
    await logActivity(auth.user?.name ?? email, "signed in");
    return auth.user?.role ?? null;
  },
  logout: async () => {
    const name = auth.user?.name;
    if (name) await logActivity(name, "signed out");
    await supabase.auth.signOut();
    auth = { user: null };
    notifyAuth();
  },
  subscribe: (cb: () => void) => {
    authListeners.add(cb);
    return () => authListeners.delete(cb);
  },
};

export function useAuthUser() {
  return useSyncExternalStore(
    (cb) => authStore.subscribe(cb),
    () => auth.user,
    () => null,
  );
}
