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

function parseActivityRow(
  a: Record<string, unknown>,
  requests: ClearanceRequest[],
  users: User[]
): ActivityItem {
  const id = a.id as string;
  const timestamp = a.at as string;
  const actor = a.actor as string;
  const action = a.action as string;
  const target = (a.target as string) ?? undefined;

  let actorRole = "system";
  let department: string | undefined = undefined;
  let status: "approved" | "rejected" | "pending" | "info" = "info";
  let clearanceId: string | undefined = undefined;

  const lowerAction = action.toLowerCase();
  const lowerActor = actor.toLowerCase();

  // 1. Resolve clearanceId and match against requests
  let matchedReq: ClearanceRequest | undefined;
  if (target) {
    if (/^ECL-\d{4}-\d{4}$/.test(target)) {
      clearanceId = target;
      matchedReq = requests.find(r => r.clearanceId === target);
    } else {
      matchedReq = requests.find(r => r.id === target || r.clearanceId === target);
      if (matchedReq) {
        clearanceId = matchedReq.clearanceId;
      }
    }
  }

  if (!clearanceId && lowerAction.includes("ecl-")) {
    const match = action.match(/ECL-\d{4}-\d{4}/i);
    if (match) {
      clearanceId = match[0].toUpperCase();
      matchedReq = requests.find(r => r.clearanceId === clearanceId);
    }
  }

  // 2. Determine status
  if (lowerAction.includes("approved") || lowerAction.includes("cleared")) {
    status = "approved";
  } else if (lowerAction.includes("rejected") || lowerAction.includes("denied")) {
    status = "rejected";
  } else if (lowerAction.includes("submitted") || lowerAction.includes("initialized") || lowerAction.includes("pending")) {
    status = "pending";
  } else {
    status = "info";
  }

  // 3. Resolve actor role & department
  const matchedUser = users.find(
    u => u.name.toLowerCase() === lowerActor || u.email.toLowerCase() === lowerActor
  );
  if (matchedUser) {
    actorRole = matchedUser.role;
    department = matchedUser.department;
  } else {
    if (lowerActor === "admin" || lowerActor === "administrator" || lowerAction.includes("obligation") || lowerAction.includes("user")) {
      actorRole = "admin";
    } else if (lowerActor.includes("registrar") || lowerAction.includes("registrar")) {
      actorRole = "registrar";
      department = "Registrar";
    } else if (
      ["finance", "library", "ict", "hostel", "sports"].some(deptKey => 
        lowerActor.includes(deptKey.toLowerCase()) || lowerAction.includes(deptKey.toLowerCase())
      )
    ) {
      actorRole = "department";
      const depts: string[] = ["Finance", "Library", "ICT", "Hostel", "Sports"];
      department = depts.find(deptKey => 
        lowerActor.includes(deptKey.toLowerCase()) || lowerAction.includes(deptKey.toLowerCase())
      );
    } else if (matchedReq && matchedReq.studentName.toLowerCase() === lowerActor) {
      actorRole = "student";
    }
  }

  return {
    id,
    timestamp,
    actor,
    actorRole,
    department,
    action,
    target,
    clearanceId,
    status,
  };
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
  const curUser = auth.user;
  const isRegistrarOrAdmin = curUser && (
    curUser.role === "admin" ||
    (curUser.role === "department" && curUser.department === "Registrar")
  );

  // We run core queries in parallel
  const coreQueries = {
    profiles: supabase.from("profiles").select("*"),
    roles: supabase.from("user_roles").select("user_id, role"),
    reqs: supabase.from("clearance_requests").select("*").order("submitted_at", { ascending: false }),
    revs: supabase.from("dept_reviews").select("*"),
    acts: supabase.from("activity_logs").select("*").order("at", { ascending: false }).limit(100),
  };

  const corePromises = Promise.all(
    Object.values(coreQueries).map((q: any) => q.catch ? q.catch((e: any) => ({ error: e })) : q)
  );

  let obPromise: Promise<{ fees: any[]; loans: any[]; assets: any[]; hostel: any[]; sports: any[] }> | null = null;
  let obQueriesPromise: Promise<any[]> | null = null;

  if (isRegistrarOrAdmin) {
    obPromise = import("./verify.functions").then(({ getRegistrarObligations }) => getRegistrarObligations());
  } else {
    const obQueries = {
      loans: supabase.from("library_loans").select("*"),
      fees: supabase.from("fee_balances").select("*"),
      assets: supabase.from("ict_assets").select("*"),
      hostel: supabase.from("hostel_assignments").select("*"),
      sports: supabase.from("sports_loans").select("*"),
    };
    obQueriesPromise = Promise.all(
      Object.values(obQueries).map((q: any) => q.catch ? q.catch((e: any) => ({ error: e })) : q)
    );
  }

  // Await everything in parallel
  const [coreResults, obResults, serverObRes] = await Promise.all([
    corePromises,
    obQueriesPromise,
    obPromise ? obPromise.catch((e) => {
      console.error("Failed to fetch registrar obligations", e);
      return { fees: [], loans: [], assets: [], hostel: [], sports: [] };
    }) : Promise.resolve(null)
  ]);

  const [profilesRes, rolesRes, reqsRes, revsRes, actsRes] = coreResults;
  let loansRes: any, feesRes: any, assetsRes: any, hostelRes: any, sportsRes: any;

  if (!isRegistrarOrAdmin && obResults) {
    [loansRes, feesRes, assetsRes, hostelRes, sportsRes] = obResults;
  }

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

  const activity: ActivityItem[] = (_actsRes.data ?? []).map((a) =>
    parseActivityRow(a as Record<string, unknown>, requests, users)
  );

  let loans: LibraryLoan[];
  let fees: FeeBalance[];
  let assets: IctAsset[];
  let hostel: HostelAssignment[];
  let sports: import("./types").SportsLoan[];

  if (isRegistrarOrAdmin && serverObRes) {
    loans = serverObRes.loans.map((l: any) => ({
      id: l.id as string,
      studentId: l.student_id as string,
      bookTitle: l.book_title as string,
      dueDate: l.due_date as string,
      returned: l.returned as boolean,
      fineAmount: Number(l.fine_amount ?? 0),
    }));
    fees = serverObRes.fees.map((f: any) => ({
      id: f.id as string,
      studentId: f.student_id as string,
      item: f.item as string,
      amountDue: Number(f.amount_due ?? 0),
    }));
    assets = serverObRes.assets.map((a: any) => ({
      id: a.id as string,
      studentId: a.student_id as string,
      asset: a.asset as string,
      returned: a.returned as boolean,
      replacementCost: Number(a.replacement_cost ?? 0),
    }));
    hostel = serverObRes.hostel.map((h: any) => ({
      id: h.id as string,
      studentId: h.student_id as string,
      room: h.room as string,
      checkedOut: h.checked_out as boolean,
      damageFee: Number(h.damage_fee ?? 0),
    }));
    sports = serverObRes.sports.map((s: any) => ({
      id: s.id as string,
      studentId: s.student_id as string,
      equipment: s.equipment as string,
      returned: s.returned as boolean,
      replacementCost: Number(s.replacement_cost ?? 0),
    }));
  } else {
    const _loansRes = norm(loansRes, 'library_loans');
    const _feesRes = norm(feesRes, 'fee_balances');
    const _assetsRes = norm(assetsRes, 'ict_assets');
    const _hostelRes = norm(hostelRes, 'hostel_assignments');
    const _sportsRes = norm(sportsRes, 'sports_loans');

    loans = (_loansRes.data ?? []).map((l: any) => ({
      id: l.id as string,
      studentId: l.student_id as string,
      bookTitle: l.book_title as string,
      dueDate: l.due_date as string,
      returned: l.returned as boolean,
      fineAmount: Number(l.fine_amount ?? 0),
    }));
    fees = (_feesRes.data ?? []).map((f: any) => ({
      id: f.id as string,
      studentId: f.student_id as string,
      item: f.item as string,
      amountDue: Number(f.amount_due ?? 0),
    }));
    assets = (_assetsRes.data ?? []).map((a: any) => ({
      id: a.id as string,
      studentId: a.student_id as string,
      asset: a.asset as string,
      returned: a.returned as boolean,
      replacementCost: Number(a.replacement_cost ?? 0),
    }));
    hostel = (_hostelRes.data ?? []).map((h: any) => ({
      id: h.id as string,
      studentId: h.student_id as string,
      room: h.room as string,
      checkedOut: h.checked_out as boolean,
      damageFee: Number(h.damage_fee ?? 0),
    }));
    sports = (_sportsRes.data ?? []).map((s: any) => ({
      id: s.id as string,
      studentId: s.student_id as string,
      equipment: s.equipment as string,
      returned: s.returned as boolean,
      replacementCost: Number(s.replacement_cost ?? 0),
    }));
  }

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

    // If registrar approves final clearance, log certificate generation if all others are approved
    if (department === "Registrar" && status === "approved") {
      const req = state.requests.find((r) => r.id === requestId);
      if (req) {
        const allOtherCleared = req.departments.every(
          (d) => d.department === "Registrar" || d.status === "approved",
        );
        if (allOtherCleared) {
          await logActivity("Office of the Registrar", "generated certificate", req.clearanceId);
        }
      }
    }
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

  logActivity: async (actor: string, action: string, target?: string) => {
    await logActivity(actor, action, target);
  },

  upsertFeeBalance: async (item: { id?: string; studentId: string; item: string; amountDue: number }) => {
    const { error } = await supabase.from("fee_balances").upsert({
      id: item.id || undefined,
      student_id: item.studentId,
      item: item.item,
      amount_due: item.amountDue,
    });
    if (error) throw error;
    
    const isUpdate = !!item.id;
    const student = state.users.find((u) => u.id === item.studentId);
    const studentName = student?.name ?? item.studentId;
    const actor = auth.user?.name ?? "Admin";
    await logActivity(actor, `${isUpdate ? "updated" : "added"} fee balance obligation for ${studentName}`, item.studentId);
    await loadAll();
  },

  deleteFeeBalance: async (id: string) => {
    const existing = state.fees.find((f) => f.id === id);
    const { error } = await supabase.from("fee_balances").delete().eq("id", id);
    if (error) throw error;

    const student = state.users.find((u) => u.id === existing?.studentId);
    const studentName = student?.name ?? existing?.studentId ?? "Student";
    const actor = auth.user?.name ?? "Admin";
    await logActivity(actor, `removed fee balance obligation for ${studentName}`, existing?.studentId);
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

    const isUpdate = !!item.id;
    const student = state.users.find((u) => u.id === item.studentId);
    const studentName = student?.name ?? item.studentId;
    const actor = auth.user?.name ?? "Admin";
    await logActivity(actor, `${isUpdate ? "updated" : "added"} library loan obligation for ${studentName}`, item.studentId);
    await loadAll();
  },

  deleteLibraryLoan: async (id: string) => {
    const existing = state.loans.find((l) => l.id === id);
    const { error } = await supabase.from("library_loans").delete().eq("id", id);
    if (error) throw error;

    const student = state.users.find((u) => u.id === existing?.studentId);
    const studentName = student?.name ?? existing?.studentId ?? "Student";
    const actor = auth.user?.name ?? "Admin";
    await logActivity(actor, `removed library loan obligation for ${studentName}`, existing?.studentId);
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

    const isUpdate = !!item.id;
    const student = state.users.find((u) => u.id === item.studentId);
    const studentName = student?.name ?? item.studentId;
    const actor = auth.user?.name ?? "Admin";
    await logActivity(actor, `${isUpdate ? "updated" : "added"} ICT asset obligation for ${studentName}`, item.studentId);
    await loadAll();
  },

  deleteIctAsset: async (id: string) => {
    const existing = state.assets.find((a) => a.id === id);
    const { error } = await supabase.from("ict_assets").delete().eq("id", id);
    if (error) throw error;

    const student = state.users.find((u) => u.id === existing?.studentId);
    const studentName = student?.name ?? existing?.studentId ?? "Student";
    const actor = auth.user?.name ?? "Admin";
    await logActivity(actor, `removed ICT asset obligation for ${studentName}`, existing?.studentId);
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

    const isUpdate = !!item.id;
    const student = state.users.find((u) => u.id === item.studentId);
    const studentName = student?.name ?? item.studentId;
    const actor = auth.user?.name ?? "Admin";
    await logActivity(actor, `${isUpdate ? "updated" : "added"} hostel assignment obligation for ${studentName}`, item.studentId);
    await loadAll();
  },

  deleteHostelAssignment: async (id: string) => {
    const existing = state.hostel.find((h) => h.id === id);
    const { error } = await supabase.from("hostel_assignments").delete().eq("id", id);
    if (error) throw error;

    const student = state.users.find((u) => u.id === existing?.studentId);
    const studentName = student?.name ?? existing?.studentId ?? "Student";
    const actor = auth.user?.name ?? "Admin";
    await logActivity(actor, `removed hostel assignment obligation for ${studentName}`, existing?.studentId);
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

    const isUpdate = !!item.id;
    const student = state.users.find((u) => u.id === item.studentId);
    const studentName = student?.name ?? item.studentId;
    const actor = auth.user?.name ?? "Admin";
    await logActivity(actor, `${isUpdate ? "updated" : "added"} sports loan obligation for ${studentName}`, item.studentId);
    await loadAll();
  },

  deleteSportsLoan: async (id: string) => {
    const existing = state.sports.find((s) => s.id === id);
    const { error } = await supabase.from("sports_loans").delete().eq("id", id);
    if (error) throw error;

    const student = state.users.find((u) => u.id === existing?.studentId);
    const studentName = student?.name ?? existing?.studentId ?? "Student";
    const actor = auth.user?.name ?? "Admin";
    await logActivity(actor, `removed sports loan obligation for ${studentName}`, existing?.studentId);
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
