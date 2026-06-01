import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuthUser, useStore, store } from "@/lib/store";
import { ClearanceRequest, ClearanceStatus, Department, REQUEST_TYPE_LABEL } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LayoutDashboard, Search, CheckCircle2, Clock, XCircle, Inbox, BadgeCheck, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { evaluateDepartment, NGN } from "@/lib/eligibility";

export const Route = createFileRoute("/department")({
  head: () => ({ meta: [{ title: "Department Dashboard — E-Clearance" }] }),
  component: DepartmentPage,
});

function DepartmentPage() {
  const user = useAuthUser();
  const dept = user?.department as Department | undefined;
  const all = useStore((s) => s.requests);

  const requests = useMemo(() => {
    if (!dept) return [];
    return all.filter((r) => r.departments.some((d) => d.department === dept));
  }, [all, dept]);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | ClearanceStatus>("all");

  const myStatusOf = (r: ClearanceRequest) =>
    r.departments.find((d) => d.department === dept)!.status;

  const filtered = requests.filter((r) => {
    const matchesQ = !q || [r.studentName, r.matricNo, r.clearanceId].some((s) => s.toLowerCase().includes(q.toLowerCase()));
    const matchesF = filter === "all" || myStatusOf(r) === filter;
    return matchesQ && matchesF;
  });

  const stats = {
    total: requests.length,
    approved: requests.filter((r) => myStatusOf(r) === "approved").length,
    pending: requests.filter((r) => myStatusOf(r) === "pending").length,
    rejected: requests.filter((r) => myStatusOf(r) === "rejected").length,
  };

  const [selected, setSelected] = useState<ClearanceRequest | null>(null);

  return (
    <AppShell
      title={`${dept ?? "Department"} Clearance`}
      role="department"
      nav={[
        { to: "/department", label: "Requests", icon: <LayoutDashboard className="size-4" /> },
        { to: "/verify", label: "Verify Certificate", icon: <BadgeCheck className="size-4" /> },
      ]}
    >
      <div className="space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Inbox className="size-5 text-primary" />} label="Total Requests" value={stats.total} />
          <StatCard icon={<CheckCircle2 className="size-5 text-success" />} label="Approved" value={stats.approved} />
          <StatCard icon={<Clock className="size-5 text-warning" />} label="Pending" value={stats.pending} />
          <StatCard icon={<XCircle className="size-5 text-destructive" />} label="Rejected" value={stats.rejected} />
        </div>

        <div className="glass-strong rounded-2xl p-5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by name, matric no, or clearance ID…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-1 rounded-lg border p-1 bg-background">
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
        </div>

        <div className="glass-strong rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Inbox className="size-12 mx-auto text-muted-foreground/50" />
              <h3 className="font-display font-semibold text-lg mt-4">No requests found</h3>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Clearance ID</th>
                    <th className="px-4 py-3 font-medium">Submitted</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.id} className="border-t row-hover animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{r.studentName}</div>
                        <div className="text-xs text-muted-foreground">{r.matricNo} · {r.program}</div>
                      </td>
                      <td className="px-4 py-3 font-mono">{r.clearanceId}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(r.submittedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><StatusBadge status={myStatusOf(r)} /></td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" className="hover:scale-[1.03] transition-transform" onClick={() => setSelected(r)}>Review</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ReviewModal req={selected} dept={dept} onClose={() => setSelected(null)} reviewer={user?.name ?? "Staff"} />
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="glass-strong rounded-2xl p-5 hover-lift animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="size-10 rounded-xl bg-accent grid place-items-center">{icon}</div>
      </div>
      <div className="mt-3 font-display font-bold text-3xl"><AnimatedCounter value={value} /></div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function ReviewModal({ req, dept, onClose, reviewer }: { req: ClearanceRequest | null; dept?: Department; onClose: () => void; reviewer: string }) {
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  useEffect(() => {
    if (req && dept) {
      const mine = req.departments.find((d) => d.department === dept);
      setRemarks(mine?.remarks ?? "");
    }
  }, [req, dept]);
  if (!req || !dept) return null;
  const mine = req.departments.find((d) => d.department === dept)!;

  const act = (status: "approved" | "rejected") => {
    if (status === "rejected" && remarks.trim().length < 3) {
      return toast.error("Please add remarks before rejecting.");
    }
    if (remarks.length > 500) return toast.error("Remarks too long (max 500 characters)");
    setBusy(status);
    try {
      store.reviewDepartment(req.id, dept, status, remarks.trim() || (status === "approved" ? "Cleared." : ""), reviewer);
      toast.success(`Request ${status}`);
      setRemarks("");
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Review request</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border">
            <Info label="Student" value={req.studentName} />
            <Info label="Matric No" value={req.matricNo} />
            <Info label="Program" value={req.program} />
            <Info label="Faculty" value={req.faculty} />
            <Info label="Clearance ID" value={req.clearanceId} mono />
            <Info label="Submitted" value={new Date(req.submittedAt).toLocaleString()} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Reason</div>
            <div className="text-sm">{req.reason}</div>
          </div>

          <div className="p-4 rounded-xl border bg-card flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Current {dept} status</div>
              <div className="font-medium mt-0.5">{mine.remarks || "Awaiting review"}</div>
            </div>
            <StatusBadge status={mine.status} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" rows={3} placeholder="Add a note for the student…" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={!!busy}>Close</Button>
            <Button variant="destructive" onClick={() => act("rejected")} disabled={!!busy}><XCircle className="size-4 mr-1" /> {busy === "rejected" ? "Rejecting…" : "Reject"}</Button>
            <Button className="gradient-bg text-primary-foreground" onClick={() => act("approved")} disabled={!!busy}><CheckCircle2 className="size-4 mr-1" /> {busy === "approved" ? "Approving…" : "Approve"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-medium text-sm mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
