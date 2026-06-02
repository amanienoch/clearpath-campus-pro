import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore, store } from "@/lib/store";
import { DEPARTMENTS, Role, User } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  LayoutDashboard, Users, BadgeCheck, FileCheck2, Clock, XCircle, TrendingUp,
  Pencil, Trash2, Plus, Activity, BookOpen, Wallet, Laptop, Home, Trophy, Calendar, Check, AlertTriangle, Search
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend
} from "recharts";
import { toast } from "sonner";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { NGN } from "@/lib/eligibility";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — E-Clearance" }] }),
  component: AdminPage,
});

function AdminPage() {
  const requests = useStore((s) => s.requests);
  const users = useStore((s) => s.users);
  const activity = useStore((s) => s.activity);
  const loans = useStore((s) => s.loans);
  const fees = useStore((s) => s.fees);
  const assets = useStore((s) => s.assets);
  const hostel = useStore((s) => s.hostel);
  const sports = useStore((s) => s.sports);

  // Synchronize Tab state with URL query parameter
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [window.location.search]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const newUrl = window.location.pathname + "?tab=" + val;
    window.history.replaceState(null, "", newUrl);
  };

  const stats = useMemo(() => ({
    total: requests.length,
    approved: requests.filter((r) => r.overallStatus === "approved").length,
    pending: requests.filter((r) => r.overallStatus === "pending").length,
    rejected: requests.filter((r) => r.overallStatus === "rejected").length,
  }), [requests]);

  // Executive KPI Calculations
  const totalStudents = useMemo(() => users.filter((u) => u.role === "student").length, [users]);
  const totalUsers = users.length;
  const clearedCount = stats.approved;
  const pendingCount = stats.pending;
  const rejectedCount = stats.rejected;
  const certsIssued = stats.approved;

  const totalObligations = useMemo(() => {
    return (
      loans.filter(l => !l.returned).length +
      fees.filter(f => Number(f.amountDue) > 0).length +
      assets.filter(a => !a.returned).length +
      hostel.filter(h => !h.checkedOut || Number(h.damageFee) > 0).length +
      sports.filter(s => !s.returned).length
    );
  }, [loans, fees, assets, hostel, sports]);

  const totalOutstandingFees = useMemo(() => {
    return fees.filter(f => Number(f.amountDue) > 0).reduce((sum, f) => sum + Number(f.amountDue), 0);
  }, [fees]);

  // Charts Computations
  const deptData = useMemo(() => {
    return DEPARTMENTS.map((d) => {
      const items = requests.flatMap((r) => r.departments.filter((x) => x.department === d));
      return {
        name: d,
        approved: items.filter((x) => x.status === "approved").length,
        pending: items.filter((x) => x.status === "pending").length,
        rejected: items.filter((x) => x.status === "rejected").length,
      };
    });
  }, [requests]);

  const deptRates = useMemo(() => {
    return DEPARTMENTS.map((d) => {
      const items = requests.flatMap((r) => r.departments.filter((x) => x.department === d));
      const approved = items.filter((x) => x.status === "approved").length;
      const total = items.length;
      const rate = total ? Math.round((approved / total) * 100) : 0;
      return { name: d, rate };
    });
  }, [requests]);

  const obligationsByDept = useMemo(() => {
    return [
      { name: "Finance", obligations: fees.filter(f => Number(f.amountDue) > 0).length },
      { name: "Library", obligations: loans.filter(l => !l.returned).length },
      { name: "ICT", obligations: assets.filter(a => !a.returned).length },
      { name: "Hostel", obligations: hostel.filter(h => !h.checkedOut || Number(h.damageFee) > 0).length },
      { name: "Sports", obligations: sports.filter(s => !s.returned).length },
    ];
  }, [fees, loans, assets, hostel, sports]);

  const trend = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      const month = d.toLocaleString("default", { month: "short" });
      const count = requests.filter((r) => {
        const rd = new Date(r.submittedAt);
        return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear();
      }).length;
      return { month, requests: count };
    });
  }, [requests]);

  const certTrend = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      const month = d.toLocaleString("default", { month: "short" });
      const count = requests.filter((r) => {
        if (r.overallStatus !== "approved") return false;
        const rd = new Date(r.submittedAt);
        return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear();
      }).length;
      return { month, certificates: count };
    });
  }, [requests]);

  const pieData = [
    { name: "Approved", value: stats.approved, color: "oklch(0.65 0.18 155)" },
    { name: "Pending", value: stats.pending, color: "oklch(0.78 0.16 75)" },
    { name: "Rejected", value: stats.rejected, color: "oklch(0.6 0.23 27)" },
  ];

  // Quick Action search filter on overview tab
  const [overviewSearch, setOverviewSearch] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get("search");
    if (searchParam && params.get("tab") === "overview") {
      setOverviewSearch(searchParam);
    }
  }, [window.location.search]);

  const filteredRequests = useMemo(() => {
    if (!overviewSearch.trim()) return requests;
    const q = overviewSearch.toLowerCase();
    return requests.filter(r => 
      r.clearanceId.toLowerCase().includes(q) ||
      r.studentName.toLowerCase().includes(q) ||
      r.matricNo.toLowerCase().includes(q)
    );
  }, [requests, overviewSearch]);

  return (
    <AppShell
      title="Administrator"
      role="admin"
      nav={[
        { to: "/admin", label: "Overview", icon: <LayoutDashboard className="size-4" /> },
        { to: "/verify", label: "Verify Certificate", icon: <BadgeCheck className="size-4" /> },
      ]}
    >
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="glass rounded-xl p-1 flex-wrap h-auto">
          <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg">Analytics</TabsTrigger>
          <TabsTrigger value="users" className="rounded-lg">Users</TabsTrigger>
          <TabsTrigger value="obligations" className="rounded-lg">Obligations</TabsTrigger>
          <TabsTrigger value="activity" className="rounded-lg">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BigStat icon={<FileCheck2 className="size-6 text-primary animate-pulse" />} label="Total Requests" value={stats.total} />
            <BigStat icon={<BadgeCheck className="size-6" />} label="Approved" value={stats.approved} tone="success" />
            <BigStat icon={<Clock className="size-6" />} label="Pending" value={stats.pending} tone="warning" />
            <BigStat icon={<XCircle className="size-6" />} label="Rejected" value={stats.rejected} tone="destructive" />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-strong rounded-2xl p-6 border border-border/40">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Department performance</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={deptData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Legend />
                  <Bar dataKey="approved" fill="oklch(0.65 0.18 155)" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pending" fill="oklch(0.78 0.16 75)" stackId="a" />
                  <Bar dataKey="rejected" fill="oklch(0.6 0.23 27)" stackId="a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass-strong rounded-2xl p-6 border border-border/40">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Overall status</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4}>
                    {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-strong rounded-2xl overflow-hidden border border-border/40">
            <div className="p-5 border-b border-border/40 flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-display font-semibold text-base sm:text-lg">Recent Requests</h3>
              {overviewSearch && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Filtering by search: &ldquo;{overviewSearch}&rdquo;</span>
                  <Button size="sm" variant="ghost" className="h-7 text-xs font-semibold" onClick={() => {
                    setOverviewSearch("");
                    const newUrl = window.location.pathname + "?tab=overview";
                    window.history.replaceState(null, "", newUrl);
                  }}>Clear filter</Button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Clearance ID</th>
                    <th className="px-4 py-3 font-semibold">Submitted</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground select-none">
                        <FileText className="size-10 mx-auto text-muted-foreground/40 mb-3" />
                        <div className="font-semibold text-sm">You're all caught up.</div>
                        <div className="text-xs mt-1">No pending clearance requests found.</div>
                      </td>
                    </tr>
                  ) : filteredRequests.slice(0, 8).map((r, i) => (
                    <tr key={r.id} className="border-t row-hover animate-fade-up font-medium" style={{ animationDelay: `${i * 40}ms` }}>
                      <td className="px-4 py-3">
                        <div className="font-bold">{r.studentName}</div>
                        <div className="text-xs text-muted-foreground font-medium">{r.matricNo}</div>
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">{r.clearanceId}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(r.submittedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.overallStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Executive KPI Statistics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BigStat icon={<Users className="size-6 text-primary" />} label="Total Students" value={totalStudents} />
            <BigStat icon={<ShieldCheck className="size-6 text-indigo-500" />} label="Total Users" value={totalUsers} />
            <BigStat icon={<CheckCircle2 className="size-6 text-success animate-pulse" />} label="Cleared Students" value={clearedCount} tone="success" />
            <BigStat icon={<Clock className="size-6 text-warning" />} label="Pending Requests" value={pendingCount} tone="warning" />
            <BigStat icon={<XCircle className="size-6 text-destructive" />} label="Rejected Requests" value={rejectedCount} tone="destructive" />
            <BigStat icon={<BadgeCheck className="size-6 text-amber-500 animate-pulse" />} label="Certificates Issued" value={certsIssued} />
            <BigStat icon={<AlertTriangle className="size-6 text-red-500" />} label="Outstanding Obligations" value={totalObligations} tone="warning" />
            <BigStat icon={<Wallet className="size-6 text-destructive animate-pulse" />} label="Outstanding Fees" value={NGN(totalOutstandingFees)} tone="destructive" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            {/* Chart 1: Requests by Month */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Requests by Month</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Line type="monotone" dataKey="requests" stroke="oklch(0.52 0.22 265)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Clearance Completion Rate */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Clearance Completion Rate</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
                    {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Legend verticalAlign="bottom" height={36} tick={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 3: Department Approval Performance */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Department Approval Rates (%)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deptRates}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Bar dataKey="rate" fill="oklch(0.65 0.18 155)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 4: Outstanding Obligations by Department */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Outstanding Obligations by Department</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={obligationsByDept}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Bar dataKey="obligations" fill="oklch(0.6 0.23 27)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 5: Certificate Issuance Trends */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm lg:col-span-2">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Certificate Issuance Trends (Last 6 Months)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={certTrend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                  <Line type="monotone" dataKey="certificates" stroke="oklch(0.65 0.18 155)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <UsersTab users={users} />
        </TabsContent>

        <TabsContent value="obligations">
          <ObligationsTab users={users} />
        </TabsContent>

        <TabsContent value="activity">
          <div className="glass-strong rounded-2xl p-6 border border-border/40">
            <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
              <Activity className="size-5 text-primary animate-pulse" /> Activity feed
            </h3>
            {activity.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground select-none">
                <Inbox className="size-10 mx-auto text-muted-foreground/45 mb-3" />
                <div className="font-semibold text-sm">You're all caught up.</div>
                <div className="text-xs mt-1">No system activity logged yet.</div>
              </div>
            ) : (
              <ol className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 p-3 rounded-xl border bg-card/50 hover:bg-card/75 transition-colors">
                    <div className="size-9 rounded-full gradient-bg grid place-items-center text-primary-foreground text-xs font-bold shrink-0 shadow-sm">
                      {a.actor.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium"><span className="font-bold text-foreground">{a.actor}</span> {a.action} {a.target && <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded ml-1 font-bold">ID: {a.target.slice(0,8)}</span>}</div>
                      <div className="text-xs text-muted-foreground mt-1 font-medium">{new Date(a.at).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function BigStat({ icon, label, value, trend, tone }: { icon: React.ReactNode; label: string; value: number | string; trend?: string; tone?: "success" | "warning" | "destructive" }) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <div className="glass-strong rounded-2xl p-5 hover-lift animate-fade-up">
      <div className="flex items-center justify-between">
        <div className={`size-11 rounded-xl bg-accent grid place-items-center ${toneCls} transition-transform group-hover:scale-110`}>{icon}</div>
        {trend && <span className="text-xs font-semibold text-success">{trend}</span>}
      </div>
      <div className="font-display font-bold text-xl sm:text-2xl mt-3 truncate">
        {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
      </div>
      <div className="text-xs text-muted-foreground mt-1 font-medium">{label}</div>
    </div>
  );
}

function UsersTab({ users }: { users: User[] }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [search, setSearch] = useState("");

  const startNew = () => {
    setEdit({ id: crypto.randomUUID(), name: "", email: "", role: "student", password: "" });
    setOpen(true);
  };
  const startEdit = (u: User) => {
    setEdit({ ...u, password: "" });
    setOpen(true);
  };
  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      try {
        await store.deleteUser(deleteTarget.id);
        toast.success(`User ${deleteTarget.name} deleted successfully`);
      } catch (error) {
        toast.error("Failed to delete user");
        console.error(error);
      } finally {
        setDeleteTarget(null);
      }
    }
  };

  // Pre-fill search filter from URL query redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "users") {
      const searchParam = params.get("search");
      if (searchParam) {
        setSearch(searchParam);
      }
      
      if (params.get("openNew") === "true") {
        setEdit({ id: crypto.randomUUID(), name: "", email: "", role: "student", password: "" });
        setOpen(true);
        // Clear param
        const newUrl = window.location.pathname + "?tab=users";
        window.history.replaceState(null, "", newUrl);
      }
    }
  }, [window.location.search]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) => 
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  }, [users, search]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="font-display font-semibold text-xl flex items-center gap-2"><Users className="size-5 text-primary animate-pulse" /> User management</h3>
          <p className="text-sm text-muted-foreground font-medium">Create, edit and remove users across all roles.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          {/* Real-time search filter */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-full rounded-xl"
            />
          </div>
          <Button onClick={startNew} className="gradient-bg text-primary-foreground shadow-elegant h-9 shrink-0"><Plus className="size-4 mr-1" /> New user</Button>
        </div>
      </div>
      <div className="glass-strong rounded-2xl overflow-hidden border border-border/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground select-none">
                    <Inbox className="size-10 mx-auto text-muted-foreground/45 mb-3" />
                    <div className="font-semibold text-sm">You're all caught up.</div>
                    <div className="text-xs mt-1">No matching user accounts found.</div>
                  </td>
                </tr>
              ) : filteredUsers.map((u) => (
                <tr key={u.id} className="border-t hover:bg-muted/30 font-medium">
                  <td className="px-4 py-3 font-bold whitespace-nowrap">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-medium">{u.email}</td>
                  <td className="px-4 py-3 capitalize font-semibold">{u.role}</td>
                  <td className="px-4 py-3 text-muted-foreground font-semibold">{u.department ?? "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(u)} aria-label={`Edit ${u.name}`}><Pencil className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(u)} aria-label={`Delete ${u.name}`}><Trash2 className="size-3.5 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <UserDialog open={open} onClose={() => setOpen(false)} user={edit} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user accounts for{" "}
              <strong className="text-foreground">{deleteTarget?.name}</strong> and remove their data from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold" onClick={handleDeleteConfirm}>
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user: User | null }) {
  const [draft, setDraft] = useState<User | null>(user);
  const allUsers = useStore((s) => s.users);
  
  useEffect(() => {
    if (open) setDraft(user);
  }, [open, user]);

  if (!draft) return null;

  const isEditing = allUsers.some((u) => u.id === draft.id);

  const save = async () => {
    const name = draft.name.trim();
    const email = draft.email.trim().toLowerCase();
    
    if (!name || !email) {
      return toast.error("Name and Email are required");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return toast.error("Please enter a valid email address");
    }
    
    if (!isEditing && !draft.password) {
      return toast.error("Password is required for new users");
    }
    if (draft.password && draft.password.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }
    
    if (draft.role === "department" && !draft.department) {
      return toast.error("Please select a department");
    }
    
    const dup = allUsers.find((u) => u.email.toLowerCase() === email && u.id !== draft.id);
    if (dup) {
      return toast.error("Another user already uses this email");
    }

    try {
      await store.upsertUser({ ...draft, name, email });
      toast.success("User saved successfully");
      onClose();
    } catch (error) {
      toast.error("Failed to save user");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display font-semibold text-lg">{isEditing ? "Edit User" : "New User"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Password {isEditing && "(leave blank to keep current)"}</Label>
            <Input 
              type="password" 
              value={draft.password} 
              placeholder={isEditing ? "••••••••" : "Enter password"}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })} 
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v as Role })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.role === "department" && (
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={draft.department} onValueChange={(v) => setDraft({ ...draft, department: v as User["department"] })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="gradient-bg text-primary-foreground shadow-elegant" onClick={save}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StudentSelect({ value, onChange, students }: { value: string; onChange: (v: string) => void; students: User[] }) {
  return (
    <div className="space-y-1.5">
      <Label>Student</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select student" />
        </SelectTrigger>
        <SelectContent>
          {students.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name} ({s.matricNo || "N/A"})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ObligationsTab({ users }: { users: User[] }) {
  const allStudents = useMemo(() => users.filter((u) => u.role === "student"), [users]);

  const loans = useStore((s) => s.loans);
  const fees = useStore((s) => s.fees);
  const assets = useStore((s) => s.assets);
  const hostel = useStore((s) => s.hostel);
  const sports = useStore((s) => s.sports);

  // States
  const [feeOpen, setFeeOpen] = useState(false);
  const [feeEdit, setFeeEdit] = useState<{ id?: string; studentId: string; item: string; amountDue: number } | null>(null);

  const [loanOpen, setLoanOpen] = useState(false);
  const [loanEdit, setLoanEdit] = useState<{ id?: string; studentId: string; bookTitle: string; dueDate: string; returned: boolean; fineAmount: number } | null>(null);

  const [assetOpen, setAssetOpen] = useState(false);
  const [assetEdit, setAssetEdit] = useState<{ id?: string; studentId: string; asset: string; returned: boolean; replacementCost: number } | null>(null);

  const [hostelOpen, setHostelOpen] = useState(false);
  const [hostelEdit, setHostelEdit] = useState<{ id?: string; studentId: string; room: string; checkedOut: boolean; damageFee: number } | null>(null);

  const [sportsOpen, setSportsOpen] = useState(false);
  const [sportsEdit, setSportsEdit] = useState<{ id?: string; studentId: string; equipment: string; returned: boolean; replacementCost: number } | null>(null);

  // Global search input for obligations
  const [search, setSearch] = useState("");

  // Sync obligations tab state with Command Palette redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "obligations") {
      const searchParam = params.get("search");
      if (searchParam) {
        setSearch(searchParam);
      }
      if (params.get("openNew") === "true") {
        setFeeEdit({ studentId: allStudents[0]?.id || "", item: "", amountDue: 0 });
        setFeeOpen(true);
        // Clear parameter
        const newUrl = window.location.pathname + "?tab=obligations";
        window.history.replaceState(null, "", newUrl);
      }
    }
  }, [window.location.search, allStudents]);

  // Filter obligation list values dynamically
  const filteredFees = useMemo(() => {
    if (!search.trim()) return fees;
    const q = search.toLowerCase();
    return fees.filter(f => {
      const student = users.find(u => u.id === f.studentId);
      return f.item.toLowerCase().includes(q) || (student && student.name.toLowerCase().includes(q)) || (student && student.matricNo?.toLowerCase().includes(q));
    });
  }, [fees, search, users]);

  const filteredLoans = useMemo(() => {
    if (!search.trim()) return loans;
    const q = search.toLowerCase();
    return loans.filter(l => {
      const student = users.find(u => u.id === l.studentId);
      return l.bookTitle.toLowerCase().includes(q) || (student && student.name.toLowerCase().includes(q)) || (student && student.matricNo?.toLowerCase().includes(q));
    });
  }, [loans, search, users]);

  const filteredAssets = useMemo(() => {
    if (!search.trim()) return assets;
    const q = search.toLowerCase();
    return assets.filter(a => {
      const student = users.find(u => u.id === a.studentId);
      return a.asset.toLowerCase().includes(q) || (student && student.name.toLowerCase().includes(q)) || (student && student.matricNo?.toLowerCase().includes(q));
    });
  }, [assets, search, users]);

  const filteredHostels = useMemo(() => {
    if (!search.trim()) return hostel;
    const q = search.toLowerCase();
    return hostel.filter(h => {
      const student = users.find(u => u.id === h.studentId);
      return h.room.toLowerCase().includes(q) || (student && student.name.toLowerCase().includes(q)) || (student && student.matricNo?.toLowerCase().includes(q));
    });
  }, [hostel, search, users]);

  const filteredSports = useMemo(() => {
    if (!search.trim()) return sports;
    const q = search.toLowerCase();
    return sports.filter(s => {
      const student = users.find(u => u.id === s.studentId);
      return s.equipment.toLowerCase().includes(q) || (student && student.name.toLowerCase().includes(q)) || (student && student.matricNo?.toLowerCase().includes(q));
    });
  }, [sports, search, users]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="font-display font-semibold text-xl flex items-center gap-2">
            <BookOpen className="size-5 text-primary animate-pulse" /> Student Obligations
          </h3>
          <p className="text-sm text-muted-foreground font-medium">Manage fees, library loans, equipment, room status, and fines.</p>
        </div>
        
        {/* Realtime Search Filter */}
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search obligations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 w-full rounded-xl"
          />
        </div>
      </div>

      <Tabs defaultValue="finance" className="space-y-4">
        <TabsList className="glass rounded-xl p-1 flex-wrap h-auto w-fit">
          <TabsTrigger value="finance" className="rounded-lg flex items-center gap-1.5"><Wallet className="size-3.5" /> Finance</TabsTrigger>
          <TabsTrigger value="library" className="rounded-lg flex items-center gap-1.5"><BookOpen className="size-3.5" /> Library</TabsTrigger>
          <TabsTrigger value="ict" className="rounded-lg flex items-center gap-1.5"><Laptop className="size-3.5" /> ICT</TabsTrigger>
          <TabsTrigger value="hostel" className="rounded-lg flex items-center gap-1.5"><Home className="size-3.5" /> Hostel</TabsTrigger>
          <TabsTrigger value="sports" className="rounded-lg flex items-center gap-1.5"><Trophy className="size-3.5" /> Sports</TabsTrigger>
        </TabsList>

        <TabsContent value="finance" className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-md">Fee Balances</h4>
            <Button onClick={() => {
              setFeeEdit({ studentId: allStudents[0]?.id || "", item: "", amountDue: 0 });
              setFeeOpen(true);
            }} className="gradient-bg text-primary-foreground shadow-elegant h-9">
              <Plus className="size-4 mr-1" /> Add Fee Balance
            </Button>
          </div>
          <div className="glass-strong rounded-2xl overflow-hidden border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Amount Due</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground select-none">
                      <Wallet className="size-10 mx-auto text-muted-foreground/40 mb-3" />
                      <div className="font-semibold text-sm">You're all caught up.</div>
                      <div className="text-xs mt-1">No outstanding finance obligations found.</div>
                    </td>
                  </tr>
                ) : filteredFees.map((f) => {
                  const student = users.find((u) => u.id === f.studentId);
                  return (
                    <tr key={f.id} className="border-t hover:bg-muted/30 font-medium">
                      <td className="px-4 py-3">
                        <div className="font-bold">{student?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground font-semibold">{student?.matricNo || "N/A"}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground/80">{f.item}</td>
                      <td className="px-4 py-3 font-mono font-bold">{NGN(f.amountDue)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={f.amountDue > 0 ? "pending" : "approved"} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        {f.amountDue > 0 && (
                          <Button size="sm" variant="outline" className="text-success hover:text-success border-success/30 hover:bg-success/5 animate-pulse-ring" onClick={async () => {
                            try {
                              await store.upsertFeeBalance({ ...f, amountDue: 0 });
                              toast.success("Fee balance cleared successfully");
                            } catch (e) {
                              toast.error("Failed to clear balance");
                            }
                          }}><Check className="size-3.5 mr-1" /> Clear</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setFeeEdit(f); setFeeOpen(true); }}><Pencil className="size-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          if (confirm("Delete this fee record?")) {
                            try {
                              await store.deleteFeeBalance(f.id);
                              toast.success("Fee record deleted");
                            } catch (e) {
                              toast.error("Failed to delete record");
                            }
                          }
                        }}><Trash2 className="size-3.5 text-destructive" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-md">Library Book Loans</h4>
            <Button onClick={() => {
              setLoanEdit({ studentId: allStudents[0]?.id || "", bookTitle: "", dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0], returned: false, fineAmount: 0 });
              setLoanOpen(true);
            }} className="gradient-bg text-primary-foreground shadow-elegant h-9">
              <Plus className="size-4 mr-1" /> New Library Loan
            </Button>
          </div>
          <div className="glass-strong rounded-2xl overflow-hidden border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Book Title</th>
                  <th className="px-4 py-3 font-semibold">Due Date</th>
                  <th className="px-4 py-3 font-semibold">Fines</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground select-none">
                      <BookOpen className="size-10 mx-auto text-muted-foreground/40 mb-3" />
                      <div className="font-semibold text-sm">You're all caught up.</div>
                      <div className="text-xs mt-1">No active library book loans found.</div>
                    </td>
                  </tr>
                ) : filteredLoans.map((l) => {
                  const student = users.find((u) => u.id === l.studentId);
                  return (
                    <tr key={l.id} className="border-t hover:bg-muted/30 font-medium">
                      <td className="px-4 py-3">
                        <div className="font-bold">{student?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground font-semibold">{student?.matricNo || "N/A"}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground/80">{l.bookTitle}</td>
                      <td className="px-4 py-3 text-muted-foreground font-semibold">{new Date(l.dueDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-mono font-bold text-destructive">{l.fineAmount > 0 ? NGN(l.fineAmount) : "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={l.returned ? "approved" : "pending"} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        {!l.returned && (
                          <Button size="sm" variant="outline" className="text-success hover:text-success border-success/30 hover:bg-success/5 animate-pulse-ring" onClick={async () => {
                            try {
                              await store.upsertLibraryLoan({ ...l, returned: true, fineAmount: 0 });
                              toast.success("Book returned cleanly");
                            } catch (e) {
                              toast.error("Failed to return book");
                            }
                          }}><Check className="size-3.5 mr-1" /> Return</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setLoanEdit(l); setLoanOpen(true); }}><Pencil className="size-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          if (confirm("Delete this library loan?")) {
                            try {
                              await store.deleteLibraryLoan(l.id);
                              toast.success("Library record deleted");
                            } catch (e) {
                              toast.error("Failed to delete record");
                            }
                          }
                        }}><Trash2 className="size-3.5 text-destructive" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="ict" className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-md">ICT Assigned Assets</h4>
            <Button onClick={() => {
              setAssetEdit({ studentId: allStudents[0]?.id || "", asset: "", returned: false, replacementCost: 0 });
              setAssetOpen(true);
            }} className="gradient-bg text-primary-foreground shadow-elegant h-9">
              <Plus className="size-4 mr-1" /> New Asset Loan
            </Button>
          </div>
          <div className="glass-strong rounded-2xl overflow-hidden border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Asset Details</th>
                  <th className="px-4 py-3 font-semibold">Replacement Liability</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground select-none">
                      <Laptop className="size-10 mx-auto text-muted-foreground/40 mb-3" />
                      <div className="font-semibold text-sm">You're all caught up.</div>
                      <div className="text-xs mt-1">No outstanding assigned ICT assets.</div>
                    </td>
                  </tr>
                ) : filteredAssets.map((a) => {
                  const student = users.find((u) => u.id === a.studentId);
                  return (
                    <tr key={a.id} className="border-t hover:bg-muted/30 font-medium">
                      <td className="px-4 py-3">
                        <div className="font-bold">{student?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground font-semibold">{student?.matricNo || "N/A"}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground/80">{a.asset}</td>
                      <td className="px-4 py-3 font-mono font-bold text-destructive">{a.replacementCost > 0 ? NGN(a.replacementCost) : "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.returned ? "approved" : "pending"} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        {!a.returned && (
                          <Button size="sm" variant="outline" className="text-success hover:text-success border-success/30 hover:bg-success/5 animate-pulse-ring" onClick={async () => {
                            try {
                              await store.upsertIctAsset({ ...a, returned: true, replacementCost: 0 });
                              toast.success("Asset returned cleanly");
                            } catch (e) {
                              toast.error("Failed to return asset");
                            }
                          }}><Check className="size-3.5 mr-1" /> Return</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setAssetEdit(a); setAssetOpen(true); }}><Pencil className="size-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          if (confirm("Delete this asset record?")) {
                            try {
                              await store.deleteIctAsset(a.id);
                              toast.success("Asset record deleted");
                            } catch (e) {
                              toast.error("Failed to delete record");
                            }
                          }
                        }}><Trash2 className="size-3.5 text-destructive" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="hostel" className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-md">Hostel Rooms Assignments</h4>
            <Button onClick={() => {
              setHostelEdit({ studentId: allStudents[0]?.id || "", room: "", checkedOut: false, damageFee: 0 });
              setHostelOpen(true);
            }} className="gradient-bg text-primary-foreground shadow-elegant h-9">
              <Plus className="size-4 mr-1" /> Assign Hostel Room
            </Button>
          </div>
          <div className="glass-strong rounded-2xl overflow-hidden border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Room details</th>
                  <th className="px-4 py-3 font-semibold">Damage Fines</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHostels.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground select-none">
                      <Home className="size-10 mx-auto text-muted-foreground/40 mb-3" />
                      <div className="font-semibold text-sm">You're all caught up.</div>
                      <div className="text-xs mt-1">No active hostel assignments on record.</div>
                    </td>
                  </tr>
                ) : filteredHostels.map((h) => {
                  const student = users.find((u) => u.id === h.studentId);
                  return (
                    <tr key={h.id} className="border-t hover:bg-muted/30 font-medium">
                      <td className="px-4 py-3">
                        <div className="font-bold">{student?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground font-semibold">{student?.matricNo || "N/A"}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground/80">{h.room}</td>
                      <td className="px-4 py-3 font-mono font-bold text-destructive">{h.damageFee > 0 ? NGN(h.damageFee) : "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={(h.checkedOut && h.damageFee === 0) ? "approved" : "pending"} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        {(!h.checkedOut || h.damageFee > 0) && (
                          <Button size="sm" variant="outline" className="text-success hover:text-success border-success/30 hover:bg-success/5 animate-pulse-ring" onClick={async () => {
                            try {
                              await store.upsertHostelAssignment({ ...h, checkedOut: true, damageFee: 0 });
                              toast.success("Hostel room checked out cleanly");
                            } catch (e) {
                              toast.error("Failed to checkout room");
                            }
                          }}><Check className="size-3.5 mr-1" /> Checkout</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setHostelEdit(h); setHostelOpen(true); }}><Pencil className="size-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          if (confirm("Delete this hostel record?")) {
                            try {
                              await store.deleteHostelAssignment(h.id);
                              toast.success("Hostel record deleted");
                            } catch (e) {
                              toast.error("Failed to delete record");
                            }
                          }
                        }}><Trash2 className="size-3.5 text-destructive" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="sports" className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-md">Sports Kit Loans</h4>
            <Button onClick={() => {
              setSportsEdit({ studentId: allStudents[0]?.id || "", equipment: "", returned: false, replacementCost: 0 });
              setSportsOpen(true);
            }} className="gradient-bg text-primary-foreground shadow-elegant h-9">
              <Plus className="size-4 mr-1" /> Record Sports Loan
            </Button>
          </div>
          <div className="glass-strong rounded-2xl overflow-hidden border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Equipment / Kit Details</th>
                  <th className="px-4 py-3 font-semibold">Replacement Fee</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground select-none">
                      <Trophy className="size-10 mx-auto text-muted-foreground/40 mb-3" />
                      <div className="font-semibold text-sm">You're all caught up.</div>
                      <div className="text-xs mt-1">No outstanding sports equipment loans found.</div>
                    </td>
                  </tr>
                ) : filteredSports.map((s) => {
                  const student = users.find((u) => u.id === s.studentId);
                  return (
                    <tr key={s.id} className="border-t hover:bg-muted/30 font-medium">
                      <td className="px-4 py-3">
                        <div className="font-bold">{student?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground font-semibold">{student?.matricNo || "N/A"}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground/80">{s.equipment}</td>
                      <td className="px-4 py-3 font-mono font-bold text-destructive">{s.replacementCost > 0 ? NGN(s.replacementCost) : "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.returned ? "approved" : "pending"} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        {!s.returned && (
                          <Button size="sm" variant="outline" className="text-success hover:text-success border-success/30 hover:bg-success/5 animate-pulse-ring" onClick={async () => {
                            try {
                              await store.upsertSportsLoan({ ...s, returned: true, replacementCost: 0 });
                              toast.success("Sports equipment returned cleanly");
                            } catch (e) {
                              toast.error("Failed to return sports equipment");
                            }
                          }}><Check className="size-3.5 mr-1" /> Return</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setSportsEdit(s); setSportsOpen(true); }}><Pencil className="size-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          if (confirm("Delete this sports loan record?")) {
                            try {
                              await store.deleteSportsLoan(s.id);
                              toast.success("Sports record deleted");
                            } catch (e) {
                              toast.error("Failed to delete record");
                            }
                          }
                        }}><Trash2 className="size-3.5 text-destructive" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Modals */}
      <FeeDialog open={feeOpen} onClose={() => setFeeOpen(false)} item={feeEdit} students={allStudents} />
      <LibraryDialog open={loanOpen} onClose={() => setLoanOpen(false)} item={loanEdit} students={allStudents} />
      <IctDialog open={assetOpen} onClose={() => setAssetOpen(false)} item={assetEdit} students={allStudents} />
      <HostelDialog open={hostelOpen} onClose={() => setHostelOpen(false)} item={hostelEdit} students={allStudents} />
      <SportsDialog open={sportsOpen} onClose={() => setSportsOpen(false)} item={sportsEdit} students={allStudents} />
    </div>
  );
}

