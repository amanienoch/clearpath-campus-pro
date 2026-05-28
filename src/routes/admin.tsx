import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  LayoutDashboard, Users, BadgeCheck, FileCheck2, Clock, XCircle, TrendingUp,
  Pencil, Trash2, Plus, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — E-Clearance" }] }),
  component: AdminPage,
});

function AdminPage() {
  const requests = useStore((s) => s.requests);
  const users = useStore((s) => s.users);
  const activity = useStore((s) => s.activity);

  const stats = useMemo(() => ({
    total: requests.length,
    approved: requests.filter((r) => r.overallStatus === "approved").length,
    pending: requests.filter((r) => r.overallStatus === "pending").length,
    rejected: requests.filter((r) => r.overallStatus === "rejected").length,
  }), [requests]);

  const deptData = DEPARTMENTS.map((d) => {
    const items = requests.flatMap((r) => r.departments.filter((x) => x.department === d));
    return {
      name: d,
      approved: items.filter((x) => x.status === "approved").length,
      pending: items.filter((x) => x.status === "pending").length,
      rejected: items.filter((x) => x.status === "rejected").length,
    };
  });

  const trend = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const month = d.toLocaleString("default", { month: "short" });
    const count = requests.filter((r) => {
      const rd = new Date(r.submittedAt);
      return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear();
    }).length;
    return { month, requests: count };
  });

  const pieData = [
    { name: "Approved", value: stats.approved, color: "oklch(0.65 0.18 155)" },
    { name: "Pending", value: stats.pending, color: "oklch(0.78 0.16 75)" },
    { name: "Rejected", value: stats.rejected, color: "oklch(0.6 0.23 27)" },
  ];

  return (
    <AppShell
      title="Administrator"
      role="admin"
      nav={[
        { to: "/admin", label: "Overview", icon: <LayoutDashboard className="size-4" /> },
        { to: "/verify", label: "Verify Certificate", icon: <BadgeCheck className="size-4" /> },
      ]}
    >
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="glass rounded-xl p-1 flex-wrap h-auto">
          <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg">Analytics</TabsTrigger>
          <TabsTrigger value="users" className="rounded-lg">Users</TabsTrigger>
          <TabsTrigger value="activity" className="rounded-lg">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BigStat icon={<FileCheck2 className="size-6" />} label="Total Requests" value={stats.total} />
            <BigStat icon={<BadgeCheck className="size-6" />} label="Approved" value={stats.approved} tone="success" />
            <BigStat icon={<Clock className="size-6" />} label="Pending" value={stats.pending} tone="warning" />
            <BigStat icon={<XCircle className="size-6" />} label="Rejected" value={stats.rejected} tone="destructive" />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-strong rounded-2xl p-6">
              <h3 className="font-display font-semibold text-lg mb-4">Department performance</h3>
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
            <div className="glass-strong rounded-2xl p-6">
              <h3 className="font-display font-semibold text-lg mb-4">Overall status</h3>
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

          <div className="glass-strong rounded-2xl overflow-hidden">
            <div className="p-5 border-b">
              <h3 className="font-display font-semibold text-lg">Recent requests</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Clearance ID</th>
                    <th className="px-4 py-3 font-medium">Submitted</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No requests yet.</td></tr>
                  ) : requests.slice(0, 6).map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.studentName}</div>
                        <div className="text-xs text-muted-foreground">{r.matricNo}</div>
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
          <div className="glass-strong rounded-2xl p-6">
            <h3 className="font-display font-semibold text-lg mb-4">Monthly request trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="requests" stroke="oklch(0.52 0.22 265)" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {deptData.map((d) => {
              const totalD = d.approved + d.pending + d.rejected;
              const rate = totalD ? Math.round((d.approved / totalD) * 100) : 0;
              return (
                <div key={d.name} className="glass-strong rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{d.name}</div>
                    <TrendingUp className="size-4 text-primary" />
                  </div>
                  <div className="font-display font-bold text-3xl mt-2">{rate}%</div>
                  <div className="text-xs text-muted-foreground">Approval rate · {totalD} reviews</div>
                  <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full gradient-bg" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="users">
          <UsersTab users={users} />
        </TabsContent>

        <TabsContent value="activity">
          <div className="glass-strong rounded-2xl p-6">
            <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
              <Activity className="size-5 text-primary" /> Activity feed
            </h3>
            {activity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No activity yet. Sign in/out and review requests to populate.</p>
            ) : (
              <ol className="space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 p-3 rounded-xl border bg-card/50">
                    <div className="size-9 rounded-full gradient-bg grid place-items-center text-primary-foreground text-xs font-bold">
                      {a.actor.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm"><span className="font-semibold">{a.actor}</span> {a.action} {a.target && <span className="font-mono text-xs text-muted-foreground">· {a.target}</span>}</div>
                      <div className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</div>
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

function BigStat({ icon, label, value, trend, tone }: { icon: React.ReactNode; label: string; value: number; trend?: string; tone?: "success" | "warning" | "destructive" }) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className={`size-11 rounded-xl bg-accent grid place-items-center ${toneCls}`}>{icon}</div>
        {trend && <span className="text-xs font-medium text-success">{trend}</span>}
      </div>
      <div className="font-display font-bold text-3xl mt-3">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function UsersTab({ users }: { users: User[] }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);

  const startNew = () => {
    setEdit({ id: crypto.randomUUID(), name: "", email: "", role: "student", password: "" });
    setOpen(true);
  };
  const startEdit = (u: User) => { setEdit(u); setOpen(true); };
  const del = (u: User) => {
    if (confirm(`Delete ${u.name}?`)) {
      store.deleteUser(u.id);
      toast.success("User deleted");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-display font-semibold text-xl flex items-center gap-2"><Users className="size-5 text-primary" /> User management</h3>
          <p className="text-sm text-muted-foreground">Create, edit and remove users across all roles.</p>
        </div>
        <Button onClick={startNew} className="gradient-bg text-primary-foreground"><Plus className="size-4 mr-1" /> New user</Button>
      </div>
      <div className="glass-strong rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.department ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(u)}><Pencil className="size-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(u)}><Trash2 className="size-3.5 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UserDialog open={open} onClose={() => setOpen(false)} user={edit} />
    </div>
  );
}

function UserDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user: User | null }) {
  const [draft, setDraft] = useState<User | null>(user);
  // sync when opening
  if (open && draft?.id !== user?.id) setDraft(user);

  if (!draft) return null;
  const save = () => {
    if (!draft.name || !draft.email || !draft.password) return toast.error("All fields are required");
    store.upsertUser(draft);
    toast.success("User saved");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">{user?.name ? "Edit user" : "New user"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Password</Label><Input value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v as Role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="gradient-bg text-primary-foreground" onClick={save}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
