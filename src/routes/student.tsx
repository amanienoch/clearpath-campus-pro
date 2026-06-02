import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuthUser, useStore, store } from "@/lib/store";
import { ClearanceRequest, REQUEST_TYPES, REQUEST_TYPE_LABEL, REQUEST_TYPE_DEPARTMENTS, RequestType } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { QrCode } from "@/components/QrCode";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LayoutDashboard, FileText, BadgeCheck, QrCode as QrIcon, Send, CheckCircle2, Clock, XCircle, Download, AlertTriangle, Sparkles, BookOpen, Wallet, Laptop, Home, Trophy } from "lucide-react";
import { toast } from "sonner";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { evaluateDepartment, NGN } from "@/lib/eligibility";

export const Route = createFileRoute("/student")({
  head: () => ({ meta: [{ title: "Student Dashboard — E-Clearance" }] }),
  component: StudentPage,
});

function StudentPage() {
  const user = useAuthUser();
  const all = useStore((s) => s.requests);
  const myRequests = useMemo(
    () =>
      all
        .filter((r) => r.studentId === user?.id)
        .slice()
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)),
    [all, user],
  );
  const active = myRequests[0];
  const latestApproved = useMemo(() => active && active.overallStatus === "approved" ? active : undefined, [active]);
  const hasPending = myRequests.some((r) => r.overallStatus === "pending");
  const [tab, setTab] = useState("overview");

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
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="glass rounded-xl p-1 flex-wrap h-auto">
            <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
            <TabsTrigger value="submit" className="rounded-lg">New Request</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg">History</TabsTrigger>
            {latestApproved && (
              <TabsTrigger value="certificate" className="rounded-lg">Certificate</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            {active ? <Overview req={active} /> : <Empty />}
          </TabsContent>
          <TabsContent value="submit" className="mt-6">
            <NewRequestForm onSubmitted={() => setTab("overview")} />
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <History list={myRequests} />
          </TabsContent>
          {latestApproved && (
            <TabsContent value="certificate" className="mt-6">
              <Certificate req={latestApproved} />
            </TabsContent>
          )}
        </Tabs>
      </div>
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
          <p className="mt-2 text-white/85 max-w-xl">
            {active
              ? `Your ${REQUEST_TYPE_LABEL[active.requestType]} is ${pct}% complete across ${total} department${total === 1 ? "" : "s"}.`
              : "You don't have any active clearance request yet. Start one in a few clicks."}
          </p>
        </div>
        {active && (
          <div className="text-right">
            <div className="text-xs text-white/75">Clearance ID</div>
            <div className="font-display font-bold text-2xl mt-1">{active.clearanceId}</div>
            <div className="mt-3 w-56 h-2 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-white transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 text-xs text-white/80 tabular-nums"><AnimatedCounter value={pct} suffix="% complete" /></div>
          </div>
        )}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="glass-strong rounded-3xl p-12 text-center">
      <FileText className="size-12 mx-auto text-muted-foreground/60" />
      <h3 className="font-display font-semibold text-xl mt-4">No active clearance</h3>
      <p className="text-muted-foreground mt-2">Submit a new clearance request to begin the process.</p>
    </div>
  );
}

