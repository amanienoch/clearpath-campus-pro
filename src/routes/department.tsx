import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useAuthUser, useStore, store } from "@/lib/store";
import { ClearanceRequest, ClearanceStatus, Department, REQUEST_TYPE_LABEL, User } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard, Search, CheckCircle2, Clock, XCircle, Inbox, BadgeCheck, Sparkles, AlertTriangle,
  Activity, TrendingUp, BarChart3, Timer, CalendarDays, Percent, FileText, ExternalLink,
  BookOpen, Wallet, Laptop, Home, Trophy, Check, Shield, Zap, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { evaluateDepartment, NGN } from "@/lib/eligibility";
import { UnifiedActivityFeed } from "@/components/UnifiedActivityFeed";

export const Route = createFileRoute("/department")({
  head: () => ({ meta: [{ title: "Department Dashboard — E-Clearance" }] }),
  component: DepartmentPage,
});

/* ─────────────────────────────────────────────────────────────────────────────
 * GLASSMORPHISM TOOLTIP STYLE — reused across all charts (matches Admin)
 * ───────────────────────────────────────────────────────────────────────── */
const GLASS_TOOLTIP = {
  background: "var(--glass-bg)",
  backdropFilter: "blur(8px)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "var(--shadow-glass)",
} as const;
const TOOLTIP_ITEM = { fontSize: 11, fontWeight: 600 } as const;
const TOOLTIP_LABEL = { fontSize: 11, fontWeight: 700 } as const;

/* Chart colors — matching Admin oklch palette */
const COLOR_APPROVED = "oklch(0.65 0.18 155)";
const COLOR_PENDING = "oklch(0.78 0.16 75)";
const COLOR_REJECTED = "oklch(0.6 0.23 27)";
const COLOR_PRIMARY = "oklch(0.52 0.22 265)";

/* ─────────────────────────────────────────────────────────────────────────────
 * MAIN PAGE COMPONENT
 * ───────────────────────────────────────────────────────────────────────── */
