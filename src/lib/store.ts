import { useSyncExternalStore, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ActivityItem,
  ClearanceRequest,
  DEPARTMENTS,
  Department,
  DeptStatus,
  FeeBalance,
  HostelAssignment,
  IctAsset,
  LibraryLoan,
  REQUEST_TYPE_DEPARTMENTS,
  RequestType,
  Role,
  User,
} from "./types";

interface State {
  users: User[];
  requests: ClearanceRequest[];
  activity: ActivityItem[];
  loans: LibraryLoan[];
  fees: FeeBalance[];
  assets: IctAsset[];
  hostel: HostelAssignment[];
  sports: import("./types").SportsLoan[];
  hydrated: boolean;
}

let state: State = {
  users: [], requests: [], activity: [],
  loans: [], fees: [], assets: [], hostel: [], sports: [],
  hydrated: false,
};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
function setState(updater: (s: State) => State) {
  state = updater(state);
  notify();
}

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
    const requestType = ((r.request_type as RequestType) ?? "graduation") as RequestType;
    const expected = REQUEST_TYPE_DEPARTMENTS[requestType] ?? DEPARTMENTS;
    const departments = expected.map<DeptStatus>(
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
      requestType,
      departments,
      overallStatus: r.overall_status as ClearanceRequest["overallStatus"],
    };
  });
}

function profileRowToUser(p: Record<string, unknown>, role: Role): User {
  const matricNo = (p.matric_no as string) ?? undefined;
  return {
    id: p.id as string,
    name: p.name as string,
    email: p.email as string,
    role,
    department: (p.department as Department) ?? undefined,
    matricNo,
    program: (p.program as string) ?? undefined,
    faculty: (p.faculty as string) ?? undefined,
    level: (p.level as string) ?? undefined,
    admissionNumber: matricNo,
    password: "",
  };
}

async function loadAll() {
  // Run reads in parallel but defend against individual failures so UI doesn't break on a single 500
  const queries = {
    profiles: supabase.from("profiles").select("*"),
    roles: supabase.from("user_roles").select("user_id, role"),
    reqs: supabase.from("clearance_requests").select("*").order("submitted_at", { ascending: false }),
    revs: supabase.from("dept_reviews").select("*"),
    acts: supabase.from("activity_logs").select("*").order("at", { ascending: false }).limit(100),
    loans: supabase.from("library_loans").select("*"),
    fees: supabase.from("fee_balances").select("*"),
    assets: supabase.from("ict_assets").select("*"),
    hostel: supabase.from("hostel_assignments").select("*"),
    sports: supabase.from("sports_loans").select("*"),
  };

  const results = await Promise.all(Object.values(queries).map((q: any) => q.catch ? q.catch((e: any) => ({ error: e })) : q));
  const [profilesRes, rolesRes, reqsRes, revsRes, actsRes, loansRes, feesRes, assetsRes, hostelRes, sportsRes] = results as any[];

  // Normalize errors: if a request failed, replace with empty data and log
  const norm = (r: any, name: string) => {
    if (!r) return { data: [], error: null };
    if (r.error) {
      console.error(`Supabase read error for ${name}:`, r.error);
      return { data: [], error: r.error };
    }
    return r;
  };
  const _profilesRes = norm(profilesRes, 'profiles');
  const _rolesRes = norm(rolesRes, 'user_roles');
  const _reqsRes = norm(reqsRes, 'clearance_requests');
  const _revsRes = norm(revsRes, 'dept_reviews');
  const _actsRes = norm(actsRes, 'activity_logs');
  const _loansRes = norm(loansRes, 'library_loans');
  const _feesRes = norm(feesRes, 'fee_balances');
  const _assetsRes = norm(assetsRes, 'ict_assets');
  const _hostelRes = norm(hostelRes, 'hostel_assignments');
  const _sportsRes = norm(sportsRes, 'sports_loans');

  const roleMap = new Map<string, Role>();
  for (const r of _rolesRes.data ?? []) {
    const existing = roleMap.get(r.user_id as string);
    const order: Role[] = ["student", "department", "admin"];
    if (!existing || order.indexOf(r.role as Role) > order.indexOf(existing)) {
      roleMap.set(r.user_id as string, r.role as Role);
    }
  }

  const users: User[] = (_profilesRes.data ?? []).map((p) =>
    profileRowToUser(p as Record<string, unknown>, roleMap.get((p as { id: string }).id) ?? "student"),
  );

  const requests = rowsToRequests(
    (_reqsRes.data ?? []) as Array<Record<string, unknown>>,
    (_revsRes.data ?? []) as Array<Record<string, unknown>>,
  );

  const activity: ActivityItem[] = (_actsRes.data ?? []).map((a) => ({
    id: a.id as string, at: a.at as string,
    actor: a.actor as string, action: a.action as string,
    target: (a.target as string) ?? undefined,
  }));

  const loans: LibraryLoan[] = (_loansRes.data ?? []).map((l) => ({
    id: l.id as string,
    studentId: l.student_id as string,
    bookTitle: l.book_title as string,
    dueDate: l.due_date as string,
    returned: l.returned as boolean,
    fineAmount: Number(l.fine_amount ?? 0),
  }));
  const fees: FeeBalance[] = (_feesRes.data ?? []).map((f) => ({
    id: f.id as string,
    studentId: f.student_id as string,
    item: f.item as string,
    amountDue: Number(f.amount_due ?? 0),
  }));
  const assets: IctAsset[] = (_assetsRes.data ?? []).map((a) => ({
    id: a.id as string,
    studentId: a.student_id as string,
    asset: a.asset as string,
    returned: a.returned as boolean,
    replacementCost: Number(a.replacement_cost ?? 0),
  }));
  const hostel: HostelAssignment[] = (_hostelRes.data ?? []).map((h) => ({
    id: h.id as string,
    studentId: h.student_id as string,
    room: h.room as string,
    checkedOut: h.checked_out as boolean,
    damageFee: Number(h.damage_fee ?? 0),
  }));

  const sports: import("./types").SportsLoan[] = (_sportsRes.data ?? []).map((s) => ({
    id: s.id as string,
    studentId: s.student_id as string,
    equipment: s.equipment as string,
    returned: s.returned as boolean,
    replacementCost: Number(s.replacement_cost ?? 0),
  }));

  setState(() => ({ users, requests, activity, loans, fees, assets, hostel, sports, hydrated: true }));
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
    .on("postgres_changes", { event: "*", schema: "public", table: "library_loans" }, () => loadAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "fee_balances" }, () => loadAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "ict_assets" }, () => loadAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "hostel_assignments" }, () => loadAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "sports_loans" }, () => loadAll())
    .subscribe();
}

