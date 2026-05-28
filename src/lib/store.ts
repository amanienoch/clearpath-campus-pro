import { useSyncExternalStore } from "react";
import { ActivityItem, ClearanceRequest, DEPARTMENTS, Department, DeptStatus, Role, User } from "./types";

const KEY = "eclearance.state.v1";
const AUTH_KEY = "eclearance.auth.v1";

interface State {
  users: User[];
  requests: ClearanceRequest[];
  activity: ActivityItem[];
}

const seedUsers: User[] = [
  {
    id: "u-stu-1",
    name: "Glorian Bana",
    email: "glorian.bana@university.edu",
    role: "student",
    matricNo: "U/2021/CS/0421",
    program: "B.Sc. Computer Science",
    faculty: "Faculty of Science",
    level: "400",
    password: "student123",
  },
  { id: "u-fin", name: "Adaeze Okafor", email: "finance@university.edu", role: "department", department: "Finance", password: "dept123" },
  { id: "u-lib", name: "Samuel Eze", email: "library@university.edu", role: "department", department: "Library", password: "dept123" },
  { id: "u-ict", name: "Khadija Bello", email: "ict@university.edu", role: "department", department: "ICT", password: "dept123" },
  { id: "u-reg", name: "Tunde Adeyemi", email: "registrar@university.edu", role: "department", department: "Registrar", password: "dept123" },
  { id: "u-hos", name: "Mary Johnson", email: "hostel@university.edu", role: "department", department: "Hostel", password: "dept123" },
  { id: "u-spo", name: "Coach Idris", email: "sports@university.edu", role: "department", department: "Sports", password: "dept123" },
  { id: "u-adm", name: "Dr. Amaka Nwosu", email: "admin@university.edu", role: "admin", password: "admin123" },
];

function makeRequest(
  partial: Pick<ClearanceRequest, "studentId" | "studentName" | "matricNo" | "program" | "faculty" | "level" | "email" | "reason"> & { daysAgo: number; statuses?: Partial<Record<Department, DeptStatus>> },
): ClearanceRequest {
  const submittedAt = new Date(Date.now() - partial.daysAgo * 86400000).toISOString();
  const depts: DeptStatus[] = DEPARTMENTS.map((d) => partial.statuses?.[d] ?? { department: d, status: "pending" });
  const overall: ClearanceRequest["overallStatus"] = depts.every((d) => d.status === "approved")
    ? "approved"
    : depts.some((d) => d.status === "rejected")
    ? "rejected"
    : "pending";
  const num = Math.floor(Math.random() * 9000 + 1000);
  return {
    id: crypto.randomUUID(),
    clearanceId: `ECL-${new Date(submittedAt).getFullYear()}-${num}`,
    submittedAt,
    departments: depts,
    overallStatus: overall,
    ...partial,
  };
}

function seedRequests(): ClearanceRequest[] {
  const now = new Date().toISOString();
  return [
    makeRequest({
      studentId: "u-stu-1",
      studentName: "Glorian Bana",
      matricNo: "U/2021/CS/0421",
      program: "B.Sc. Computer Science",
      faculty: "Faculty of Science",
      level: "400",
      email: "glorian.bana@university.edu",
      reason: "Final year graduation clearance",
      daysAgo: 4,
      statuses: {
        Finance: { department: "Finance", status: "approved", remarks: "All fees paid in full.", reviewedBy: "Adaeze Okafor", reviewedAt: now },
        Library: { department: "Library", status: "approved", remarks: "No outstanding books.", reviewedBy: "Samuel Eze", reviewedAt: now },
        ICT: { department: "ICT", status: "approved", remarks: "Lab equipment returned.", reviewedBy: "Khadija Bello", reviewedAt: now },
        Registrar: { department: "Registrar", status: "pending" },
        Hostel: { department: "Hostel", status: "pending" },
        Sports: { department: "Sports", status: "pending" },
      },
    }),
    makeRequest({
      studentId: "u-stu-2",
      studentName: "Chinedu Obi",
      matricNo: "U/2021/EE/0118",
      program: "B.Eng Electrical Engineering",
      faculty: "Faculty of Engineering",
      level: "400",
      email: "chinedu.obi@university.edu",
      reason: "Final year clearance",
      daysAgo: 7,
      statuses: {
        Finance: { department: "Finance", status: "approved", reviewedBy: "Adaeze Okafor", reviewedAt: now },
        Library: { department: "Library", status: "rejected", remarks: "Outstanding book: Signals & Systems.", reviewedBy: "Samuel Eze", reviewedAt: now },
      },
    }),
    makeRequest({
      studentId: "u-stu-3",
      studentName: "Fatima Yusuf",
      matricNo: "U/2020/LAW/0902",
      program: "LL.B Law",
      faculty: "Faculty of Law",
      level: "500",
      email: "fatima.yusuf@university.edu",
      reason: "Transfer clearance",
      daysAgo: 2,
    }),
    makeRequest({
      studentId: "u-stu-4",
      studentName: "Emeka Okonkwo",
      matricNo: "U/2022/MED/0233",
      program: "MBBS Medicine",
      faculty: "Faculty of Medicine",
      level: "300",
      email: "emeka.o@university.edu",
      reason: "Inter-faculty transfer",
      daysAgo: 1,
    }),
  ];
}