function DepartmentPage() {
  const user = useAuthUser();
  const dept = user?.department as Department | undefined;
  const navigate = useNavigate();

  useEffect(() => {
    if (dept === "Registrar") {
      navigate({ to: "/registrar" });
    }
  }, [dept, navigate]);

  const all = useStore((s) => s.requests);
  const allUsers = useStore((s) => s.users);
  const activity = useStore((s) => s.activity);
  const hydrated = useStore((s) => s.hydrated);

  // Obligation data for eligibility evaluations
  const loans = useStore((s) => s.loans);
  const fees = useStore((s) => s.fees);
  const assets = useStore((s) => s.assets);
  const hostel = useStore((s) => s.hostel);
  const sports = useStore((s) => s.sports);

  const requests = useMemo(() => {
    if (!dept) return [];
    return all.filter((r) => r.departments.some((d) => d.department === dept));
  }, [all, dept]);

  const [activeTab, setActiveTab] = useState("requests");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | ClearanceStatus>("all");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get("search");
    if (searchParam) {
      setQ(searchParam);
      const newUrl = window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
  }, [window.location.search]);

  const myStatusOf = useCallback(
    (r: ClearanceRequest) => r.departments.find((d) => d.department === dept)!.status,
    [dept],
  );

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const matchesQ = !q || [r.studentName, r.matricNo, r.clearanceId].some((s) => s.toLowerCase().includes(q.toLowerCase()));
      const matchesF = filter === "all" || myStatusOf(r) === filter;
      return matchesQ && matchesF;
    });
  }, [requests, q, filter, myStatusOf]);

  const stats = useMemo(() => ({
    total: requests.length,
    approved: requests.filter((r) => myStatusOf(r) === "approved").length,
    pending: requests.filter((r) => myStatusOf(r) === "pending").length,
    rejected: requests.filter((r) => myStatusOf(r) === "rejected").length,
  }), [requests, myStatusOf]);

  /* ── Advanced KPI calculations ── */
  const approvalRate = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.approved / stats.total) * 100);
  }, [stats]);

  const avgProcessingTime = useMemo(() => {
    const processed = requests.filter((r) => {
      const d = r.departments.find((x) => x.department === dept);
      return d && d.status !== "pending" && d.reviewedAt;
    });
    if (processed.length === 0) return "—";
    const total = processed.reduce((sum, r) => {
      const d = r.departments.find((x) => x.department === dept)!;
      const submitted = new Date(r.submittedAt).getTime();
      const reviewed = new Date(d.reviewedAt!).getTime();
      return sum + Math.max(0, reviewed - submitted);
    }, 0);
    const avgDays = total / processed.length / (1000 * 60 * 60 * 24);
    return avgDays < 1 ? `${Math.round(avgDays * 24)}h` : `${avgDays.toFixed(1)}d`;
  }, [requests, dept]);

  const requestsThisMonth = useMemo(() => {
    const now = new Date();
    return requests.filter((r) => {
      const d = new Date(r.submittedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [requests]);

  const oldestPending = useMemo(() => {
    const pending = requests.filter((r) => myStatusOf(r) === "pending");
    if (pending.length === 0) return "—";
    const oldest = pending.reduce((oldest, r) => {
      return new Date(r.submittedAt) < new Date(oldest.submittedAt) ? r : oldest;
    });
    const days = Math.floor((Date.now() - new Date(oldest.submittedAt).getTime()) / (1000 * 60 * 60 * 24));
    return days === 0 ? "Today" : `${days}d`;
  }, [requests, myStatusOf]);

  /* ── Queue Intelligence ── */
  const queueMetrics = useMemo(() => {
    const pendingReqs = requests.filter((r) => myStatusOf(r) === "pending");
    const now = Date.now();
    const olderThan7 = pendingReqs.filter((r) => now - new Date(r.submittedAt).getTime() > 7 * 24 * 60 * 60 * 1000).length;
    const avgWait = pendingReqs.length === 0 ? 0 : pendingReqs.reduce((s, r) => s + (now - new Date(r.submittedAt).getTime()), 0) / pendingReqs.length / (1000 * 60 * 60 * 24);
    return {
      pending: pendingReqs.length,
      olderThan7,
      avgWait: avgWait < 1 ? `${Math.round(avgWait * 24)}h` : `${avgWait.toFixed(1)}d`,
      approvalRate: `${approvalRate}%`,
    };
  }, [requests, myStatusOf, approvalRate]);

  /* ── Charts Data ── */
  const trendData = useMemo(() => {
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

  const pieData = useMemo(() => [
    { name: "Approved", value: stats.approved, color: COLOR_APPROVED },
    { name: "Pending", value: stats.pending, color: COLOR_PENDING },
    { name: "Rejected", value: stats.rejected, color: COLOR_REJECTED },
  ], [stats]);

  const dailyActivity = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      const label = d.toLocaleDateString("default", { month: "short", day: "numeric" });
      const count = requests.filter((r) => {
        const rd = r.departments.find((x) => x.department === dept);
        if (!rd || !rd.reviewedAt) return false;
        const rev = new Date(rd.reviewedAt);
        return rev.toDateString() === d.toDateString();
      }).length;
      return { day: label, processed: count };
    });
  }, [requests, dept]);

  const queueHealth = useMemo(() => {
    const pending = requests.filter((r) => myStatusOf(r) === "pending");
    const now = Date.now();
    const buckets = { "<24h": 0, "1–3d": 0, "3–7d": 0, ">7d": 0 };
    pending.forEach((r) => {
      const age = (now - new Date(r.submittedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (age < 1) buckets["<24h"]++;
      else if (age < 3) buckets["1–3d"]++;
      else if (age < 7) buckets["3–7d"]++;
      else buckets[">7d"]++;
    });
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [requests, myStatusOf]);

  /* ── Department activity feed ── */
  const deptActivity = useMemo(() => {
    if (!dept) return [];
    const deptLower = dept.toLowerCase();
    return activity.filter((a) =>
      a.actor.toLowerCase().includes(deptLower) ||
      a.action.toLowerCase().includes(deptLower)
    );
  }, [activity, dept]);

  /* ── Selected states ── */
  const [selected, setSelected] = useState<ClearanceRequest | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [activitySearch, setActivitySearch] = useState("");

  /* ── Bulk Action States ── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkState, setBulkState] = useState<{
    isOpen: boolean;
    running: boolean;
    results: { approved: number; skipped: number; failed: number } | null;
  }>({ isOpen: false, running: false, results: null });

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [filtered]);

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleBulkApprove = async () => {
    if (!dept) return;
    setBulkState(prev => ({ ...prev, running: true, results: null }));
    let approved = 0;
    let skipped = 0;
    let failed = 0;

    const reviewer = user?.name ?? "Staff";

    for (const id of Array.from(selectedIds)) {
      const req = requests.find(r => r.id === id);
      if (!req) continue;

      // Skip if already approved in this dept
      const currentStatus = req.departments.find(d => d.department === dept)?.status;
      if (currentStatus === "approved") {
        skipped++;
        continue;
      }

      const evalResult = evaluateDepartment(dept, req.studentId, { loans, fees, assets, hostel, sports });
      if (evalResult.eligible) {
        try {
          await store.reviewDepartment(req.id, dept, "approved", "Bulk Smart Approval: Cleared.", reviewer);
          approved++;
        } catch (e) {
          failed++;
        }
      } else {
        skipped++;
      }
    }

    if (approved > 0 || failed > 0 || skipped > 0) {
      await store.logActivity(reviewer, `performed bulk smart approval (Approved: ${approved}, Skipped: ${skipped}, Failed: ${failed})`, "Multiple Requests");
    }

    setBulkState({ isOpen: true, running: false, results: { approved, skipped, failed } });
    setSelectedIds(new Set());
  };

  const handleStudentClick = useCallback((studentId: string) => {
    const student = allUsers.find((u) => u.id === studentId);
    if (student) setSelectedStudent(student);
  }, [allUsers]);

  const handleFilterFromChart = useCallback((status: "all" | ClearanceStatus) => {
    setFilter(status);
    setActiveTab("requests");
  }, []);

  /* ── Skeleton loading state ── */
  if (!hydrated) {
    return (
      <AppShell
        title={`${dept ?? "Department"} Clearance`}
        role="department"
        nav={[
          { to: "/department", label: "Requests", icon: <LayoutDashboard className="size-4" /> },
          { to: "/verify", label: "Verify Certificate", icon: <BadgeCheck className="size-4" /> },
        ]}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`${dept ?? "Department"} Clearance`}
      role="department"
      nav={[
        { to: "/department", label: "Requests", icon: <LayoutDashboard className="size-4" /> },
        { to: "/verify", label: "Verify Certificate", icon: <BadgeCheck className="size-4" /> },
      ]}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="glass rounded-xl p-1 flex-wrap h-auto">
          <TabsTrigger value="requests" className="rounded-lg flex items-center gap-1.5">
            <LayoutDashboard className="size-3.5" /> Requests
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg flex items-center gap-1.5">
            <TrendingUp className="size-3.5" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-lg flex items-center gap-1.5">
            <Activity className="size-3.5" /> Activity
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
         *  REQUESTS TAB
         * ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="requests" className="space-y-6">
          {/* Queue Intelligence Section */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <QueueWidget
              icon={<Clock className="size-4 text-warning" />}
              label="Awaiting Review"
              value={queueMetrics.pending}
              tone="warning"
            />
            <QueueWidget
              icon={<AlertTriangle className="size-4 text-destructive" />}
              label="Older Than 7 Days"
              value={queueMetrics.olderThan7}
              tone="destructive"
            />
            <QueueWidget
              icon={<Timer className="size-4 text-primary" />}
              label="Average Wait"
              value={queueMetrics.avgWait}
            />
            <QueueWidget
              icon={<Percent className="size-4 text-success" />}
              label="Approval Rate"
              value={queueMetrics.approvalRate}
              tone="success"
            />
          </div>

          {/* KPI Filter Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Inbox className="size-5 text-primary" />}
              label="Total Requests"
              value={stats.total}
              onClick={() => setFilter("all")}
              active={filter === "all"}
            />
            <StatCard
              icon={<CheckCircle2 className="size-5 text-success" />}
              label="Approved"
              value={stats.approved}
              onClick={() => setFilter("approved")}
              active={filter === "approved"}
              tone="success"
            />
            <StatCard
              icon={<Clock className="size-5 text-warning" />}
              label="Pending"
              value={stats.pending}
              onClick={() => setFilter("pending")}
              active={filter === "pending"}
              tone="warning"
            />
            <StatCard
              icon={<XCircle className="size-5 text-destructive" />}
              label="Rejected"
              value={stats.rejected}
              onClick={() => setFilter("rejected")}
              active={filter === "rejected"}
              tone="destructive"
            />
          </div>

          {/* Search and Filter Bar */}
          <div className="glass-strong rounded-2xl p-5 flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by name, matric no, or clearance ID…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex gap-1 rounded-lg border p-1 bg-background w-full sm:w-auto overflow-x-auto">
              {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                    filter === f ? "gradient-bg text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >{f}</button>
              ))}
            </div>
            <Button 
              variant="outline" 
              className="gradient-bg text-primary-foreground border-0 shadow-md transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 whitespace-nowrap"
              disabled={selectedIds.size === 0}
              onClick={() => setBulkState({ isOpen: true, running: false, results: null })}
            >
              <CheckCircle2 className="size-4 mr-1.5" />
              Approve Eligible ({selectedIds.size})
            </Button>
          </div>

          {/* Active Filter Chips */}
          {(filter !== "all" || q) && (
            <div className="flex items-center gap-2 flex-wrap animate-fade-in">
              {filter !== "all" && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold">
                  Status: <span className="capitalize font-bold">{filter}</span>
                  <button onClick={() => setFilter("all")} className="hover:text-foreground ml-1 font-bold font-mono">×</button>
                </span>
              )}
              {q && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold">
                  Search: <span className="font-bold">&ldquo;{q}&rdquo;</span>
                  <button onClick={() => setQ("")} className="hover:text-foreground ml-1 font-bold font-mono">×</button>
                </span>
              )}
            </div>
          )}

          {/* Request Table */}
          <div className="glass-strong rounded-2xl overflow-hidden border border-border/40">
            {filtered.length === 0 ? (
              <div className="p-12 text-center select-none animate-fade-in">
                <Inbox className="size-10 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="font-semibold text-sm text-foreground/90">All caught up</h3>
                <p className="text-xs text-muted-foreground mt-1 font-medium">No records match the current filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 w-10 text-center">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                          checked={filtered.length > 0 && selectedIds.size === filtered.length}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          aria-label="Select all requests"
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Clearance ID</th>
                      <th className="px-4 py-3 font-semibold">Submitted</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={r.id} className="border-t row-hover-premium animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                            checked={selectedIds.has(r.id)}
                            onChange={(e) => handleSelectRow(r.id, e.target.checked)}
                            aria-label={`Select request ${r.clearanceId}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleStudentClick(r.studentId)}
                            className="font-semibold hover:underline hover:text-primary text-left block cursor-pointer"
                          >
                            {r.studentName}
                          </button>
                          <div className="text-xs text-muted-foreground font-semibold">{r.matricNo} · {r.program}</div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">{r.clearanceId}</td>
                        <td className="px-4 py-3 text-muted-foreground font-medium">{new Date(r.submittedAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3"><StatusBadge status={myStatusOf(r)} /></td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" className="hover:scale-[1.02] transition-all cursor-pointer font-semibold rounded-xl" onClick={() => setSelected(r)}>Review</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
         *  ANALYTICS TAB
         * ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="analytics" className="space-y-6">
          {/* 8 Premium KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => handleFilterFromChart("all")} className="text-left w-full hover:scale-[1.01] transition-transform cursor-pointer">
              <BigStat icon={<Inbox className="size-6 text-primary animate-pulse" />} label="Total Requests" value={stats.total} />
            </button>
            <button onClick={() => handleFilterFromChart("approved")} className="text-left w-full hover:scale-[1.01] transition-transform cursor-pointer">
              <BigStat icon={<CheckCircle2 className="size-6" />} label="Approved" value={stats.approved} tone="success" />
            </button>
            <button onClick={() => handleFilterFromChart("pending")} className="text-left w-full hover:scale-[1.01] transition-transform cursor-pointer">
              <BigStat icon={<Clock className="size-6" />} label="Pending" value={stats.pending} tone="warning" />
            </button>
            <button onClick={() => handleFilterFromChart("rejected")} className="text-left w-full hover:scale-[1.01] transition-transform cursor-pointer">
              <BigStat icon={<XCircle className="size-6" />} label="Rejected" value={stats.rejected} tone="destructive" />
            </button>
            <button onClick={() => handleFilterFromChart("all")} className="text-left w-full hover:scale-[1.01] transition-transform cursor-pointer">
              <BigStat icon={<Percent className="size-6 text-success animate-pulse" />} label="Approval Rate" value={`${approvalRate}%`} tone="success" />
            </button>
            <button onClick={() => handleFilterFromChart("all")} className="text-left w-full hover:scale-[1.01] transition-transform cursor-pointer">
              <BigStat icon={<Timer className="size-6 text-primary" />} label="Avg Processing Time" value={avgProcessingTime} />
            </button>
            <button onClick={() => handleFilterFromChart("all")} className="text-left w-full hover:scale-[1.01] transition-transform cursor-pointer">
              <BigStat icon={<CalendarDays className="size-6 text-primary" />} label="Requests This Month" value={requestsThisMonth} />
            </button>
            <button onClick={() => handleFilterFromChart("pending")} className="text-left w-full hover:scale-[1.01] transition-transform cursor-pointer">
              <BigStat icon={<AlertTriangle className="size-6 text-destructive" />} label="Oldest Pending" value={oldestPending} tone={oldestPending !== "—" && oldestPending !== "Today" ? "destructive" : undefined} />
            </button>
          </div>

          {/* Charts Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Monthly Requests Trend */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Monthly Requests Trend</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <Tooltip contentStyle={GLASS_TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
                  <Line type="monotone" dataKey="requests" stroke={COLOR_PRIMARY} strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Approval Distribution */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Approval Distribution</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
                    {pieData.map((e) => (
                      <Cell
                        key={e.name}
                        fill={e.color}
                        className="cursor-pointer hover:opacity-85"
                        onClick={() => {
                          const statusMap: Record<string, ClearanceStatus> = { Approved: "approved", Pending: "pending", Rejected: "rejected" };
                          handleFilterFromChart(statusMap[e.name]);
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={GLASS_TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 600, paddingTop: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Processing Activity */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Daily Processing Activity</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <Tooltip contentStyle={GLASS_TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
                  <Bar dataKey="processed" fill={COLOR_APPROVED} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Queue Health */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Queue Health</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={queueHealth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="range" tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <Tooltip contentStyle={GLASS_TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {queueHealth.map((entry, index) => (
                      <Cell
                        key={`cell-queue-${index}`}
                        fill={index < 2 ? COLOR_APPROVED : index === 2 ? COLOR_PENDING : COLOR_REJECTED}
                        className="cursor-pointer hover:opacity-85"
                        onClick={() => handleFilterFromChart("pending")}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
         *  ACTIVITY TAB
         * ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="activity" className="space-y-4">
          <div className="glass-strong rounded-2xl p-6 border border-border/40">
            <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
              <Activity className="size-5 text-primary animate-pulse" /> Department Activity
            </h3>
            <UnifiedActivityFeed items={deptActivity} />
          </div>
        </TabsContent>
      </Tabs>

      <ReviewModal
        req={selected}
        dept={dept}
        onClose={() => setSelected(null)}
        reviewer={user?.name ?? "Staff"}
        obligationData={{ loans, fees, assets, hostel, sports }}
      />

      <StudentDrawer
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
        requests={requests}
        dept={dept}
        allRequests={all}
        loans={loans}
        fees={fees}
        assets={assets}
        hostel={hostel}
        sports={sports}
      />

      <BulkApprovalModal
        isOpen={bulkState.isOpen}
        running={bulkState.running}
        results={bulkState.results}
        selectedCount={selectedIds.size}
        onClose={() => setBulkState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleBulkApprove}
      />
    </AppShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * STAT CARD (Requests tab KPI cards with filter)
 * ───────────────────────────────────────────────────────────────────────── */
function StatCard({
  icon, label, value, onClick, active, tone,
}: {
  icon: React.ReactNode; label: string; value: number;
  onClick?: () => void; active?: boolean;
  tone?: "success" | "warning" | "destructive";
}) {
  const toneBgCls = tone === "success"
    ? "bg-success/15 text-success border border-success/20"
    : tone === "warning"
      ? "bg-warning/15 text-warning border border-warning/20"
      : tone === "destructive"
        ? "bg-destructive/15 text-destructive border border-destructive/20"
        : "bg-primary/15 text-primary border border-primary/20";

  const ringCls = tone === "success" ? "ring-success" : tone === "warning" ? "ring-warning" : tone === "destructive" ? "ring-destructive" : "ring-primary";

  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left block w-full rounded-2xl transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        active ? `ring-2 ${ringCls} ring-offset-2 scale-[1.01] shadow-md` : "hover:scale-[1.01]"
      )}
    >
      <div className="glass-strong rounded-2xl p-5 hover-lift animate-fade-up border border-border/40 hover:border-border/80 h-full transition-all duration-200">
        <div className="flex items-center justify-between">
          <div className={`size-11 rounded-xl grid place-items-center ${toneBgCls} transition-transform group-hover:scale-110`}>{icon}</div>
        </div>
        <div className="mt-4 font-display font-bold text-2xl sm:text-3xl tracking-tight text-foreground/95">
          <AnimatedCounter value={value} />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-2">{label}</div>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BIG STAT (Analytics tab KPI cards — matches Admin's BigStat)
 * ───────────────────────────────────────────────────────────────────────── */
function BigStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone?: "success" | "warning" | "destructive" }) {
  const toneBgCls = tone === "success"
    ? "bg-success/15 text-success border border-success/20"
    : tone === "warning"
      ? "bg-warning/15 text-warning border border-warning/20"
      : tone === "destructive"
        ? "bg-destructive/15 text-destructive border border-destructive/20"
        : "bg-primary/15 text-primary border border-primary/20";

  return (
    <div className="glass-strong rounded-2xl p-5 hover-lift animate-fade-up border border-border/40 shadow-xs hover:border-border/80 transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className={`size-11 rounded-xl grid place-items-center ${toneBgCls} transition-transform group-hover:scale-110`}>{icon}</div>
      </div>
      <div className="font-display font-bold text-2xl sm:text-3xl mt-4 tracking-tight text-foreground/95 truncate">
        {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-2">{label}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * QUEUE WIDGET (compact operational KPI in Requests tab)
 * ───────────────────────────────────────────────────────────────────────── */
function QueueWidget({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone?: "success" | "warning" | "destructive" }) {
  const borderCls = tone === "success" ? "border-success/20" : tone === "warning" ? "border-warning/20" : tone === "destructive" ? "border-destructive/20" : "border-border/40";

  return (
    <div className={cn("glass-strong rounded-xl p-4 border animate-fade-up hover-lift transition-all duration-200", borderCls)}>
      <div className="flex items-center gap-2.5">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold text-lg sm:text-xl tracking-tight text-foreground/95 truncate">
            {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ACTIVITY FEED
 * ───────────────────────────────────────────────────────────────────────── */
function ActivityFeed({
  items, search, dept, allRequests, onStudentClick,
}: {
  items: { id: string; at: string; actor: string; action: string; target?: string }[];
  search: string;
  dept: string;
  allRequests: ClearanceRequest[];
  onStudentClick: (studentId: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((a) =>
      a.actor.toLowerCase().includes(q) ||
      a.action.toLowerCase().includes(q) ||
      (a.target && a.target.toLowerCase().includes(q))
    );
  }, [items, search]);

  if (filtered.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground select-none animate-fade-in">
        <Inbox className="size-10 mx-auto text-muted-foreground/45 mb-3" />
        <div className="font-semibold text-sm">No activity found</div>
        <div className="text-xs mt-1">
          {search ? "No records match your search." : `No ${dept} activity logged yet.`}
        </div>
      </div>
    );
  }

  return (
    <ol className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
      {filtered.map((a, i) => {
        // Try to find a matching request for the activity target
        const matchedReq = a.target ? allRequests.find((r) => r.id === a.target || r.clearanceId === a.target) : null;

        return (
          <li key={a.id} className="flex items-start gap-3 p-3 rounded-xl border bg-card/50 hover:bg-card/75 transition-colors animate-fade-up" style={{ animationDelay: `${i * 20}ms` }}>
            <div className="size-9 rounded-full gradient-bg grid place-items-center text-primary-foreground text-xs font-bold shrink-0 shadow-sm">
              {a.actor.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">
                <span className="font-bold text-foreground">{a.actor}</span>{" "}
                {a.action}
                {a.target && (
                  <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded ml-1 font-bold">
                    ID: {a.target.slice(0, 8)}
                  </span>
                )}
              </div>
              {matchedReq && (
                <button
                  onClick={() => onStudentClick(matchedReq.studentId)}
                  className="text-xs text-primary font-semibold mt-0.5 hover:underline cursor-pointer flex items-center gap-1"
                >
                  {matchedReq.studentName} <ChevronRight className="size-3" />
                </button>
              )}
              <div className="text-xs text-muted-foreground mt-1 font-medium">{new Date(a.at).toLocaleString()}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ENHANCED REVIEW MODAL with Department Intelligence Panel
 * ───────────────────────────────────────────────────────────────────────── */
function ReviewModal({
  req, dept, onClose, reviewer, obligationData,
}: {
  req: ClearanceRequest | null;
  dept?: Department;
  onClose: () => void;
  reviewer: string;
  obligationData: { loans: any[]; fees: any[]; assets: any[]; hostel: any[]; sports: any[] };
}) {
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);

  useEffect(() => {
    if (req && dept) {
      const mine = req.departments.find((d) => d.department === dept);
      setRemarks(mine?.remarks ?? "");
    }
  }, [req, dept]);

  const evalResult = useMemo(
    () => (req && dept ? evaluateDepartment(dept, req.studentId, obligationData) : null),
    [req, dept, obligationData],
  );

  const mine = useMemo(() => {
    if (!req || !dept) return null;
    return req.departments.find((d) => d.department === dept) ?? null;
  }, [req, dept]);

  /* Confidence score calculation — presentation logic only */
  const confidenceScore = useMemo(() => {
    if (!evalResult) return 0;
    const blockingCount = evalResult.obligations.filter((o) => o.blocking).length;
    return Math.max(0, Math.min(100, 100 - blockingCount * 5));
  }, [evalResult]);

  const act = async (status: "approved" | "rejected") => {
    if (!req || !dept || !mine) return;
    if (status === "rejected" && remarks.trim().length < 3) {
      return toast.error("Please add remarks before rejecting.");
    }
    if (remarks.length > 500) return toast.error("Remarks too long (max 500 characters)");

    setBusy(status);
    try {
      await store.reviewDepartment(req.id, dept, status, remarks.trim() || (status === "approved" ? "Cleared." : ""), reviewer);
      toast.success(`Request ${status}`);
      setRemarks("");
      onClose();
    } catch (e) {
      toast.error(`Failed to update request to ${status}`);
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {req && dept && mine ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Review request</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              {/* Student Info */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border">
                <Info label="Student" value={req.studentName} />
                <Info label="Matric No" value={req.matricNo} />
                <Info label="Program" value={req.program} />
                <Info label="Faculty" value={req.faculty} />
                <Info label="Clearance ID" value={req.clearanceId} mono />
                <Info label="Type" value={REQUEST_TYPE_LABEL[req.requestType]} />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Reason</div>
                <div className="text-sm">{req.reason}</div>
              </div>

              {/* ── Department Intelligence Panel ── */}
              {evalResult && (
                <div className={`p-4 rounded-xl border ${evalResult.eligible ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Shield className={`size-5 ${evalResult.eligible ? "text-success" : "text-destructive"}`} />
                      <div className="font-display font-bold text-sm">
                        SYSTEM RECOMMENDATION
                      </div>
                    </div>
                    <div className={`text-xs font-mono px-3 py-1 rounded-full font-bold border ${evalResult.eligible ? "bg-success/15 text-success border-success/30" : "bg-destructive/15 text-destructive border-destructive/30"}`}>
                      Confidence: {confidenceScore}%
                    </div>
                  </div>

                  {/* Obligation checklist */}
                  <div className="space-y-1.5 mb-3">
                    {evalResult.obligations.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-success font-semibold p-2 rounded-lg bg-success/10 border border-success/20">
                        <CheckCircle2 className="size-3.5" /> No outstanding obligations detected
                      </div>
                    ) : (
                      evalResult.obligations.map((o, i) => (
                        <div key={i} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border ${o.blocking ? "bg-destructive/10 border-destructive/20" : "bg-success/10 border-success/20"}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {o.blocking ? (
                              <AlertTriangle className="size-3.5 text-destructive shrink-0" />
                            ) : (
                              <CheckCircle2 className="size-3.5 text-success shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="font-medium truncate">{o.label}</div>
                              {o.detail && <div className="text-muted-foreground truncate">{o.detail}</div>}
                            </div>
                          </div>
                          {o.cost > 0 && <div className="font-mono ml-2 shrink-0">{NGN(o.cost)}</div>}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Total cost */}
                  {evalResult.totalCost > 0 && (
                    <div className="text-xs font-mono px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30 inline-flex mb-3">
                      {NGN(evalResult.totalCost)} outstanding
                    </div>
                  )}

                  {/* Recommended Action */}
                  <div className={`flex items-center gap-2 p-3 rounded-lg border ${evalResult.eligible ? "bg-success/15 border-success/30" : "bg-destructive/15 border-destructive/30"}`}>
                    <Zap className={`size-4 ${evalResult.eligible ? "text-success" : "text-destructive"}`} />
                    <span className="text-xs font-bold uppercase tracking-wider">Recommended Action:</span>
                    <span className={`text-sm font-display font-bold ${evalResult.eligible ? "text-success" : "text-destructive"}`}>
                      {evalResult.eligible ? "APPROVE" : "REJECT"}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-3 italic">
                    You retain final approval authority — use this as a guideline alongside your records.
                  </p>
                </div>
              )}

              {/* Current status */}
              <div className="p-4 rounded-xl border bg-card flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Current {dept} status</div>
                  <div className="font-medium mt-0.5">{mine.remarks || "Awaiting review"}</div>
                </div>
                <StatusBadge status={mine.status} />
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea id="remarks" rows={3} placeholder="Add a note for the student…" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" onClick={onClose} disabled={!!busy}>Close</Button>
                <Button variant="destructive" onClick={() => act("rejected")} disabled={!!busy}><XCircle className="size-4 mr-1" /> {busy === "rejected" ? "Rejecting…" : "Reject"}</Button>
                <Button className="gradient-bg text-primary-foreground" onClick={() => act("approved")} disabled={!!busy}><CheckCircle2 className="size-4 mr-1" /> {busy === "approved" ? "Approving…" : "Approve"}</Button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-6 text-center text-muted-foreground">No request selected</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * STUDENT INTELLIGENCE DRAWER (Sheet)
 * ───────────────────────────────────────────────────────────────────────── */
function StudentDrawer({
  student, onClose, requests, dept, allRequests, loans, fees, assets, hostel, sports,
}: {
  student: User | null;
  onClose: () => void;
  requests: ClearanceRequest[];
  dept?: Department;
  allRequests: ClearanceRequest[];
  loans: any[];
  fees: any[];
  assets: any[];
  hostel: any[];
  sports: any[];
}) {
  if (!student) return null;

  const studentRequests = useMemo(() => allRequests.filter((r) => r.studentId === student.id), [allRequests, student.id]);

  // Current request in this department
  const currentRequest = useMemo(() => {
    return requests.find((r) => r.studentId === student.id);
  }, [requests, student.id]);

  const currentDeptStatus = useMemo(() => {
    if (!currentRequest || !dept) return null;
    return currentRequest.departments.find((d) => d.department === dept) ?? null;
  }, [currentRequest, dept]);

  // Outstanding obligations
  const studentFees = useMemo(() => fees.filter((f) => f.studentId === student.id && Number(f.amountDue ?? 0) > 0), [fees, student.id]);
  const studentLoans = useMemo(() => loans.filter((l) => l.studentId === student.id && !(l.returned ?? false)), [loans, student.id]);
  const studentAssets = useMemo(() => assets.filter((a) => a.studentId === student.id && !(a.returned ?? false)), [assets, student.id]);
  const studentHostel = useMemo(() => hostel.filter((h) => h.studentId === student.id && (!(h.checkedOut ?? false) || Number(h.damageFee ?? 0) > 0)), [hostel, student.id]);
  const studentSports = useMemo(() => sports.filter((s) => s.studentId === student.id && !(s.returned ?? false)), [sports, student.id]);
  const totalOutstanding = studentFees.length + studentLoans.length + studentAssets.length + studentHostel.length + studentSports.length;

  // Certificate status
  const activeCert = useMemo(() => {
    // Find the latest approved request
    const approved = studentRequests
      .filter((r) => r.overallStatus === "approved")
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    if (approved.length === 0) return null;
    return approved[0];
  }, [studentRequests]);

  const pendingCert = useMemo(() => {
    return studentRequests.some((r) => r.overallStatus === "pending");
  }, [studentRequests]);

  return (
    <Sheet open={!!student} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto custom-scrollbar">
        <SheetHeader className="pb-4 border-b border-border/40">
          <SheetTitle className="font-display text-xl flex items-center gap-2">
            <div className="size-10 rounded-full gradient-bg grid place-items-center text-primary-foreground text-sm font-bold shrink-0 shadow-sm">
              {student.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div>{student.name}</div>
              {student.admissionNumber && (
                <div className="text-xs font-mono text-muted-foreground font-medium">Adm: {student.admissionNumber}</div>
              )}
            </div>
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Student Intelligence Profile
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Student Profile */}
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <FileText className="size-3.5" /> Student Profile
            </h4>
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-muted/40 border">
              <Info label="Full Name" value={student.name} />
              <Info label="Matric No" value={student.matricNo || "—"} />
              <Info label="Program" value={student.program || "—"} />
              <Info label="Faculty" value={student.faculty || "—"} />
              <Info label="Level" value={student.level || "—"} />
              <Info label="Email" value={student.email ?? "—"} />
            </div>
          </section>

          {/* Current Request */}
          {currentRequest && currentDeptStatus && (
            <section>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Clock className="size-3.5" /> Current Request
              </h4>
              <div className="p-4 rounded-xl border bg-card/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-muted-foreground">{currentRequest.clearanceId}</span>
                  <StatusBadge status={currentDeptStatus.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {REQUEST_TYPE_LABEL[currentRequest.requestType]} · Submitted {new Date(currentRequest.submittedAt).toLocaleDateString()}
                </div>
                {currentDeptStatus.remarks && (
                  <div className="text-xs bg-muted/30 p-2 rounded border italic">
                    <span className="font-semibold">Remarks:</span> {currentDeptStatus.remarks}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Outstanding Obligations */}
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <BookOpen className="size-3.5" /> Outstanding Obligations ({totalOutstanding})
            </h4>
            {totalOutstanding === 0 ? (
              <div className="p-4 border border-success/35 bg-success/5 text-success rounded-xl flex items-center gap-2 text-xs font-bold shadow-sm">
                <Check className="size-4 animate-pulse" /> All clear! No outstanding obligations in any department.
              </div>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {studentFees.map((f) => (
                  <ObligationRow key={f.id} dept="Finance" icon={<Wallet className="size-3.5" />} label="Fee Balance" detail={f.item ?? "N/A"} cost={f.amountDue ?? 0} />
                ))}
                {studentLoans.map((l) => (
                  <ObligationRow key={l.id} dept="Library" icon={<BookOpen className="size-3.5" />} label="Overdue Book" detail={`${l.bookTitle ?? "N/A"} (Due ${l.dueDate ? new Date(l.dueDate).toLocaleDateString() : "N/A"})`} cost={l.fineAmount ?? 0} />
                ))}
                {studentAssets.map((a) => (
                  <ObligationRow key={a.id} dept="ICT" icon={<Laptop className="size-3.5" />} label="Outstanding Asset" detail={a.asset ?? "N/A"} cost={a.replacementCost ?? 0} />
                ))}
                {studentHostel.map((h) => (
                  <ObligationRow key={h.id} dept="Hostel" icon={<Home className="size-3.5" />} label="Room Assignment" detail={`${h.room ?? "N/A"} ${!(h.checkedOut ?? false) ? "· Pending checkout" : ""}`} cost={h.damageFee ?? 0} />
                ))}
                {studentSports.map((s) => (
                  <ObligationRow key={s.id} dept="Sports" icon={<Trophy className="size-3.5" />} label="Loaned Equipment" detail={s.equipment ?? "N/A"} cost={s.replacementCost ?? 0} />
                ))}
              </div>
            )}
          </section>

          {/* Certificate Status */}
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <BadgeCheck className="size-3.5" /> Certificate Status
            </h4>
            {activeCert ? (
              <div className="p-4 rounded-xl border border-success/30 bg-success/5 space-y-3">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="size-5 text-success animate-pulse" />
                  <span className="text-sm font-bold text-success">Active Certificate</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Clearance ID</div>
                    <div className="font-mono font-bold mt-0.5">{activeCert.clearanceId}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Issue Date</div>
                    <div className="font-medium mt-0.5">{new Date(activeCert.submittedAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <Button asChild size="sm" className="gradient-bg text-primary-foreground shadow-elegant w-full">
                  <Link to="/verify" search={{ id: activeCert.clearanceId } as any} target="_blank">
                    Verify Online <ExternalLink className="size-3.5 ml-1.5" />
                  </Link>
                </Button>
              </div>
            ) : pendingCert ? (
              <div className="p-4 rounded-xl border border-warning/30 bg-warning/5 flex items-center gap-2">
                <Clock className="size-4 text-warning animate-pulse" />
                <span className="text-xs font-bold text-warning">Certificate Pending — Clearance in progress</span>
              </div>
            ) : (
              <div className="p-4 rounded-xl border bg-muted/20 text-center">
                <span className="text-xs text-muted-foreground font-semibold">No certificate issued</span>
              </div>
            )}
          </section>

          {/* Clearance History */}
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <FileText className="size-3.5" /> Clearance History ({studentRequests.length})
            </h4>
            {studentRequests.length === 0 ? (
              <div className="p-6 border rounded-xl text-center text-muted-foreground text-xs font-semibold bg-muted/10 select-none">
                <FileText className="size-6 mx-auto text-muted-foreground/30 mb-2.5" />
                <div>No clearance history found</div>
                <div className="text-[10px] text-muted-foreground/80 mt-0.5">This student has not submitted any clearance requests.</div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {studentRequests.map((r) => (
                  <div key={r.id} className="flex justify-between items-center p-3 rounded-lg border bg-card font-semibold text-xs">
                    <div>
                      <div className="font-bold text-foreground">{REQUEST_TYPE_LABEL[r.requestType] ?? "N/A"}</div>
                      <div className="text-muted-foreground font-mono font-medium mt-0.5">{r.clearanceId ?? "N/A"} &middot; {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "N/A"}</div>
                    </div>
                    <StatusBadge status={r.overallStatus ?? "pending"} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * OBLIGATION ROW (used in Student Drawer)
 * ───────────────────────────────────────────────────────────────────────── */
function ObligationRow({ dept, icon, label, detail, cost }: { dept: string; icon: React.ReactNode; label: string; detail: string; cost: number }) {
  return (
    <div className="flex justify-between items-center text-xs p-3 rounded-lg border border-destructive/20 bg-destructive/5 font-semibold">
      <div className="flex items-start gap-2 min-w-0">
        <div className="text-destructive mt-0.5 shrink-0">{icon}</div>
        <div>
          <div className="font-bold text-destructive">{dept} Dept · {label}</div>
          <div className="text-muted-foreground font-medium mt-0.5 truncate">{detail}</div>
        </div>
      </div>
      {cost > 0 && <div className="font-mono font-bold text-destructive text-sm ml-2 shrink-0">{NGN(cost)}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * INFO FIELD (reused in modals and drawers)
 * ───────────────────────────────────────────────────────────────────────── */
function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-medium text-sm mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BULK APPROVAL MODAL
 * ───────────────────────────────────────────────────────────────────────── */
function BulkApprovalModal({
  isOpen, running, results, selectedCount, onClose, onConfirm,
}: {
  isOpen: boolean; running: boolean; results: { approved: number; skipped: number; failed: number } | null;
  selectedCount: number; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && !running && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Zap className="size-6 text-primary" /> Bulk Smart Approval
          </DialogTitle>
        </DialogHeader>
        
        {!results && !running && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              You are about to evaluate <strong>{selectedCount}</strong> selected request{selectedCount !== 1 ? 's' : ''}. The system will run the eligibility logic for each request and <strong>approve only those that satisfy all department requirements</strong>.
            </p>
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary font-medium flex items-start gap-2">
              <Shield className="size-4 shrink-0 mt-0.5" />
              This action is safe. It will not bypass your department's approval rules. Requests with outstanding obligations will be skipped automatically.
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button className="gradient-bg text-primary-foreground" onClick={onConfirm}>
                <CheckCircle2 className="size-4 mr-2" /> Start Bulk Approval
              </Button>
            </div>
          </div>
        )}

        {running && (
          <div className="py-8 text-center space-y-4 animate-fade-in">
            <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <Timer className="size-6 text-primary animate-spin" />
            </div>
            <div>
              <div className="font-bold">Processing Requests...</div>
              <div className="text-xs text-muted-foreground mt-1">Applying eligibility rules to {selectedCount} request{selectedCount !== 1 ? 's' : ''}.</div>
            </div>
          </div>
        )}

        {results && (
          <div className="space-y-5 py-2 animate-fade-up">
            <div className="text-center space-y-1 mb-4">
              <div className="size-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="size-6 text-success" />
              </div>
              <div className="font-bold text-lg">Bulk Approval Complete</div>
              <div className="text-xs text-muted-foreground">The system has processed all selected requests.</div>
            </div>
            
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl border border-success/30 bg-success/5">
                <div className="text-2xl font-bold text-success font-display">{results.approved}</div>
                <div className="text-[10px] uppercase font-bold text-success/80 mt-1 tracking-wider">Approved</div>
              </div>
              <div className="p-3 rounded-xl border border-warning/30 bg-warning/5">
                <div className="text-2xl font-bold text-warning font-display">{results.skipped}</div>
                <div className="text-[10px] uppercase font-bold text-warning/80 mt-1 tracking-wider">Skipped</div>
              </div>
              <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/5">
                <div className="text-2xl font-bold text-destructive font-display">{results.failed}</div>
                <div className="text-[10px] uppercase font-bold text-destructive/80 mt-1 tracking-wider">Failed</div>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              Requests were skipped if they had outstanding obligations or were already approved.
            </p>
            
            <div className="flex justify-center pt-2">
              <Button onClick={onClose} className="w-full">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