function FeeDialog({ open, onClose, item, students }: { open: boolean; onClose: () => void; item: { id?: string; studentId: string; item: string; amountDue: number } | null; students: User[] }) {
  const [draft, setDraft] = useState(item);
  useEffect(() => { if (open) setDraft(item); }, [open, item]);
  if (!draft) return null;
  const save = async () => {
    if (!draft.studentId) return toast.error("Please select a student");
    if (!draft.item.trim()) return toast.error("Please enter a description");
    try {
      await store.upsertFeeBalance(draft);
      toast.success("Fee record saved");
      onClose();
    } catch (e) {
      toast.error("Failed to save fee record");
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display font-semibold text-lg">{draft.id ? "Edit Fee Balance" : "New Fee Balance"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <StudentSelect value={draft.studentId} onChange={(v) => setDraft({ ...draft, studentId: v })} students={students} />
          <div className="space-y-1.5"><Label htmlFor="desc">Description</Label><Input id="desc" value={draft.item} onChange={(e) => setDraft({ ...draft, item: e.target.value })} placeholder="e.g. Tuition fee balance" /></div>
          <div className="space-y-1.5"><Label htmlFor="amt">Amount Due (KES)</Label><Input id="amt" type="number" value={draft.amountDue || ""} onChange={(e) => setDraft({ ...draft, amountDue: Number(e.target.value) })} placeholder="0" /></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="gradient-bg text-primary-foreground shadow-elegant" onClick={save}>Save</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LibraryDialog({ open, onClose, item, students }: { open: boolean; onClose: () => void; item: { id?: string; studentId: string; bookTitle: string; dueDate: string; returned: boolean; fineAmount: number } | null; students: User[] }) {
  const [draft, setDraft] = useState(item);
  useEffect(() => { if (open) setDraft(item); }, [open, item]);
  if (!draft) return null;
  const save = async () => {
    if (!draft.studentId) return toast.error("Please select a student");
    if (!draft.bookTitle.trim()) return toast.error("Please enter a book title");
    if (!draft.dueDate) return toast.error("Please select a due date");
    try {
      await store.upsertLibraryLoan(draft);
      toast.success("Library record saved");
      onClose();
    } catch (e) {
      toast.error("Failed to save library record");
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display font-semibold text-lg">{draft.id ? "Edit Library Loan" : "New Library Loan"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <StudentSelect value={draft.studentId} onChange={(v) => setDraft({ ...draft, studentId: v })} students={students} />
          <div className="space-y-1.5"><Label htmlFor="title">Book Title</Label><Input id="title" value={draft.bookTitle} onChange={(e) => setDraft({ ...draft, bookTitle: e.target.value })} placeholder="e.g. Database System Concepts" /></div>
          <div className="space-y-1.5"><Label htmlFor="due">Due Date</Label><Input id="due" type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="fine">Fine Amount (KES)</Label><Input id="fine" type="number" value={draft.fineAmount || ""} onChange={(e) => setDraft({ ...draft, fineAmount: Number(e.target.value) })} placeholder="0" /></div>
          <div className="flex items-center gap-2 py-1"><input type="checkbox" id="ret" checked={draft.returned} onChange={(e) => setDraft({ ...draft, returned: e.target.checked, fineAmount: e.target.checked ? 0 : draft.fineAmount })} className="size-4 rounded border-gray-350" /><Label htmlFor="ret" className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">Mark as Returned (clears outstanding fine)</Label></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="gradient-bg text-primary-foreground shadow-elegant" onClick={save}>Save</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IctDialog({ open, onClose, item, students }: { open: boolean; onClose: () => void; item: { id?: string; studentId: string; asset: string; returned: boolean; replacementCost: number } | null; students: User[] }) {
  const [draft, setDraft] = useState(item);
  useEffect(() => { if (open) setDraft(item); }, [open, item]);
  if (!draft) return null;
  const save = async () => {
    if (!draft.studentId) return toast.error("Please select a student");
    if (!draft.asset.trim()) return toast.error("Please enter an asset name");
    try {
      await store.upsertIctAsset(draft);
      toast.success("Asset assignment saved");
      onClose();
    } catch (e) {
      toast.error("Failed to save asset record");
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display font-semibold text-lg">{draft.id ? "Edit Asset Assignment" : "New Asset Assignment"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <StudentSelect value={draft.studentId} onChange={(v) => setDraft({ ...draft, studentId: v })} students={students} />
          <div className="space-y-1.5"><Label htmlFor="asset">Asset Name</Label><Input id="asset" value={draft.asset} onChange={(e) => setDraft({ ...draft, asset: e.target.value })} placeholder="e.g. Laptop LP-102" /></div>
          <div className="space-y-1.5"><Label htmlFor="cost">Replacement Liability (KES)</Label><Input id="cost" type="number" value={draft.replacementCost || ""} onChange={(e) => setDraft({ ...draft, replacementCost: Number(e.target.value) })} placeholder="0" /></div>
          <div className="flex items-center gap-2 py-1"><input type="checkbox" id="iret" checked={draft.returned} onChange={(e) => setDraft({ ...draft, returned: e.target.checked, replacementCost: e.target.checked ? 0 : draft.replacementCost })} className="size-4 rounded border-gray-350" /><Label htmlFor="iret" className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">Mark as Returned</Label></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="gradient-bg text-primary-foreground shadow-elegant" onClick={save}>Save</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HostelDialog({ open, onClose, item, students }: { open: boolean; onClose: () => void; item: { id?: string; studentId: string; room: string; checkedOut: boolean; damageFee: number } | null; students: User[] }) {
  const [draft, setDraft] = useState(item);
  useEffect(() => { if (open) setDraft(item); }, [open, item]);
  if (!draft) return null;
  const save = async () => {
    if (!draft.studentId) return toast.error("Please select a student");
    if (!draft.room.trim()) return toast.error("Please enter room details");
    try {
      await store.upsertHostelAssignment(draft);
      toast.success("Hostel record saved");
      onClose();
    } catch (e) {
      toast.error("Failed to save hostel record");
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display font-semibold text-lg">{draft.id ? "Edit Hostel Assignment" : "New Hostel Assignment"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <StudentSelect value={draft.studentId} onChange={(v) => setDraft({ ...draft, studentId: v })} students={students} />
          <div className="space-y-1.5"><Label htmlFor="room">Room Details</Label><Input id="room" value={draft.room} onChange={(e) => setDraft({ ...draft, room: e.target.value })} placeholder="e.g. Hall A, Room 304" /></div>
          <div className="space-y-1.5"><Label htmlFor="damage">Damage / Outstanding Fees (KES)</Label><Input id="damage" type="number" value={draft.damageFee || ""} onChange={(e) => setDraft({ ...draft, damageFee: Number(e.target.value) })} placeholder="0" /></div>
          <div className="flex items-center gap-2 py-1"><input type="checkbox" id="hco" checked={draft.checkedOut} onChange={(e) => setDraft({ ...draft, checkedOut: e.target.checked })} className="size-4 rounded border-gray-350" /><Label htmlFor="hco" className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">Mark as Checked Out</Label></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="gradient-bg text-primary-foreground shadow-elegant" onClick={save}>Save</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SportsDialog({ open, onClose, item, students }: { open: boolean; onClose: () => void; item: { id?: string; studentId: string; equipment: string; returned: boolean; replacementCost: number } | null; students: User[] }) {
  const [draft, setDraft] = useState(item);
  useEffect(() => { if (open) setDraft(item); }, [open, item]);
  if (!draft) return null;
  const save = async () => {
    if (!draft.studentId) return toast.error("Please select a student");
    if (!draft.equipment.trim()) return toast.error("Please enter equipment details");
    try {
      await store.upsertSportsLoan(draft);
      toast.success("Sports record saved");
      onClose();
    } catch (e) {
      toast.error("Failed to save sports record");
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display font-semibold text-lg">{draft.id ? "Edit Sports Loan" : "New Sports Loan"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <StudentSelect value={draft.studentId} onChange={(v) => setDraft({ ...draft, studentId: v })} students={students} />
          <div className="space-y-1.5"><Label htmlFor="equip">Equipment Name</Label><Input id="equip" value={draft.equipment} onChange={(e) => setDraft({ ...draft, equipment: e.target.value })} placeholder="e.g. Football kit" /></div>
          <div className="space-y-1.5"><Label htmlFor="scost">Replacement / Fine (KES)</Label><Input id="scost" type="number" value={draft.replacementCost || ""} onChange={(e) => setDraft({ ...draft, replacementCost: Number(e.target.value) })} placeholder="0" /></div>
          <div className="flex items-center gap-2 py-1"><input type="checkbox" id="sret" checked={draft.returned} onChange={(e) => setDraft({ ...draft, returned: e.target.checked, replacementCost: e.target.checked ? 0 : draft.replacementCost })} className="size-4 rounded border-gray-350" /><Label htmlFor="sret" className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">Mark as Returned</Label></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="gradient-bg text-primary-foreground shadow-elegant" onClick={save}>Save</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