const initial: State = { users: seedUsers, requests: seedRequests(), activity: [] };

function load(): State {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return initial;
  }
}

let state: State = typeof window !== "undefined" ? load() : initial;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

function setState(updater: (s: State) => State) {
  state = updater(state);
  persist();
}

function logActivity(actor: string, action: string, target?: string) {
  setState((s) => ({
    ...s,
    activity: [
      { id: crypto.randomUUID(), at: new Date().toISOString(), actor, action, target },
      ...s.activity,
    ].slice(0, 100),
  }));
}

export const store = {
  getState: () => state,
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  reset: () => {
    state = { users: seedUsers, requests: seedRequests(), activity: [] };
    persist();
  },
  createRequest: (input: Omit<ClearanceRequest, "id" | "clearanceId" | "submittedAt" | "departments" | "overallStatus">) => {
    const req = makeRequest({ ...input, daysAgo: 0 });
    setState((s) => ({ ...s, requests: [req, ...s.requests] }));
    logActivity(input.studentName, "submitted clearance request", req.clearanceId);
    return req;
  },
  reviewDepartment: (
    requestId: string,
    department: Department,
    status: "approved" | "rejected",
    remarks: string,
    reviewer: string,
  ) => {
    setState((s) => ({
      ...s,
      requests: s.requests.map((r) => {
        if (r.id !== requestId) return r;
        const departments = r.departments.map((d) =>
          d.department === department
            ? { ...d, status, remarks, reviewedBy: reviewer, reviewedAt: new Date().toISOString() }
            : d,
        );
        const overallStatus: ClearanceRequest["overallStatus"] = departments.every((d) => d.status === "approved")
          ? "approved"
          : departments.some((d) => d.status === "rejected")
          ? "rejected"
          : "pending";
        return { ...r, departments, overallStatus };
      }),
    }));
    logActivity(reviewer, `${status} ${department} clearance`, requestId);
  },
  upsertUser: (u: User) => {
    setState((s) => {
      const exists = s.users.some((x) => x.id === u.id);
      return { ...s, users: exists ? s.users.map((x) => (x.id === u.id ? u : x)) : [...s.users, u] };
    });
    logActivity("Admin", "saved user", u.email);
  },
  deleteUser: (id: string) => {
    setState((s) => ({ ...s, users: s.users.filter((u) => u.id !== id) }));
    logActivity("Admin", "deleted user", id);
  },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(initial),
  );
}

// ---- Auth ----
interface AuthState { userId: string | null; }
let auth: AuthState = { userId: null };
const authListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) auth = JSON.parse(raw);
  } catch {}
}
function persistAuth() {
  if (typeof window !== "undefined") localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  authListeners.forEach((l) => l());
}
export const authStore = {
  getUser: () => state.users.find((u) => u.id === auth.userId) ?? null,
  login: (email: string, password: string): Role | null => {
    const user = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) return null;
    auth = { userId: user.id };
    persistAuth();
    logActivity(user.name, "signed in");
    return user.role;
  },
  logout: () => {
    const u = state.users.find((x) => x.id === auth.userId);
    if (u) logActivity(u.name, "signed out");
    auth = { userId: null };
    persistAuth();
  },
  subscribe: (cb: () => void) => {
    authListeners.add(cb);
    return () => authListeners.delete(cb);
  },
};

export function useAuthUser() {
  return useSyncExternalStore(
    (cb) => {
      const u1 = authStore.subscribe(cb);
      const u2 = store.subscribe(cb);
      return () => { u1(); u2(); };
    },
    () => authStore.getUser(),
    () => null,
  );
}