function Overview({ req }: { req: ClearanceRequest }) {
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

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={<CheckCircle2 className="size-5 text-success" />} label="Departments Approved" value={`${stats.approved}/${req.departments.length}`} />
        <Stat icon={<AlertTriangle className="size-5 text-warning" />} label="Blocking Obligations" value={blocking} />
        <Stat icon={<XCircle className="size-5 text-destructive" />} label="Total Outstanding" value={NGN(totalOutstanding)} />
      </div>

      {totalOutstanding > 0 && (
        <div className="glass-strong rounded-2xl p-6 border border-destructive/20 bg-destructive/5 space-y-4 animate-fade-up">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            <h3 className="font-display font-semibold text-lg">Outstanding Obligations (Attention Required)</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            You have outstanding obligations that are currently blocking your clearance. Please clear these with the respective departments:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Library Obligations */}
            {loans.filter(l => l.studentId === targetStudentId && !l.returned).length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-primary"><BookOpen className="size-4" /> Library Books Overdue</div>
                <ul className="space-y-1.5 text-xs">
                  {loans.filter(l => l.studentId === targetStudentId && !l.returned).map(l => (
                    <li key={l.id} className="flex justify-between border-b pb-1.5 last:border-0 last:pb-0">
                      <span>{l.bookTitle} <span className="text-muted-foreground font-mono">(Due {new Date(l.dueDate).toLocaleDateString()})</span></span>
                      {l.fineAmount > 0 && <span className="font-mono font-semibold text-destructive">{NGN(l.fineAmount)} fine</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Finance Obligations */}
            {fees.filter(f => f.studentId === targetStudentId && f.amountDue > 0).length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-primary"><Wallet className="size-4" /> Finance Fees Outstanding</div>
                <ul className="space-y-1.5 text-xs">
                  {fees.filter(f => f.studentId === targetStudentId && f.amountDue > 0).map(f => (
                    <li key={f.id} className="flex justify-between border-b pb-1.5 last:border-0 last:pb-0 font-medium">
                      <span>{f.item}</span>
                      <span className="font-mono font-semibold text-destructive">{NGN(f.amountDue)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ICT Obligations */}
            {assets.filter(a => a.studentId === targetStudentId && !a.returned).length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-primary"><Laptop className="size-4" /> ICT Assigned Assets</div>
                <ul className="space-y-1.5 text-xs">
                  {assets.filter(a => a.studentId === targetStudentId && !a.returned).map(a => (
                    <li key={a.id} className="flex justify-between border-b pb-1.5 last:border-0 last:pb-0">
                      <span>{a.asset}</span>
                      {a.replacementCost > 0 && <span className="font-mono text-muted-foreground">({NGN(a.replacementCost)} replacement)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Hostel Obligations */}
            {hostel.filter(h => h.studentId === targetStudentId && (!h.checkedOut || h.damageFee > 0)).length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-primary"><Home className="size-4" /> Hostel Checkout Status</div>
                <ul className="space-y-1.5 text-xs">
                  {hostel.filter(h => h.studentId === targetStudentId && (!h.checkedOut || h.damageFee > 0)).map(h => (
                    <li key={h.id} className="flex justify-between border-b pb-1.5 last:border-0 last:pb-0">
                      <span>{h.room} {!h.checkedOut && <span className="text-destructive font-semibold">(Pending checkout)</span>}</span>
                      {h.damageFee > 0 && <span className="font-mono font-semibold text-destructive">{NGN(h.damageFee)} charges</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sports Obligations */}
            {sports.filter(s => s.studentId === targetStudentId && !s.returned).length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-sm text-primary"><Trophy className="size-4" /> Sports Equipment Loans</div>
                <ul className="space-y-1.5 text-xs">
                  {sports.filter(s => s.studentId === targetStudentId && !s.returned).map(s => (
                    <li key={s.id} className="flex justify-between border-b pb-1.5 last:border-0 last:pb-0">
                      <span>{s.equipment}</span>
                      {s.replacementCost > 0 && <span className="font-mono text-muted-foreground">({NGN(s.replacementCost)} replacement)</span>}
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
            <h3 className="font-display font-semibold text-lg">Eligibility Breakdown</h3>
            <p className="text-sm text-muted-foreground">{REQUEST_TYPE_LABEL[req.requestType]} · {req.departments.length} department{req.departments.length === 1 ? "" : "s"}</p>
          </div>
          {stats.rejected > 0 && (
            <div className="text-xs px-3 py-1.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30">
              Action required from your side
            </div>
          )}
        </div>
        <div className="space-y-3">
          {req.departments.map((d, i) => {
            const e = evals[i];
            return (
              <div key={d.department} className="rounded-xl border bg-card/50 p-4 hover-lift animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{d.department}</div>
                      <RecPill rec={e.recommendation} eligible={e.eligible} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{e.summary}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {e.totalCost > 0 && (
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</div>
                        <div className="font-mono font-semibold text-destructive text-sm">{NGN(e.totalCost)}</div>
                      </div>
                    )}
                    <StatusBadge status={d.status} />
                  </div>
                </div>
                {e.obligations.length > 0 && (
                  <ul className="mt-3 grid sm:grid-cols-2 gap-2">
                    {e.obligations.map((o, j) => (
                      <li key={j} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border ${o.blocking ? "bg-destructive/5 border-destructive/20" : "bg-success/5 border-success/20"}`}>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{o.label}</div>
                          {o.detail && <div className="text-muted-foreground truncate">{o.detail}</div>}
                        </div>
                        {o.cost > 0 && <div className="font-mono ml-2 shrink-0">{NGN(o.cost)}</div>}
                      </li>
                    ))}
                  </ul>
                )}
                {d.remarks && (
                  <div className="mt-3 text-xs px-3 py-2 rounded-lg bg-muted/50 border">
                    <span className="font-semibold text-muted-foreground">Officer remarks: </span>{d.remarks}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RecPill({ rec, eligible }: { rec: "approve" | "action_required" | "review"; eligible: boolean }) {
  if (rec === "approve" && eligible)
    return <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 inline-flex items-center gap-1"><Sparkles className="size-3" /> Eligible</span>;
  if (rec === "action_required")
    return <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">Action Required</span>;
  return <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">Manual Review</span>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="glass-strong rounded-2xl p-5 flex items-center gap-4 hover-lift animate-fade-up">
      <div className="size-12 rounded-xl bg-accent grid place-items-center">{icon}</div>
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="font-display font-bold text-2xl truncate">
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
    <form onSubmit={submit} className="glass-strong rounded-2xl p-6 max-w-3xl space-y-6">
      <div>
        <h3 className="font-display font-semibold text-xl">New Clearance Request</h3>
        <p className="text-sm text-muted-foreground mt-1">Pick a request type — only the relevant departments will review it.</p>
      </div>

      {requestType === "graduation" && hasApprovedGraduation && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 text-warning-foreground px-4 py-3 text-sm animate-fade-in">
          You already possess an approved Graduation Clearance Certificate. A new Graduation Clearance request is not required.
        </div>
      )}

      {requestType === "graduation" && hasPendingGraduation && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 text-warning-foreground px-4 py-3 text-sm animate-fade-in">
          You already have an active Graduation Clearance request in progress.
        </div>
      )}

      {requestType !== "graduation" && hasPendingSameType && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 text-warning-foreground px-4 py-3 text-sm animate-fade-in">
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
                <div className="font-medium text-sm">{REQUEST_TYPE_LABEL[rt]}</div>
                <div className="text-xs text-muted-foreground mt-1">
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
            <Sparkles className="size-4 text-primary" />
            <div className="text-sm font-semibold">Pre-submission eligibility check</div>
          </div>
          <div className="space-y-1.5">
            {previewEvals.map((e) => (
              <div key={e.department} className="flex items-center justify-between text-xs">
                <span className="font-medium">{e.department}</span>
                <span className={e.eligible ? "text-success" : "text-destructive"}>
                  {e.eligible ? "Eligible" : `${e.outstandingCount} outstanding · ${NGN(e.totalCost)}`}
                </span>
              </div>
            ))}
          </div>
          {previewEvals.some((e) => !e.eligible) && (
            <p className="text-xs text-muted-foreground mt-3">
              You can still submit — departments make the final decision based on their records and your remarks.
            </p>
          )}
        </div>
      )}

      <Button type="submit" disabled={submitting || isBlocked} className="gradient-bg text-primary-foreground shadow-elegant">
        <Send className="size-4 mr-2" /> {submitting ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="px-3 py-2 rounded-lg border bg-muted/40 text-sm font-medium">{value}</div>
    </div>
  );
}

function History({ list }: { list: ClearanceRequest[] }) {
  if (!list.length) return <Empty />;
  return (
    <div className="glass-strong rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Clearance ID</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const approved = r.departments.filter((d) => d.status === "approved").length;
              return (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">{r.clearanceId}</td>
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
  );
}

function Certificate({ req }: { req: ClearanceRequest }) {
  const verifyUrl = typeof window !== "undefined" ? `${window.location.origin}/verify?id=${req.clearanceId}` : `/verify?id=${req.clearanceId}`;
  const printIt = () => window.print();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button onClick={printIt} className="gradient-bg text-primary-foreground"><Download className="size-4 mr-2" /> Download / Print</Button>
        <Button variant="outline" asChild><Link to="/verify" search={{ id: req.clearanceId }}>Verify online</Link></Button>
      </div>
      <div className="bg-white text-[oklch(0.18_0.04_265)] rounded-3xl p-10 sm:p-14 shadow-elegant border-4 border-primary/20 relative overflow-hidden print:shadow-none printable-certificate">
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, currentColor 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-14 rounded-2xl gradient-bg grid place-items-center">
                <BadgeCheck className="size-7 text-white" />
              </div>
              <div>
                <div className="font-display font-bold text-2xl">University E-Clearance</div>
                <div className="text-xs text-muted-foreground">{REQUEST_TYPE_LABEL[req.requestType]}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Clearance ID</div>
              <div className="font-mono font-bold">{req.clearanceId}</div>
            </div>
          </div>

          <div className="text-center mt-10 space-y-3">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Certificate of Clearance</div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold gradient-text">{req.studentName}</h1>
            <p className="max-w-xl mx-auto text-sm text-muted-foreground">
              has successfully completed clearance from all required university departments and is hereby cleared.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 mt-10 text-sm">
            <Info label="Matric Number" value={req.matricNo} />
            <Info label="Program" value={req.program} />
            <Info label="Faculty" value={req.faculty} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-8">
            {req.departments.map((d) => (
              <div key={d.department} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 text-success border border-success/20 text-sm font-medium">
                <CheckCircle2 className="size-4" /> {d.department}
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-xs text-muted-foreground">
              Issued on {new Date().toLocaleDateString(undefined, { dateStyle: "long" })}
              <div className="mt-4 pt-4 border-t-2 border-foreground/30 w-56 text-center font-display font-semibold">
                Office of the Registrar
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <QrCode value={verifyUrl} size={140} />
              <div className="text-xs text-muted-foreground flex items-center gap-1"><QrIcon className="size-3" /> Scan to verify</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-semibold mt-1">{value}</div>
    </div>
  );
}
