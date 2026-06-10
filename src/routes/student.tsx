import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuthUser, useStore, store, usePasswordChangeRequired } from "@/lib/store";
import { ClearanceRequest, REQUEST_TYPES, REQUEST_TYPE_LABEL, REQUEST_TYPE_DEPARTMENTS, RequestType, Department } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { QrCode } from "@/components/QrCode";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LayoutDashboard, FileText, BadgeCheck, QrCode as QrIcon, Send, CheckCircle2, Clock, XCircle, Download, AlertTriangle, Sparkles, BookOpen, Wallet, Laptop, Home, Trophy, Activity, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { evaluateDepartment, NGN } from "@/lib/eligibility";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student")({
  head: () => ({ meta: [{ title: "Student Dashboard — E-Clearance" }] }),
  component: StudentPage,
});

interface AuditEvent {
  time: Date;
  title: string;
  body: string;
  icon: React.ReactNode;
  actor: string;
  status: "approved" | "rejected" | "pending" | "info";
}

function StudentPage() {
  const user = useAuthUser();
  const all = useStore((s) => s.requests);
  const hydrated = useStore((s) => s.hydrated);
  const passwordChangeRequired = usePasswordChangeRequired();

  if (passwordChangeRequired) {
    return (
      <AppShell
        title="Student Portal"
        role="student"
        nav={[]}
      >
        <div className="glass-strong rounded-3xl p-12 text-center space-y-5 max-w-md mx-auto my-12 border border-warning/20 bg-warning/5 shadow-elegant animate-fade-up">
          <div className="size-16 rounded-2xl bg-warning/15 grid place-items-center text-warning mx-auto animate-pulse">
            <AlertTriangle className="size-8" />
          </div>
          <h3 className="font-display font-semibold text-xl">Change Password Required</h3>
          <p className="text-muted-foreground text-sm leading-relaxed font-medium">
            For security reasons, you must update your default password before accessing your clearance dashboard.
          </p>
          <Button onClick={() => window.location.href = "/settings"} className="w-full gradient-bg text-primary-foreground shadow-elegant h-10 hover:scale-[1.01] transition-transform">
            Go to Account Settings
          </Button>
        </div>
      </AppShell>
    );
  }

  const myRequests = useMemo(
    () =>
      all
        .filter((r) => r.studentId === user?.id)
        .slice()
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)),
    [all, user],
  );
  const active = myRequests[0];
  const latestActiveCertificate = useMemo(() => {
    const approved = myRequests.filter((r) => r.overallStatus === "approved");
    return approved.find((req) => {
      const hasNewer = approved.some(
        (r) =>
          r.requestType === req.requestType &&
          new Date(r.submittedAt).getTime() > new Date(req.submittedAt).getTime()
      );
      return !hasNewer;
    });
  }, [myRequests]);
  const [tab, setTab] = useState("overview");
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  if (!hydrated) {
    return (
      <AppShell
        title="Student Portal"
        role="student"
        nav={[
          { to: "/student", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
          { to: "/verify", label: "Verify Certificate", icon: <BadgeCheck className="size-4" /> },
        ]}
      >
        <div className="space-y-8 animate-pulse">
          {/* Hero Skeleton */}
          <div className="h-44 w-full rounded-3xl bg-muted/40" />
          
          {/* Tabs Skeleton */}
          <div className="flex gap-2">
            <div className="h-10 w-28 rounded-xl bg-muted/40" />
            <div className="h-10 w-28 rounded-xl bg-muted/40" />
            <div className="h-10 w-28 rounded-xl bg-muted/40" />
          </div>

          {/* Cards Grid Skeleton */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="h-28 rounded-2xl bg-muted/40" />
            <div className="h-28 rounded-2xl bg-muted/40" />
            <div className="h-28 rounded-2xl bg-muted/40" />
          </div>

          {/* Body Skeleton */}
          <div className="space-y-4">
            <div className="h-8 w-48 rounded bg-muted/40" />
            <div className="h-64 rounded-2xl bg-muted/40" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Student Portal"
      role="student"
      nav={[
        { to: "/student", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
        { to: "/verify", label: "Verify Certificate", icon: <BadgeCheck className="size-4" /> },
      ]}
    >
      <div className="space-y-8">
        <Hero user={user?.name ?? "Student"} active={active} />

        {latestActiveCertificate && (
          <button
            onClick={() => setTab("certificate")}
            className="w-full text-left bg-success/15 border border-success/30 hover:border-success/50 transition-all rounded-2xl p-4 flex items-center justify-between gap-3 text-success animate-fade-in cursor-pointer group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-success/20 grid place-items-center shrink-0">
                <BadgeCheck className="size-6 text-success animate-pulse" />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm sm:text-base">Clearance Completed Successfully!</h4>
                <p className="text-xs text-muted-foreground font-semibold mt-0.5 group-hover:text-success/80 transition-colors">
                  Congratulations! Your digital clearance certificate is ready. Click here to view or print it.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold bg-success/20 px-3 py-1 rounded-full shrink-0 group-hover:scale-105 transition-transform">
              View Certificate
            </span>
          </button>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="glass rounded-xl p-1 flex-wrap h-auto">
            <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
            <TabsTrigger value="submit" className="rounded-lg">New Request</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg">History</TabsTrigger>
            <TabsTrigger value="certificate" className="rounded-lg">Certificate</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            {active ? (
              <Overview
                req={active}
                onTabChange={setTab}
                onSelectDept={setSelectedDept}
                onSelectEvent={setSelectedEvent}
              />
            ) : (
              <Empty />
            )}
          </TabsContent>
          <TabsContent value="submit" className="mt-6">
            <NewRequestForm onSubmitted={() => setTab("overview")} />
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <History list={myRequests} onSelectEvent={setSelectedEvent} />
          </TabsContent>
          <TabsContent value="certificate" className="mt-6">
            {latestActiveCertificate ? (
              <Certificate req={latestActiveCertificate} />
            ) : (
              <CertificateEmpty />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <EligibilityDetailDialog
        open={!!selectedDept}
        onClose={() => setSelectedDept(null)}
        department={selectedDept}
        studentId={user?.id || ""}
      />
      <TimelineEventDialog
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
      />
    </AppShell>
  );
}

function Hero({ user, active }: { user: string; active?: ClearanceRequest }) {
  const total = active?.departments.length ?? 0;
  const approved = active?.departments.filter((d) => d.status === "approved").length ?? 0;
  const pct = total ? Math.round((approved / total) * 100) : 0;
  return (
    <div className="relative overflow-hidden rounded-3xl hero-bg p-8 sm:p-10 text-primary-foreground shadow-elegant">
      <div className="absolute -top-10 -right-10 size-64 bg-white/10 rounded-full blur-3xl" />
      <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="text-sm/none text-white/80 mb-3">Welcome back,</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold">{user}</h2>
          <p className="mt-2 text-white/85 max-w-xl font-medium">
            {active
              ? `Your ${REQUEST_TYPE_LABEL[active.requestType]} is ${pct}% complete across ${total} department${total === 1 ? "" : "s"}.`
              : "You don't have any active clearance request yet. Start one in a few clicks."}
          </p>
        </div>
        {active && (
          <div className="text-right shrink-0">
            <div className="text-xs text-white/75 font-semibold">Clearance ID</div>
            <div className="font-display font-bold text-xl sm:text-2xl mt-1">{active.clearanceId}</div>
            <div className="mt-3 w-56 h-2 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-white transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 text-xs text-white/80 tabular-nums font-semibold"><AnimatedCounter value={pct} suffix="% complete" /></div>
          </div>
        )}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="glass-strong rounded-3xl p-12 text-center select-none">
      <InboxIcon className="size-12 mx-auto text-muted-foreground/40 mb-3" />
      <h3 className="font-display font-semibold text-lg">You're all caught up.</h3>
      <p className="text-muted-foreground text-sm mt-1 font-medium">No clearance requests require attention. Submit a new request to begin.</p>
    </div>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function Overview({
  req,
  onTabChange,
  onSelectDept,
  onSelectEvent
}: {
  req: ClearanceRequest;
  onTabChange: (t: string) => void;
  onSelectDept: (d: Department) => void;
  onSelectEvent: (evt: any) => void;
}) {
  const user = useAuthUser();
  const loans = useStore((s) => s.loans);
  const fees = useStore((s) => s.fees);
  const assets = useStore((s) => s.assets);
  const hostel = useStore((s) => s.hostel);
  const sports = useStore((s) => s.sports);
  const data = { loans, fees, assets, hostel, sports };
  const stats = {
    approved: req.departments.filter((d) => d.status === "approved").length,
    pending: req.departments.filter((d) => d.status === "pending").length,
    rejected: req.departments.filter((d) => d.status === "rejected").length,
  };
  const evals = useMemo(
    () => req.departments.map((d) => evaluateDepartment(d.department, user?.id || req.studentId, data)),
    [req, data, user],
  );
  const totalOutstanding = evals.reduce((s, e) => s + e.totalCost, 0);
  const blocking = evals.filter((e) => !e.eligible).length;

  const targetStudentId = user?.id || req.studentId;

  const completedAt = useMemo(() => {
    if (req.overallStatus !== "approved") return null;
    const times = req.departments
      .map((d) => d.reviewedAt)
      .filter(Boolean)
      .map((t) => new Date(t!).getTime());
    if (times.length === 0) return req.submittedAt;
    return new Date(Math.max(...times)).toISOString();
  }, [req]);

  const pct = useMemo(() => {
    const total = req.departments.length;
    if (!total) return 0;
    return Math.round((stats.approved / total) * 100);
  }, [req, stats.approved]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={<CheckCircle2 className="size-5 text-success" />} label="Departments Approved" value={`${stats.approved}/${req.departments.length}`} />
        <Stat icon={<AlertTriangle className="size-5 text-warning" />} label="Blocking Obligations" value={blocking} />
        <Stat icon={<XCircle className="size-5 text-destructive" />} label="Total Outstanding" value={NGN(totalOutstanding)} />
      </div>

      {/* Live Clearance Progress Tracker */}
      <div
        onClick={() => onTabChange("history")}
        className="glass-strong rounded-2xl p-6 border border-border/40 space-y-5 cursor-pointer hover:border-primary/45 hover:scale-[1.005] transition-all shadow-sm group text-left block w-full"
      >
        <div>
          <h3 className="font-display font-semibold text-base sm:text-lg flex items-center gap-2">
            <Sparkles className="size-5 text-primary animate-pulse" /> Live Clearance Progress
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">Automatic real-time department clearance verification</p>
        </div>
        
        {/* Progress bar and details */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span>Overall Verification</span>
            <span className="font-mono bg-primary/15 text-primary px-2 py-0.5 rounded-lg text-[10px] font-black">{pct}% Complete</span>
          </div>
          {/* Progress bar visual block */}
          <div className="flex items-center gap-4">
            {/* Tailwind Visual Progress Bar */}
            <div className="flex-1 h-3.5 rounded-full bg-muted border border-border/20 overflow-hidden relative shadow-inner">
              <div
                className="h-full gradient-bg transition-all duration-1000 ease-out rounded-full shadow-glow"
                style={{ width: `${pct}%` }}
              />
            </div>
            {/* Text blocks: ████████░░ */}
            <div className="hidden sm:block font-mono text-xs font-black text-primary select-none tracking-wider whitespace-nowrap">
              {Array.from({ length: 10 }).map((_, idx) => (idx < Math.round(pct / 10) ? "█" : "░")).join("")}
            </div>
          </div>
        </div>

        {/* Compact Grid of department ticks */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1" onClick={(e) => e.stopPropagation()}>
          {req.departments.map((d) => {
            const isApproved = d.status === "approved";
            const isRejected = d.status === "rejected";
            return (
              <button
                type="button"
                key={d.department}
                onClick={() => onSelectDept(d.department)}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl border transition-all text-xs font-semibold shadow-xs select-none text-left cursor-pointer hover:border-primary/50",
                  isApproved && "bg-success/5 border-success/30 text-success font-bold",
                  isRejected && "bg-destructive/5 border-destructive/30 text-destructive font-bold",
                  !isApproved && !isRejected && "bg-muted/40 border-border/40 text-muted-foreground"
                )}
              >
                <div className={cn("size-2 rounded-full shrink-0 animate-pulse",
                  isApproved && "bg-success",
                  isRejected && "bg-destructive",
                  !isApproved && !isRejected && "bg-muted-foreground/60"
                )} />
                <span className="truncate">{d.department}</span>
                <span className="ml-auto shrink-0 font-bold">
                  {isApproved && "✓"}
                  {isRejected && "✗"}
                  {!isApproved && !isRejected && "⏳"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Realtime Tracking Timeline */}
      <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-primary animate-pulse" />
            <h3 className="font-display font-semibold text-base sm:text-lg">Clearance Tracking Timeline</h3>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 bg-muted/40 px-2 py-1 rounded-lg">
            <Clock className="size-3" /> Auto-updates live
          </span>
        </div>

        <div className="relative pl-6 border-l border-border/60 ml-4 space-y-6 my-2">
          {/* Step 1: Submission */}
          <div
            onClick={() => onSelectEvent({
              time: new Date(req.submittedAt),
              title: "Clearance Request Initialized",
              body: `Routed clearance type: "${REQUEST_TYPE_LABEL[req.requestType]}". Reason: "${req.reason}"`,
              actor: req.studentName,
              status: "info"
            })}
            className="relative animate-fade-in cursor-pointer hover:opacity-85 transition-opacity"
          >
            <div className="absolute -left-9 top-0 size-6 rounded-full bg-primary grid place-items-center text-primary-foreground shadow-elegant">
              <Send className="size-3 text-primary-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-mono font-semibold">
                {new Date(req.submittedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </div>
              <div className="font-semibold text-sm mt-0.5">Request Submitted & Routed</div>
              <p className="text-xs text-muted-foreground mt-0.5 italic">
                &ldquo;{req.reason}&rdquo;
              </p>
            </div>
          </div>

          {/* Department Step Reviews */}
          {req.departments.map((d) => {
            const isApproved = d.status === "approved";
            const isRejected = d.status === "rejected";
            const isPending = d.status === "pending";

            let iconNode = <Clock className="size-3 text-muted-foreground animate-pulse" />;
            let bgClass = "bg-muted border border-border/40";
            if (isApproved) {
              iconNode = <CheckCircle2 className="size-3 text-primary-foreground animate-pulse" />;
              bgClass = "bg-success shadow-elegant text-primary-foreground";
            } else if (isRejected) {
              iconNode = <XCircle className="size-3 text-primary-foreground" />;
              bgClass = "bg-destructive shadow-elegant text-primary-foreground";
            }

            const evt = {
              time: d.reviewedAt ? new Date(d.reviewedAt) : new Date(req.submittedAt),
              title: `${d.department} Department Review`,
              body: isApproved
                ? `Department clearance CLEARED. Remarks: "${d.remarks || 'Clearance successfully cleared'}"`
                : isRejected
                ? `Department clearance REJECTED. Remarks: "${d.remarks || 'Outstanding obligations require attention'}"`
                : `Awaiting record verification by ${d.department} officers`,
              actor: d.reviewedBy || `${d.department} Reviewing Officer`,
              status: isApproved ? "approved" : isRejected ? "rejected" : "pending"
            };

            return (
              <div
                key={d.department}
                onClick={() => onSelectEvent(evt)}
                className="relative animate-fade-in cursor-pointer hover:opacity-85 transition-opacity"
              >
                <div className={cn("absolute -left-9 top-0 size-6 rounded-full grid place-items-center", bgClass)}>
                  {iconNode}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-mono flex items-center gap-2 font-semibold">
                    <span>{d.department} Department</span>
                    {d.reviewedAt && (
                      <span>&middot; {new Date(d.reviewedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                    )}
                  </div>
                  <div className="font-semibold text-sm mt-0.5 flex items-center gap-1.5">
                    {d.department} Clearance
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                    {isApproved && `Cleared by ${d.reviewedBy || "department officer"}`}
                    {isRejected && `Remarks: ${d.remarks || "Obligations outstanding"}`}
                    {isPending && `Awaiting record verification by ${d.department} officers`}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Step Last: Certificate generation */}
          <div
            onClick={() => {
              if (req.overallStatus === "approved") {
                onSelectEvent({
                  time: new Date(completedAt || req.submittedAt),
                  title: "E-Clearance Certificate Issued",
                  body: "All department approvals successfully registered. Verified digital e-clearance certificate is fully online and printable.",
                  actor: "Office of the Registrar",
                  status: "approved"
                });
              }
            }}
            className={cn("relative animate-fade-in", req.overallStatus === "approved" && "cursor-pointer hover:opacity-85 transition-opacity")}
          >
            {req.overallStatus === "approved" ? (
              <div className="absolute -left-9 top-0 size-6 rounded-full bg-primary grid place-items-center text-primary-foreground shadow-elegant">
                <BadgeCheck className="size-3 text-primary-foreground" />
              </div>
            ) : (
              <div className="absolute -left-9 top-0 size-6 rounded-full bg-muted border border-border/40 grid place-items-center text-muted-foreground">
                <BadgeCheck className="size-3 text-muted-foreground" />
              </div>
            )}
            <div>
              <div className="text-xs text-muted-foreground font-mono font-semibold">
                {completedAt ? new Date(completedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Awaiting clearance"}
              </div>
              <div className="font-semibold text-sm mt-0.5">E-Clearance Certificate Generated</div>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                {req.overallStatus === "approved"
                  ? "Congratulations! Your university clearance certificate is fully signed and active."
                  : "Locked. The registrar will issue your digital certificate once all departments clear."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {totalOutstanding > 0 && (
        <div className="glass-strong rounded-2xl p-6 border border-destructive/20 bg-destructive/5 space-y-4 animate-fade-up">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 animate-pulse" />
            <h3 className="font-display font-semibold text-base sm:text-lg">Outstanding Obligations (Attention Required)</h3>
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            You have outstanding obligations that are currently blocking your clearance. Please clear these with the respective departments:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Library Obligations */}
            {loans.filter(l => l.studentId === targetStudentId && !l.returned).length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-primary"><BookOpen className="size-4 animate-pulse" /> Library Books Overdue</div>
                <ul className="space-y-1.5 text-xs font-semibold">
                  {loans.filter(l => l.studentId === targetStudentId && !l.returned).map(l => (
                    <li key={l.id} className="flex justify-between border-b pb-1.5 last:border-0 last:pb-0">
                      <span>{l.bookTitle} <span className="text-muted-foreground font-mono font-medium">(Due {new Date(l.dueDate).toLocaleDateString()})</span></span>
                      {l.fineAmount > 0 && <span className="font-mono text-destructive">{NGN(l.fineAmount)} fine</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Finance Obligations */}
            {fees.filter(f => f.studentId === targetStudentId && f.amountDue > 0).length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-primary"><Wallet className="size-4 animate-pulse" /> Finance Fees Outstanding</div>
                <ul className="space-y-1.5 text-xs font-semibold">
                  {fees.filter(f => f.studentId === targetStudentId && f.amountDue > 0).map(f => (
                    <li key={f.id} className="flex justify-between border-b pb-1.5 last:border-0 last:pb-0">
                      <span>{f.item}</span>
                      <span className="font-mono text-destructive">{NGN(f.amountDue)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ICT Obligations */}
            {assets.filter(a => a.studentId === targetStudentId && !a.returned).length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-primary"><Laptop className="size-4 animate-pulse" /> ICT Assigned Assets</div>
                <ul className="space-y-1.5 text-xs font-semibold">
                  {assets.filter(a => a.studentId === targetStudentId && !a.returned).map(a => (
                    <li key={a.id} className="flex justify-between border-b pb-1.5 last:border-0 last:pb-0">
                      <span>{a.asset}</span>
                      {a.replacementCost > 0 && <span className="font-mono text-muted-foreground font-medium">({NGN(a.replacementCost)} replacement)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Hostel Obligations */}
            {hostel.filter(h => h.studentId === targetStudentId && (!h.checkedOut || h.damageFee > 0)).length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-primary"><Home className="size-4 animate-pulse" /> Hostel Checkout Status</div>
                <ul className="space-y-1.5 text-xs font-semibold">
                  {hostel.filter(h => h.studentId === targetStudentId && (!h.checkedOut || h.damageFee > 0)).map(h => (
                    <li key={h.id} className="flex justify-between border-b pb-1.5 last:border-0 last:pb-0">
                      <span>{h.room} {!h.checkedOut && <span className="text-destructive font-semibold">(Pending checkout)</span>}</span>
                      {h.damageFee > 0 && <span className="font-mono text-destructive">{NGN(h.damageFee)} charges</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sports Obligations */}
            {sports.filter(s => s.studentId === targetStudentId && !s.returned).length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-primary"><Trophy className="size-4 animate-pulse" /> Sports Equipment Loans</div>
                <ul className="space-y-1.5 text-xs font-semibold">
                  {sports.filter(s => s.studentId === targetStudentId && !s.returned).map(s => (
                    <li key={s.id} className="flex justify-between border-b pb-1.5 last:border-0 last:pb-0">
                      <span>{s.equipment}</span>
                      {s.replacementCost > 0 && <span className="font-mono text-muted-foreground font-medium">({NGN(s.replacementCost)} replacement)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass-strong rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display font-semibold text-base sm:text-lg">Eligibility Breakdown</h3>
            <p className="text-sm text-muted-foreground font-medium">{REQUEST_TYPE_LABEL[req.requestType]} · {req.departments.length} department{req.departments.length === 1 ? "" : "s"}</p>
          </div>
          {stats.rejected > 0 && (
            <div className="text-xs px-3 py-1.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30 font-bold">
              Action required from your side
            </div>
          )}
        </div>
        <div className="space-y-3">
          {req.departments.map((d, i) => {
            const e = evals[i];
            return (
              <button
                type="button"
                key={d.department}
                onClick={() => onSelectDept(d.department)}
                className="w-full text-left rounded-xl border bg-card/50 p-4 hover-lift hover:border-primary/50 transition-all block cursor-pointer"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-sm sm:text-base">{d.department}</div>
                      <RecPill rec={e.recommendation} eligible={e.eligible} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">{e.summary}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {e.totalCost > 0 && (
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Outstanding</div>
                        <div className="font-mono font-bold text-destructive text-sm">{NGN(e.totalCost)}</div>
                      </div>
                    )}
                    <StatusBadge status={d.status} />
                  </div>
                </div>
                {e.obligations.length > 0 && (
                  <ul className="mt-3 grid sm:grid-cols-2 gap-2">
                    {e.obligations.map((o, j) => (
                      <li key={j} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border font-semibold ${o.blocking ? "bg-destructive/5 border-destructive/20 text-destructive" : "bg-success/5 border-success/20 text-success"}`}>
                        <div className="min-w-0">
                          <div className="font-bold truncate">{o.label}</div>
                          {o.detail && <div className="text-[10px] text-muted-foreground truncate font-medium">{o.detail}</div>}
                        </div>
                        {o.cost > 0 && <div className="font-mono ml-2 shrink-0">{NGN(o.cost)}</div>}
                      </li>
                    ))}
                  </ul>
                )}
                {d.remarks && (
                  <div className="mt-3 text-xs px-3 py-2 rounded-lg bg-muted/50 border font-medium">
                    <span className="font-bold text-muted-foreground">Officer remarks: </span>{d.remarks}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function RecPill({ rec, eligible }: { rec: "approve" | "action_required" | "review"; eligible: boolean }) {
  if (rec === "approve" && eligible)
    return <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 inline-flex items-center gap-1 font-bold"><Sparkles className="size-3" /> Eligible</span>;
  if (rec === "action_required")
    return <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30 font-bold">Action Required</span>;
  return <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground border font-bold">Manual Review</span>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="glass-strong rounded-2xl p-5 flex items-center gap-4 hover-lift">
      <div className="size-12 rounded-xl bg-accent grid place-items-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
        <div className="font-display font-bold text-xl sm:text-2xl truncate mt-0.5">
          {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
        </div>
      </div>
    </div>
  );
}

function NewRequestForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const user = useAuthUser();
  const loans = useStore((s) => s.loans);
  const fees = useStore((s) => s.fees);
  const assets = useStore((s) => s.assets);
  const hostel = useStore((s) => s.hostel);
  const sports = useStore((s) => s.sports);
  const data = { loans, fees, assets, hostel, sports };
  const allRequests = useStore((s) => s.requests);
  const [reason, setReason] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("graduation");
  const [submitting, setSubmitting] = useState(false);

  const myRequests = useMemo(
    () =>
      allRequests
        .filter((r) => r.studentId === user?.id)
        .slice()
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)),
    [allRequests, user],
  );

  const hasApprovedGraduation = useMemo(
    () => myRequests.some((r) => r.requestType === "graduation" && r.overallStatus === "approved"),
    [myRequests],
  );

  const hasPendingGraduation = useMemo(
    () => myRequests.some((r) => r.requestType === "graduation" && r.overallStatus === "pending"),
    [myRequests],
  );

  const hasPendingSameType = useMemo(
    () => myRequests.some((r) => r.requestType === requestType && r.overallStatus === "pending"),
    [myRequests, requestType],
  );

  const isBlocked =
    (requestType === "graduation" && (hasApprovedGraduation || hasPendingGraduation)) ||
    (requestType !== "graduation" && hasPendingSameType);

  const routedDepts = REQUEST_TYPE_DEPARTMENTS[requestType];
  const previewEvals = useMemo(
    () => (user ? routedDepts.map((d) => evaluateDepartment(d, user.id, data)) : []),
    [requestType, user, data, routedDepts],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (requestType === "graduation") {
      if (hasApprovedGraduation) {
        return toast.error("You already possess an approved Graduation Clearance Certificate. A new Graduation Clearance request is not required.");
      }
      if (hasPendingGraduation) {
        return toast.error("You already have an active Graduation Clearance request in progress.");
      }
    } else {
      if (hasPendingSameType) {
        return toast.error(`You already have a pending ${REQUEST_TYPE_LABEL[requestType]} in progress.`);
      }
    }

    const trimmed = reason.trim();
    if (trimmed.length < 10) return toast.error("Please provide a reason (min 10 characters)");
    if (trimmed.length > 500) return toast.error("Reason is too long (max 500 characters)");
    setSubmitting(true);
    try {
      const req = await store.createRequest({
        studentId: user.id,
        studentName: user.name,
        matricNo: user.matricNo ?? "N/A",
        program: user.program ?? "N/A",
        faculty: user.faculty ?? "N/A",
        level: user.level ?? "N/A",
        email: user.email,
        reason: trimmed,
        requestType,
      });
      toast.success(`Request ${req.clearance_id} submitted successfully`);
      setReason("");
      onSubmitted?.();
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onSubmit={submit}
      className="glass-strong rounded-2xl p-6 max-w-3xl space-y-6 border border-border/40"
    >
      <div>
        <h3 className="font-display font-semibold text-xl">New Clearance Request</h3>
        <p className="text-sm text-muted-foreground mt-1">Pick a request type — only the relevant departments will review it.</p>
      </div>

      {requestType === "graduation" && hasApprovedGraduation && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 text-warning px-4 py-3 text-sm animate-fade-in font-semibold">
          You already possess an approved Graduation Clearance Certificate. A new Graduation Clearance request is not required.
        </div>
      )}

      {requestType === "graduation" && hasPendingGraduation && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 text-warning px-4 py-3 text-sm animate-fade-in font-semibold">
          You already have an active Graduation Clearance request in progress.
        </div>
      )}

      {requestType !== "graduation" && hasPendingSameType && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 text-warning px-4 py-3 text-sm animate-fade-in font-semibold">
          You already have a pending {REQUEST_TYPE_LABEL[requestType]} in progress.
        </div>
      )}

      <div className="space-y-2">
        <Label>Request type</Label>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {REQUEST_TYPES.map((rt) => {
            const active = rt === requestType;
            return (
              <button
                type="button"
                key={rt}
                onClick={() => setRequestType(rt)}
                className={`text-left rounded-xl border p-3 transition-all ${active ? "border-primary bg-primary/5 shadow" : "hover:bg-muted/40"}`}
              >
                <div className="font-bold text-sm">{REQUEST_TYPE_LABEL[rt]}</div>
                <div className="text-[10px] text-muted-foreground mt-1 font-semibold leading-normal">
                  Routes to: {REQUEST_TYPE_DEPARTMENTS[rt].join(", ")}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Full Name" value={user?.name ?? ""} />
        <Field label="Matric No." value={user?.matricNo ?? ""} />
        <Field label="Program" value={user?.program ?? ""} />
        <Field label="Faculty" value={user?.faculty ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Reason for clearance</Label>
        <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Final year graduation clearance" maxLength={500} />
        <div className="text-xs text-muted-foreground text-right">{reason.length}/500</div>
      </div>

      {user && previewEvals.length > 0 && (
        <div className="rounded-xl border bg-card/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-4 text-primary animate-pulse" />
            <div className="text-sm font-semibold">Pre-submission eligibility check</div>
          </div>
          <div className="space-y-1.5">
            {previewEvals.map((e) => (
              <div key={e.department} className="flex items-center justify-between text-xs font-semibold">
                <span className="font-medium">{e.department}</span>
                <span className={e.eligible ? "text-success font-black" : "text-destructive font-black"}>
                  {e.eligible ? "Eligible" : `${e.outstandingCount} outstanding · ${NGN(e.totalCost)}`}
                </span>
              </div>
            ))}
          </div>
          {previewEvals.some((e) => !e.eligible) && (
            <p className="text-[11px] text-muted-foreground mt-3 font-semibold">
              You can still submit — departments make the final decision based on their records and your remarks.
            </p>
          )}
        </div>
      )}

      <Button type="submit" disabled={submitting || isBlocked} className="gradient-bg text-primary-foreground shadow-elegant">
        <Send className="size-4 mr-2" /> {submitting ? "Submitting…" : "Submit request"}
      </Button>
    </motion.form>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1 font-semibold">{label}</div>
      <div className="px-3 py-2 rounded-lg border bg-muted/40 text-sm font-bold">{value}</div>
    </div>
  );
}

function History({ list, onSelectEvent }: { list: ClearanceRequest[]; onSelectEvent: (evt: AuditEvent) => void }) {
  if (!list.length) return <Empty />;
  const active = list[0]; // Chronological activity log for the latest request

  // Mathematically collect all chronological audit logs for the request
  const auditEvents = useMemo((): AuditEvent[] => {
    if (!active) return [];
    const events: AuditEvent[] = [];

    // 1. Submitted At
    events.push({
      time: new Date(active.submittedAt),
      title: "Clearance Request Initialized",
      body: `Routed clearance type: "${REQUEST_TYPE_LABEL[active.requestType]}". Reason: "${active.reason}"`,
      icon: <Send className="size-3 text-primary-foreground" />,
      actor: active.studentName,
      status: "info"
    });

    // 2. Department approvals / rejections
    active.departments.forEach((d) => {
      if (!d.reviewedAt) return;
      const isApproved = d.status === "approved";
      events.push({
        time: new Date(d.reviewedAt),
        title: `${d.department} Department Review`,
        body: isApproved
          ? `Department clearance CLEARED. Remarks: "${d.remarks || 'Clearance successfully cleared'}"`
          : `Department clearance REJECTED. Remarks: "${d.remarks || 'Outstanding obligations require attention'}"`,
        icon: isApproved
          ? <CheckCircle2 className="size-3 text-primary-foreground animate-pulse" />
          : <XCircle className="size-3 text-primary-foreground" />,
        actor: d.reviewedBy || `${d.department} Reviewing Officer`,
        status: isApproved ? "approved" : "rejected"
      });
    });

    // 3. Certificate generation
    if (active.overallStatus === "approved") {
      const times = active.departments
        .map((d) => d.reviewedAt)
        .filter(Boolean)
        .map((t) => new Date(t!).getTime());
      const maxTime = times.length > 0 ? Math.max(...times) : new Date(active.submittedAt).getTime();
      events.push({
        time: new Date(maxTime),
        title: "E-Clearance Certificate Issued",
        body: "All department approvals successfully registered. Verified digital e-clearance certificate is fully online and printable.",
        icon: <BadgeCheck className="size-3 text-primary-foreground animate-pulse" />,
        actor: "Office of the Registrar",
        status: "approved"
      });
    }

    // Sort chronologically ascending
    return events.sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [active]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Activity Timeline Card */}
      <div className="glass-strong rounded-2xl p-6 border border-border/40 space-y-6 shadow-sm">
        <div>
          <h3 className="font-display font-semibold text-base sm:text-lg flex items-center gap-2">
            <Activity className="size-5 text-primary animate-pulse" /> E-Clearance Audit Trail
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">Chronological audit timeline tracking request status, officer remarks, and department approvals</p>
        </div>

        <div className="relative pl-6 border-l border-border/60 ml-4 space-y-6 my-2">
          {auditEvents.map((evt, idx) => {
            let bgClass = "bg-muted border border-border/40";
            if (evt.status === "approved") bgClass = "bg-success text-success-foreground";
            if (evt.status === "rejected") bgClass = "bg-destructive text-destructive-foreground";
            if (evt.status === "info") bgClass = "bg-primary text-primary-foreground";
            return (
              <div
                key={idx}
                onClick={() => onSelectEvent(evt)}
                className="relative animate-fade-in cursor-pointer hover:opacity-85 transition-opacity"
              >
                <div className={cn("absolute -left-9 top-0.5 size-6 rounded-full grid place-items-center shadow-md", bgClass)}>
                  {evt.icon}
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-mono font-semibold flex items-center gap-2">
                    <span>{evt.actor}</span>
                    <span>&middot;</span>
                    <span>{evt.time.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                  <h4 className="font-bold text-sm text-foreground">{evt.title}</h4>
                  <p className="text-xs text-muted-foreground font-medium max-w-2xl leading-normal">{evt.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historical Submissions Table */}
      <div className="glass-strong rounded-2xl overflow-hidden border border-border/40">
        <div className="p-5 border-b border-border/40">
          <h4 className="font-display font-bold text-sm sm:text-base">Historical Submissions</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Clearance ID</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Progress</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const approved = r.departments.filter((d) => d.status === "approved").length;
                return (
                  <tr key={r.id} className="border-t row-hover-premium font-medium">
                    <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">{r.clearanceId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{REQUEST_TYPE_LABEL[r.requestType]}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(r.submittedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{approved}/{r.departments.length}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.overallStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function Certificate({ req }: { req: ClearanceRequest }) {
  if (!req) return <CertificateEmpty />;
  const verifyUrl = typeof window !== "undefined" ? `${window.location.origin}/verify?id=${req.clearanceId}` : `/verify?id=${req.clearanceId}`;
  const printIt = async () => {
    try {
      await store.logActivity(req.studentName, "downloaded certificate", req.clearanceId);
    } catch (err) {
      console.error("Failed to log certificate download activity", err);
    }
    window.print();
  };
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 animate-fade-in"
    >
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button onClick={printIt} className="gradient-bg text-primary-foreground shadow-elegant rounded-xl"><Download className="size-4 mr-2" /> Download / Print Certificate</Button>
        <Button variant="outline" asChild className="rounded-xl"><Link to="/verify" search={{ id: req.clearanceId }}>Verify Online</Link></Button>
      </div>
      <div className="bg-white text-[oklch(0.18_0.04_265)] rounded-3xl p-10 sm:p-14 shadow-elegant border-8 border-double border-primary/20 relative overflow-hidden print:shadow-none printable-certificate">
        {/* Subtle Watermark Security Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, currentColor 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        
        {/* Centered Huge Watermark Icon */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02]">
          <ShieldCheck className="size-[280px] text-primary" />
        </div>

        <div className="relative border border-primary/10 p-6 sm:p-8 rounded-2xl h-full">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="size-14 rounded-2xl gradient-bg grid place-items-center shadow-elegant">
                <BadgeCheck className="size-7 text-white animate-pulse" />
              </div>
              <div>
                <div className="font-display font-bold text-2xl tracking-tight text-foreground">University E-Clearance</div>
                <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{REQUEST_TYPE_LABEL[req.requestType] ?? "N/A"}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Clearance ID</div>
              <div className="font-mono font-bold text-base text-foreground bg-muted/30 px-2.5 py-1 rounded-lg mt-0.5">{req.clearanceId ?? "N/A"}</div>
            </div>
          </div>

          <div className="text-center mt-12 space-y-4">
            <div className="text-xs uppercase tracking-[0.40em] text-primary font-extrabold">Official Certificate of Clearance</div>
            <h1 className="font-display text-4xl sm:text-5xl font-black text-foreground tracking-tight leading-none pt-2">{req.studentName ?? "N/A"}</h1>
            <p className="max-w-xl mx-auto text-xs sm:text-sm text-muted-foreground font-medium pt-2 leading-relaxed">
              has successfully fulfilled all academic, financial, administrative, and sports obligations across all required university departments and is hereby declared fully cleared.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-12 text-xs border-y border-border/40 py-5">
            <Info label="Matric Number" value={req.matricNo ?? "N/A"} />
            <Info label="Program" value={req.program ?? "N/A"} />
            <Info label="Faculty" value={req.faculty ?? "N/A"} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-8">
            {(req.departments ?? []).map((d) => (
              <div key={d.department} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/5 text-success border border-success/20 text-xs font-semibold shadow-xs">
                <CheckCircle2 className="size-3.5 text-success/80 shrink-0" /> {d.department ?? "N/A"}
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col sm:flex-row items-end justify-between gap-6">
            <div className="text-xs text-muted-foreground font-medium">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Date of Issuance</span>
              <div className="font-semibold text-sm text-foreground mt-0.5">
                {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString(undefined, { dateStyle: "long" }) : "N/A"}
              </div>
              <div className="mt-8 pt-4 border-t border-foreground/30 w-56 text-center">
                <div className="font-serif italic text-primary/75 text-base font-bold select-none mb-0.5">Registrar</div>
                <div className="font-display font-bold text-[10px] tracking-widest uppercase text-muted-foreground">Office of the Registrar</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5 shrink-0 bg-white p-2 rounded-xl border shadow-xs relative">
              <QrCode value={verifyUrl} size={110} />
              <div className="text-[9px] text-muted-foreground flex items-center gap-1 font-semibold uppercase tracking-wider"><QrIcon className="size-2.5" /> Scan to verify</div>
              
              {/* University Seal overlay badge */}
              <div className="absolute -top-6 -right-6 size-12 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center text-primary/70 rotate-12 shadow-xs font-display font-extrabold text-[6px] uppercase tracking-wider text-center p-1 select-none">
                Seal
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CertificateEmpty() {
  return (
    <div className="glass-strong rounded-3xl p-12 text-center select-none border border-border/20">
      <BadgeCheck className="size-12 mx-auto text-muted-foreground/40 mb-3 animate-pulse text-primary" />
      <h3 className="font-display font-semibold text-lg">No Active Certificate</h3>
      <p className="text-muted-foreground text-sm mt-1 font-medium max-w-md mx-auto">
        Your digital e-clearance certificate will be generated and displayed here once your clearance request is fully approved by all required departments.
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">{label}</div>
      <div className="font-bold mt-1 text-sm sm:text-base text-foreground">{value}</div>
    </div>
  );
}

function EligibilityDetailDialog({ open, onClose, department, studentId }: { open: boolean; onClose: () => void; department: Department | null; studentId: string }) {
  if (!department) return null;

  const loans = useStore((s) => s.loans);
  const fees = useStore((s) => s.fees);
  const assets = useStore((s) => s.assets);
  const hostel = useStore((s) => s.hostel);
  const sports = useStore((s) => s.sports);
  const data = { loans, fees, assets, hostel, sports };

  const evalResult = useMemo(
    () => evaluateDepartment(department, studentId, data),
    [department, studentId, data]
  );

  const stepsToClear = {
    Finance: "Please visit the Bursar's office with your bank tellers/receipts to resolve outstanding fees, or make a payment online through the university payment portal.",
    Library: "Please return all outstanding borrowed books to the Main Library. Accrued overdue fines must be paid at the library desk before clearance.",
    ICT: "All assigned university ICT assets (laptops, accessories, network keys) must be returned to the ICT Center helpdesk in working condition.",
    Hostel: "Ensure your hostel checkout form is signed by the porter and submit it. Outstanding room damage assessments must be paid.",
    Registrar: "The Registrar's Office reviews academic credits, transcript records, and graduation requirements. Verify with your department coordinator.",
    Sports: "Return any borrowed sports kit, jerseys, or equipment to the Sports Complex equipment store."
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{department} Department Clearance</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className={cn(
            "p-4 rounded-xl border flex items-start gap-3",
            evalResult.eligible ? "bg-success/5 border-success/30 text-success" : "bg-destructive/5 border-destructive/30 text-destructive"
          )}>
            {evalResult.eligible ? (
              <CheckCircle2 className="size-6 text-success shrink-0" />
            ) : (
              <AlertTriangle className="size-6 text-destructive shrink-0" />
            )}
            <div>
              <div className="font-bold text-sm">
                Status: {evalResult.eligible ? "Eligible for Approval" : "Clearance Blocked"}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{evalResult.summary}</p>
            </div>
          </div>

          {evalResult.obligations.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Records on File</div>
              <ul className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                {evalResult.obligations.map((o, idx) => (
                  <li
                    key={idx}
                    className={cn(
                      "flex items-center justify-between text-xs p-2.5 rounded-lg border font-semibold",
                      o.blocking ? "bg-destructive/5 border-destructive/20 text-destructive" : "bg-success/5 border-success/20 text-success"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate">{o.label}</div>
                      {o.detail && <div className="text-[10px] text-muted-foreground font-medium truncate mt-0.5">{o.detail}</div>}
                    </div>
                    {o.cost > 0 && <span className="font-mono ml-2 shrink-0">{NGN(o.cost)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">How to Clear</div>
            <p className="text-xs leading-relaxed font-semibold text-foreground/80">
              {stepsToClear[department as keyof typeof stepsToClear] || "Please visit the department's main administrative desk to verify your records."}
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={onClose} className="w-full gradient-bg text-primary-foreground shadow-elegant">
              Close Details
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TimelineEventDialog({ open, onClose, event }: { open: boolean; onClose: () => void; event: AuditEvent | null }) {
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Timeline Event Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Event / Action</div>
              <div className="text-sm font-bold text-foreground mt-0.5">{event.title}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Performed By (Actor)</div>
              <div className="text-sm font-bold text-foreground mt-0.5">{event.actor}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Timestamp</div>
              <div className="text-sm font-semibold text-muted-foreground font-mono mt-0.5">
                {event.time.toLocaleString(undefined, { dateStyle: "long", timeStyle: "medium" })}
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Status Type</span>
              <StatusBadge status={event.status === "info" ? "pending" : event.status} />
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Action Remarks / Details</div>
            <p className="text-xs leading-normal p-3 rounded-lg border bg-card italic font-medium">
              &ldquo;{event.body}&rdquo;
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose} className="w-full gradient-bg text-primary-foreground shadow-elegant">
              Close Event
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
