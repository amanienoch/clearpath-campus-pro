import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get("search");
    if (searchParam) {
      setQ(searchParam);
      const newUrl = window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
  }, [window.location.search]);

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
          />
          <StatCard
            icon={<Clock className="size-5 text-warning" />}
            label="Pending"
            value={stats.pending}
            onClick={() => setFilter("pending")}
            active={filter === "pending"}
          />
          <StatCard
            icon={<XCircle className="size-5 text-destructive" />}
            label="Rejected"
            value={stats.rejected}
            onClick={() => setFilter("rejected")}
            active={filter === "rejected"}
          />
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
            <div className="p-12 text-center select-none">
              <Inbox className="size-12 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="font-display font-semibold text-base sm:text-lg">You're all caught up.</h3>
              <p className="text-sm text-muted-foreground mt-1 font-medium">No pending clearance requests require attention in this department queue.</p>
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

function StatCard({
  icon,
  label,
  value,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left block w-full rounded-2xl transition-all cursor-pointer focus:outline-none",
        active ? "ring-2 ring-primary ring-offset-2 scale-[1.01] shadow-md" : "hover:scale-[1.01]"
      )}
    >
      <div className="glass-strong rounded-2xl p-5 hover-lift animate-fade-up h-full">
        <div className="flex items-center justify-between">
          <div className="size-10 rounded-xl bg-accent grid place-items-center">{icon}</div>
        </div>
        <div className="mt-3 font-display font-bold text-3xl">
          <AnimatedCounter value={value} />
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </button>
  );
}

function ReviewModal({ req, dept, onClose, reviewer }: { req: ClearanceRequest | null; dept?: Department; onClose: () => void; reviewer: string }) {
  const loans = useStore((s) => s.loans);
  const fees = useStore((s) => s.fees);
  const assets = useStore((s) => s.assets);
  const hostel = useStore((s) => s.hostel);
  const sports = useStore((s) => s.sports);
  
  const data = useMemo(() => ({ loans, fees, assets, hostel, sports }), [loans, fees, assets, hostel, sports]);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);

  useEffect(() => {
    if (req && dept) {
      const mine = req.departments.find((d) => d.department === dept);
      setRemarks(mine?.remarks ?? "");
    }
  }, [req, dept]);

  const evalResult = useMemo(
    () => (req && dept ? evaluateDepartment(dept, req.studentId, data) : null),
    [req, dept, data],
  );

  const mine = useMemo(() => {
    if (!req || !dept) return null;
    return req.departments.find((d) => d.department === dept) ?? null;
  }, [req, dept]);

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

              {evalResult && (
                <div className={`p-4 rounded-xl border ${evalResult.eligible ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {evalResult.eligible ? <Sparkles className="size-4 text-success" /> : <AlertTriangle className="size-4 text-destructive" />}
                      <div className="font-semibold text-sm">
                        System Recommendation: {evalResult.eligible ? "Eligible for Approval" : "Action Required"}
                      </div>
                    </div>
                    {evalResult.totalCost > 0 && (
                      <div className="text-xs font-mono px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
                        {NGN(evalResult.totalCost)} outstanding
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{evalResult.summary}</p>
                  {evalResult.obligations.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {evalResult.obligations.map((o, i) => (
                        <li key={i} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border ${o.blocking ? "bg-destructive/10 border-destructive/20" : "bg-success/10 border-success/20"}`}>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{o.label}</div>
                            {o.detail && <div className="text-muted-foreground truncate">{o.detail}</div>}
                          </div>
                          {o.cost > 0 && <div className="font-mono ml-2 shrink-0">{NGN(o.cost)}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-3 italic">
                    You retain final approval authority — use this as a guideline alongside your records.
                  </p>
                </div>
              )}

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
          </>
        ) : (
          <div className="py-6 text-center text-muted-foreground">No request selected</div>
        )}
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
