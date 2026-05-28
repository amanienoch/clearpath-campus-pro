import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuthUser, useStore, store } from "@/lib/store";
import { DEPARTMENTS, ClearanceRequest } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { QrCode } from "@/components/QrCode";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LayoutDashboard, FileText, History as HistoryIcon, BadgeCheck, QrCode as QrIcon, Send, CheckCircle2, Clock, XCircle, Download } from "lucide-react";
import { toast } from "sonner";

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
  const latestApproved = useMemo(() => myRequests.find((r) => r.overallStatus === "approved"), [myRequests]);
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
            <NewRequestForm hasPending={hasPending} onSubmitted={() => setTab("overview")} />
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
  const approved = active?.departments.filter((d) => d.status === "approved").length ?? 0;
  const total = DEPARTMENTS.length;
  const pct = active ? Math.round((approved / total) * 100) : 0;
  return (
    <div className="relative overflow-hidden rounded-3xl hero-bg p-8 sm:p-10 text-primary-foreground shadow-elegant">
      <div className="absolute -top-10 -right-10 size-64 bg-white/10 rounded-full blur-3xl" />
      <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="text-sm/none text-white/80 mb-3">Welcome back,</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold">{user}</h2>
          <p className="mt-2 text-white/85 max-w-xl">
            {active
              ? `Your clearance is ${pct}% complete. Track each department in real time below.`
              : "You don't have any active clearance request yet. Start one in a few clicks."}
          </p>
        </div>
        {active && (
          <div className="text-right">
            <div className="text-xs text-white/75">Clearance ID</div>
            <div className="font-display font-bold text-2xl mt-1">{active.clearanceId}</div>
            <div className="mt-3 w-56 h-2 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-white transition-all" style={{ width: `${pct}%` }} />
            </div>
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
  const stats = {
    approved: req.departments.filter((d) => d.status === "approved").length,
    pending: req.departments.filter((d) => d.status === "pending").length,
    rejected: req.departments.filter((d) => d.status === "rejected").length,
  };
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={<CheckCircle2 className="size-5 text-success" />} label="Approved" value={stats.approved} />
        <Stat icon={<Clock className="size-5 text-warning" />} label="Pending" value={stats.pending} />
        <Stat icon={<XCircle className="size-5 text-destructive" />} label="Rejected" value={stats.rejected} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-strong rounded-2xl p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Department Status</h3>
          <div className="space-y-3">
            {req.departments.map((d) => (
              <div key={d.department} className="flex items-center justify-between p-3 rounded-xl border bg-card/50">
                <div>
                  <div className="font-medium">{d.department}</div>
                  {d.remarks && <div className="text-xs text-muted-foreground mt-0.5">{d.remarks}</div>}
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        </div>
        <div className="glass-strong rounded-2xl p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Approval Timeline</h3>
          <ol className="relative border-l-2 border-border ml-2 space-y-5">
            <Timeline event="Request submitted" at={req.submittedAt} done />
            {req.departments
              .filter((d) => d.reviewedAt)
              .sort((a, b) => (a.reviewedAt! < b.reviewedAt! ? -1 : 1))
              .map((d) => (
                <Timeline
                  key={d.department}
                  event={`${d.department} ${d.status}`}
                  at={d.reviewedAt!}
                  done={d.status === "approved"}
                  bad={d.status === "rejected"}
                />
              ))}
            {req.overallStatus === "approved" && (
              <Timeline event="Clearance certificate issued" at={new Date().toISOString()} done celebrate />
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}

function Timeline({ event, at, done, bad, celebrate }: { event: string; at: string; done?: boolean; bad?: boolean; celebrate?: boolean }) {
  return (
    <li className="ml-4">
      <div className={`absolute -left-[7px] size-3 rounded-full ${bad ? "bg-destructive" : done ? "bg-success" : "bg-muted-foreground"} ring-4 ring-background`} />
      <div className="font-medium text-sm">{event} {celebrate && "🎉"}</div>
      <div className="text-xs text-muted-foreground">{new Date(at).toLocaleString()}</div>
    </li>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="glass-strong rounded-2xl p-5 flex items-center gap-4">
      <div className="size-12 rounded-xl bg-accent grid place-items-center">{icon}</div>
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="font-display font-bold text-2xl">{value}</div>
      </div>
    </div>
  );
}

function NewRequestForm({ onSubmitted, hasPending }: { onSubmitted?: () => void; hasPending?: boolean }) {
  const user = useAuthUser();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (hasPending) return toast.error("You already have a pending clearance request");
    const trimmed = reason.trim();
    if (trimmed.length < 10) return toast.error("Please provide a reason (min 10 characters)");
    if (trimmed.length > 500) return toast.error("Reason is too long (max 500 characters)");
    setSubmitting(true);
    try {
      const req = store.createRequest({
        studentId: user.id,
        studentName: user.name,
        matricNo: user.matricNo ?? "N/A",
        program: user.program ?? "N/A",
        faculty: user.faculty ?? "N/A",
        level: user.level ?? "N/A",
        email: user.email,
        reason: trimmed,
      });
      toast.success(`Request ${req.clearanceId} submitted successfully`);
      setReason("");
      onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass-strong rounded-2xl p-6 max-w-2xl space-y-5">
      <div>
        <h3 className="font-display font-semibold text-xl">New Clearance Request</h3>
        <p className="text-sm text-muted-foreground mt-1">Your request will be routed to all 6 departments for review.</p>
      </div>
      {hasPending && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 text-warning px-4 py-3 text-sm">
          You already have a pending clearance request. Please wait for it to be completed before submitting another.
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Full Name" value={user?.name ?? ""} />
        <Field label="Matric No." value={user?.matricNo ?? ""} />
        <Field label="Program" value={user?.program ?? ""} />
        <Field label="Faculty" value={user?.faculty ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reason">Reason for clearance</Label>
        <Textarea id="reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Final year graduation clearance" maxLength={500} />
        <div className="text-xs text-muted-foreground text-right">{reason.length}/500</div>
      </div>
      <Button type="submit" disabled={submitting || hasPending} className="gradient-bg text-primary-foreground shadow-elegant">
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
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Clearance ID</th>
            <th className="px-4 py-3 font-medium">Submitted</th>
            <th className="px-4 py-3 font-medium">Reason</th>
            <th className="px-4 py-3 font-medium">Progress</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const approved = r.departments.filter((d) => d.status === "approved").length;
            return (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-mono font-semibold">{r.clearanceId}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.submittedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">{r.reason}</td>
                <td className="px-4 py-3">{approved}/{DEPARTMENTS.length}</td>
                <td className="px-4 py-3"><StatusBadge status={r.overallStatus} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
      <div className="bg-white text-[oklch(0.18_0.04_265)] rounded-3xl p-10 sm:p-14 shadow-elegant border-4 border-primary/20 relative overflow-hidden print:shadow-none">
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, currentColor 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-14 rounded-2xl gradient-bg grid place-items-center">
                <BadgeCheck className="size-7 text-white" />
              </div>
              <div>
                <div className="font-display font-bold text-2xl">University E-Clearance</div>
                <div className="text-xs text-muted-foreground">Office of the Registrar</div>
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