async function logActivity(actor: string, action: string, target?: string) {
  await supabase.from("activity_logs").insert({ actor, action, target: target ?? null });
}

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
        request_type: input.requestType,
      })
      .select("*")
      .single();
    if (error) throw error;
    await logActivity(input.studentName, `submitted ${input.requestType} clearance request`, data.clearance_id);
    await loadAll();
    return data;
  },

  reviewDepartment: async (
    requestId: string, department: Department,
    status: "approved" | "rejected", remarks: string, reviewer: string,
  ) => {
    const { error } = await supabase
      .from("dept_reviews")
      .update({ status, remarks, reviewed_by: reviewer, reviewed_at: new Date().toISOString() })
      .eq("request_id", requestId).eq("department", department);
    if (error) throw error;
    await logActivity(reviewer, `${status} ${department} clearance`, requestId);
    await loadAll();
  },

  upsertUser: async (u: User) => {
    const { secureUpsertUser } = await import("./admin.functions");
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("You must be signed in as an admin to manage users");

    const payload = {
      ...u,
      matricNo: u.role === "student" ? u.admissionNumber || u.matricNo : u.matricNo,
    };

    await secureUpsertUser({ data: { accessToken, data: payload } });
    await loadAll();
  },

  deleteUser: async (id: string) => {
    const { secureDeleteUser } = await import("./admin.functions");
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("You must be signed in as an admin to manage users");
    await secureDeleteUser({ data: { accessToken, data: id } });
    await loadAll();
  },

  upsertFeeBalance: async (item: { id?: string; studentId: string; item: string; amountDue: number }) => {
    const { error } = await supabase.from("fee_balances").upsert({
      id: item.id || undefined,
      student_id: item.studentId,
      item: item.item,
      amount_due: item.amountDue,
    });
    if (error) throw error;
    await loadAll();
  },

  deleteFeeBalance: async (id: string) => {
    const { error } = await supabase.from("fee_balances").delete().eq("id", id);
    if (error) throw error;
    await loadAll();
  },

  upsertLibraryLoan: async (item: { id?: string; studentId: string; bookTitle: string; dueDate: string; returned: boolean; fineAmount: number }) => {
    const { error } = await supabase.from("library_loans").upsert({
      id: item.id || undefined,
      student_id: item.studentId,
      book_title: item.bookTitle,
      due_date: item.dueDate,
      returned: item.returned,
      fine_amount: item.fineAmount,
    });
    if (error) throw error;
    await loadAll();
  },

  deleteLibraryLoan: async (id: string) => {
    const { error } = await supabase.from("library_loans").delete().eq("id", id);
    if (error) throw error;
    await loadAll();
  },

  upsertIctAsset: async (item: { id?: string; studentId: string; asset: string; returned: boolean; replacementCost: number }) => {
    const { error } = await supabase.from("ict_assets").upsert({
      id: item.id || undefined,
      student_id: item.studentId,
      asset: item.asset,
      returned: item.returned,
      replacement_cost: item.replacementCost,
    });
    if (error) throw error;
    await loadAll();
  },

  deleteIctAsset: async (id: string) => {
    const { error } = await supabase.from("ict_assets").delete().eq("id", id);
    if (error) throw error;
    await loadAll();
  },

  upsertHostelAssignment: async (item: { id?: string; studentId: string; room: string; checkedOut: boolean; damageFee: number }) => {
    const { error } = await supabase.from("hostel_assignments").upsert({
      id: item.id || undefined,
      student_id: item.studentId,
      room: item.room,
      checked_out: item.checkedOut,
      damage_fee: item.damageFee,
    });
    if (error) throw error;
    await loadAll();
  },

  deleteHostelAssignment: async (id: string) => {
    const { error } = await supabase.from("hostel_assignments").delete().eq("id", id);
    if (error) throw error;
    await loadAll();
  },

  upsertSportsLoan: async (item: { id?: string; studentId: string; equipment: string; returned: boolean; replacementCost: number }) => {
    const { error } = await supabase.from("sports_loans").upsert({
      id: item.id || undefined,
      student_id: item.studentId,
      equipment: item.equipment,
      returned: item.returned,
      replacement_cost: item.replacementCost,
    });
    if (error) throw error;
    await loadAll();
  },

  deleteSportsLoan: async (id: string) => {
    const { error } = await supabase.from("sports_loans").delete().eq("id", id);
    if (error) throw error;
    await loadAll();
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const getSnapshot = useMemo(() => {
    return () => selectorRef.current(state);
  }, []);

  const getServerSnapshot = useMemo(() => {
    const emptyState: State = { users: [], requests: [], activity: [], loans: [], fees: [], assets: [], hostel: [], sports: [], hydrated: false };
    return () => selectorRef.current(emptyState);
  }, []);

  return useSyncExternalStore(
    store.subscribe,
    getSnapshot,
    getServerSnapshot,
  );
}

interface AuthState {
  user: User | null;
  passwordChangeRequired: boolean;
}
let auth: AuthState = { user: null, passwordChangeRequired: false };
let authHydrated = false;
const authListeners = new Set<() => void>();
const notifyAuth = () => authListeners.forEach((l) => l());

async function hydrateAuthUser(userId: string | null) {
  if (!userId) {
    auth = { user: null, passwordChangeRequired: false };
    notifyAuth();
    return;
  }
  const [{ data: p }, { data: roles }, { data: sessionData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.auth.getSession(),
  ]);
  if (!p) {
    auth = { user: null, passwordChangeRequired: false };
    notifyAuth();
    return;
  }
  const order: Role[] = ["student", "department", "admin"];
  let best: Role = "student";
  for (const r of roles ?? []) {
    const rr = r.role as Role;
    if (order.indexOf(rr) > order.indexOf(best)) best = rr;
  }

  const userMetadata = sessionData.session?.user?.user_metadata;
  const isStudent = best === "student";
  const passwordChanged = userMetadata?.password_changed === true;
  const passwordChangeRequired = isStudent && !passwordChanged;

  auth = {
    user: profileRowToUser(p as Record<string, unknown>, best),
    passwordChangeRequired,
  };
  notifyAuth();
}

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
// bootstrap();
if (typeof window !== "undefined") {
  supabase.auth.getSession().then(async ({ data }) => {
    await hydrateAuthUser(data.session?.user.id ?? null);
    authHydrated = true;
    notifyAuth();
    loadAll();
  });
}

export const authStore = {
  getUser: () => auth.user,
  isPasswordChangeRequired: () => auth.passwordChangeRequired,
  setPasswordChangeRequired: (val: boolean) => {
    auth.passwordChangeRequired = val;
    notifyAuth();
  },
  login: async (identifier: string, password: string): Promise<Role | null> => {
    let emailToUse = identifier;

    // Resolve matric number to email via server function to bypass RLS!
    try {
      const { resolveMatricToEmail } = await import("./verify.functions");
      const resolvedEmail = await resolveMatricToEmail({ data: identifier });
      if (resolvedEmail) {
        emailToUse = resolvedEmail;
      }
    } catch (e) {
      console.error("resolveMatricToEmail error", e);
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: emailToUse, password });
    if (error || !data.user) return null;
    await hydrateAuthUser(data.user.id);
    authHydrated = true;
    notifyAuth();
    await loadAll();
    await logActivity(auth.user?.name ?? emailToUse, "signed in");
    return auth.user?.role ?? null;
  },
  logout: async () => {
    const name = auth.user?.name;
    if (name) await logActivity(name, "signed out");
    await supabase.auth.signOut();
    auth = { user: null, passwordChangeRequired: false };
    authHydrated = true;
    notifyAuth();
  },
  subscribe: (cb: () => void) => {
    authListeners.add(cb);
    return () => authListeners.delete(cb);
  },
};

const subscribeAuth = (cb: () => void) => authStore.subscribe(cb);
const getAuthSnapshot = () => auth.user;
const getAuthServerSnapshot = () => null;

export function useAuthUser() {
  return useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getAuthServerSnapshot,
  );
}

const getHydratedSnapshot = () => authHydrated;
const getHydratedServerSnapshot = () => false;

export function useAuthHydrated() {
  return useSyncExternalStore(
    subscribeAuth,
    getHydratedSnapshot,
    getHydratedServerSnapshot,
  );
}

export function usePasswordChangeRequired() {
  return useSyncExternalStore(
    subscribeAuth,
    () => auth.passwordChangeRequired,
    () => false,
  );
}
