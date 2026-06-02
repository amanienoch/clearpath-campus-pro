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
  Pencil, Trash2, Plus, Activity, BookOpen, Wallet, Laptop, Home, Trophy, Calendar, Check, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
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
          <TabsTrigger value="obligations" className="rounded-lg">Obligations</TabsTrigger>
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
                  ) : requests.slice(0, 6).map((r, i) => (
                    <tr key={r.id} className="border-t row-hover animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
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
            {deptData.map((d, i) => {
              const totalD = d.approved + d.pending + d.rejected;
              const rate = totalD ? Math.round((d.approved / totalD) * 100) : 0;
              return (
                <div key={d.name} className="glass-strong rounded-2xl p-5 hover-lift animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{d.name}</div>
                    <TrendingUp className="size-4 text-primary" />
                  </div>
                  <div className="font-display font-bold text-3xl mt-2"><AnimatedCounter value={rate} suffix="%" /></div>
                  <div className="text-xs text-muted-foreground">Approval rate · {totalD} reviews</div>
                  <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full gradient-bg transition-all duration-700 ease-out" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="users">
          <UsersTab users={users} />
        </TabsContent>

        <TabsContent value="obligations">
          <ObligationsTab users={users} />
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
    <div className="glass-strong rounded-2xl p-5 hover-lift animate-fade-up">
      <div className="flex items-center justify-between">
        <div className={`size-11 rounded-xl bg-accent grid place-items-center ${toneCls} transition-transform group-hover:scale-110`}>{icon}</div>
        {trend && <span className="text-xs font-medium text-success">{trend}</span>}
      </div>
      <div className="font-display font-bold text-3xl mt-3"><AnimatedCounter value={value} /></div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function UsersTab({ users }: { users: User[] }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const startNew = () => {
    setEdit({ id: crypto.randomUUID(), name: "", email: "", role: "student", password: "" });
    setOpen(true);
  };
  const startEdit = (u: User) => {
    setEdit({ ...u, password: "" }); // Reset draft password to empty string
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
        <div className="overflow-x-auto">
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
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.email}</td>
                  <td className="px-4 py-3 capitalize">{u.role}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.department ?? "—"}</td>
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
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={handleDeleteConfirm}>
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
    
    // Validate password
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
          <DialogTitle className="font-display">{isEditing ? "Edit user" : "New user"}</DialogTitle>
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
            <Button className="gradient-bg text-primary-foreground" onClick={save}>Save</Button>
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display font-semibold text-xl flex items-center gap-2">
          <BookOpen className="size-5 text-primary" /> Student Obligations
        </h3>
        <p className="text-sm text-muted-foreground">Manage fees, library loans, equipment, room status, and fines.</p>
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
            <h4 className="font-semibold text-md">Fee Balances</h4>
            <Button onClick={() => {
              setFeeEdit({ studentId: allStudents[0]?.id || "", item: "", amountDue: 0 });
              setFeeOpen(true);
            }} className="gradient-bg text-primary-foreground">
              <Plus className="size-4 mr-1" /> Add Fee Balance
            </Button>
          </div>
          <div className="glass-strong rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Amount Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fees.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No outstanding fee balances.</td></tr>
                ) : fees.map((f) => {
                  const student = users.find((u) => u.id === f.studentId);
                  return (
                    <tr key={f.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{student?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{student?.matricNo || "N/A"}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">{f.item}</td>
                      <td className="px-4 py-3 font-mono font-semibold">{NGN(f.amountDue)}</td>
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
            <h4 className="font-semibold text-md">Library Book Loans</h4>
            <Button onClick={() => {
              setLoanEdit({ studentId: allStudents[0]?.id || "", bookTitle: "", dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0], returned: false, fineAmount: 0 });
              setLoanOpen(true);
            }} className="gradient-bg text-primary-foreground">
              <Plus className="size-4 mr-1" /> New Library Loan
            </Button>
          </div>
          <div className="glass-strong rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Book Title</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Fine</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No library loan records.</td></tr>
                ) : loans.map((l) => {
                  const student = users.find((u) => u.id === l.studentId);
                  const overdue = !l.returned && new Date(l.dueDate) < new Date();
                  return (
                    <tr key={l.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{student?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{student?.matricNo || "N/A"}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">{l.bookTitle}</td>
                      <td className={`px-4 py-3 font-mono whitespace-nowrap ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        {new Date(l.dueDate).toLocaleDateString()} {overdue && "(Overdue)"}
                      </td>
                      <td className="px-4 py-3 font-mono">{NGN(l.fineAmount)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={l.returned ? "approved" : overdue ? "rejected" : "pending"} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        {!l.returned && (
                          <>
                            <Button size="sm" variant="outline" className="text-success hover:text-success border-success/30 hover:bg-success/5" onClick={async () => {
                              try {
                                await store.upsertLibraryLoan({ ...l, returned: true, fineAmount: 0 });
                                toast.success("Marked book as returned");
                              } catch (e) {
                                toast.error("Failed to update record");
                              }
                            }}><Check className="size-3.5 mr-1" /> Return</Button>
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5" onClick={async () => {
                              try {
                                await store.upsertLibraryLoan({ ...l, returned: false, fineAmount: 10000 });
                                toast.success("Book marked as lost. Fine applied.");
                              } catch (e) {
                                toast.error("Failed to update record");
                              }
                            }}><AlertTriangle className="size-3.5 mr-1" /> Lost</Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setLoanEdit(l); setLoanOpen(true); }}><Pencil className="size-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          if (confirm("Delete this loan record?")) {
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
            <h4 className="font-semibold text-md">ICT Asset Assignments</h4>
            <Button onClick={() => {
              setAssetEdit({ studentId: allStudents[0]?.id || "", asset: "", returned: false, replacementCost: 0 });
              setAssetOpen(true);
            }} className="gradient-bg text-primary-foreground">
              <Plus className="size-4 mr-1" /> Assign Asset
            </Button>
          </div>
          <div className="glass-strong rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Replacement Liability</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No ICT asset assignments.</td></tr>
                ) : assets.map((a) => {
                  const student = users.find((u) => u.id === a.studentId);
                  return (
                    <tr key={a.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{student?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{student?.matricNo || "N/A"}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">{a.asset}</td>
                      <td className="px-4 py-3 font-mono">{NGN(a.replacementCost)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.returned ? "approved" : "pending"} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        {!a.returned && (
                          <>
                            <Button size="sm" variant="outline" className="text-success hover:text-success border-success/30 hover:bg-success/5" onClick={async () => {
                              try {
                                await store.upsertIctAsset({ ...a, returned: true, replacementCost: 0 });
                                toast.success("Asset marked as returned");
                              } catch (e) {
                                toast.error("Failed to update record");
                              }
                            }}><Check className="size-3.5 mr-1" /> Return</Button>
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5" onClick={async () => {
                              try {
                                await store.upsertIctAsset({ ...a, returned: false, replacementCost: 25000 });
                                toast.success("Recorded asset damage charges");
                              } catch (e) {
                                toast.error("Failed to update record");
                              }
                            }}><AlertTriangle className="size-3.5 mr-1" /> Damaged</Button>
                          </>
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
            <h4 className="font-semibold text-md">Hostel Room Assignments</h4>
            <Button onClick={() => {
              setHostelEdit({ studentId: allStudents[0]?.id || "", room: "", checkedOut: false, damageFee: 0 });
              setHostelOpen(true);
            }} className="gradient-bg text-primary-foreground">
              <Plus className="size-4 mr-1" /> Assign Room
            </Button>
          </div>
          <div className="glass-strong rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Damage Charges</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hostel.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No hostel room assignments.</td></tr>
                ) : hostel.map((h) => {
                  const student = users.find((u) => u.id === h.studentId);
                  return (
                    <tr key={h.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{student?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{student?.matricNo || "N/A"}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">{h.room}</td>
                      <td className="px-4 py-3 font-mono">{NGN(h.damageFee)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={h.checkedOut && h.damageFee === 0 ? "approved" : "pending"} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        {(!h.checkedOut || h.damageFee > 0) && (
                          <Button size="sm" variant="outline" className="text-success hover:text-success border-success/30 hover:bg-success/5" onClick={async () => {
                            try {
                              await store.upsertHostelAssignment({ ...h, checkedOut: true, damageFee: 0 });
                              toast.success("Checked out successfully and cleared room charges");
                            } catch (e) {
                              toast.error("Failed to update room record");
                            }
                          }}><Check className="size-3.5 mr-1" /> Checkout & Clear</Button>
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
            <h4 className="font-semibold text-md">Sports Equipment Loans</h4>
            <Button onClick={() => {
              setSportsEdit({ studentId: allStudents[0]?.id || "", equipment: "", returned: false, replacementCost: 0 });
              setSportsOpen(true);
            }} className="gradient-bg text-primary-foreground">
              <Plus className="size-4 mr-1" /> New Sports Loan
            </Button>
          </div>
          <div className="glass-strong rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Fine/Replacement</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sports.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No sports equipment loans.</td></tr>
                ) : sports.map((s) => {
                  const student = users.find((u) => u.id === s.studentId);
                  return (
                    <tr key={s.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{student?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{student?.matricNo || "N/A"}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">{s.equipment}</td>
                      <td className="px-4 py-3 font-mono">{NGN(s.replacementCost)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.returned ? "approved" : "pending"} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        {!s.returned && (
                          <Button size="sm" variant="outline" className="text-success hover:text-success border-success/30 hover:bg-success/5" onClick={async () => {
                            try {
                              await store.upsertSportsLoan({ ...s, returned: true, replacementCost: 0 });
                              toast.success("Equipment marked as returned");
                            } catch (e) {
                              toast.error("Failed to update record");
                            }
                          }}><Check className="size-3.5 mr-1" /> Return</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setSportsEdit(s); setSportsOpen(true); }}><Pencil className="size-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          if (confirm("Delete this sports record?")) {
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

      <FinanceDialog open={feeOpen} onClose={() => setFeeOpen(false)} item={feeEdit} students={allStudents} />
      <LibraryDialog open={loanOpen} onClose={() => setLoanOpen(false)} item={loanEdit} students={allStudents} />
      <IctDialog open={assetOpen} onClose={() => setAssetOpen(false)} item={assetEdit} students={allStudents} />
      <HostelDialog open={hostelOpen} onClose={() => setHostelOpen(false)} item={hostelEdit} students={allStudents} />
      <SportsDialog open={sportsOpen} onClose={() => setSportsOpen(false)} item={sportsEdit} students={allStudents} />
    </div>
  );
}

function FinanceDialog({ open, onClose, item, students }: { open: boolean; onClose: () => void; item: { id?: string; studentId: string; item: string; amountDue: number } | null; students: User[] }) {
  const [draft, setDraft] = useState(item);
  useEffect(() => { if (open) setDraft(item); }, [open, item]);
  if (!draft) return null;
  const save = async () => {
    if (!draft.studentId) return toast.error("Please select a student");
    if (!draft.item.trim()) return toast.error("Please enter a description");
    if (draft.amountDue < 0) return toast.error("Amount due cannot be negative");
    try {
      await store.upsertFeeBalance(draft);
      toast.success("Fee balance saved");
      onClose();
    } catch (e) {
      toast.error("Failed to save fee balance");
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">{draft.id ? "Edit Fee Balance" : "New Fee Balance"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <StudentSelect value={draft.studentId} onChange={(v) => setDraft({ ...draft, studentId: v })} students={students} />
          <div className="space-y-1.5"><Label htmlFor="desc">Description</Label><Input id="desc" value={draft.item} onChange={(e) => setDraft({ ...draft, item: e.target.value })} placeholder="e.g. Tuition fee balance" /></div>
          <div className="space-y-1.5"><Label htmlFor="amt">Amount Due (NGN)</Label><Input id="amt" type="number" value={draft.amountDue || ""} onChange={(e) => setDraft({ ...draft, amountDue: Number(e.target.value) })} placeholder="0" /></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="gradient-bg text-primary-foreground" onClick={save}>Save</Button></div>
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
        <DialogHeader><DialogTitle className="font-display">{draft.id ? "Edit Library Loan" : "New Library Loan"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <StudentSelect value={draft.studentId} onChange={(v) => setDraft({ ...draft, studentId: v })} students={students} />
          <div className="space-y-1.5"><Label htmlFor="title">Book Title</Label><Input id="title" value={draft.bookTitle} onChange={(e) => setDraft({ ...draft, bookTitle: e.target.value })} placeholder="e.g. Database System Concepts" /></div>
          <div className="space-y-1.5"><Label htmlFor="due">Due Date</Label><Input id="due" type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="fine">Fine Amount (NGN)</Label><Input id="fine" type="number" value={draft.fineAmount || ""} onChange={(e) => setDraft({ ...draft, fineAmount: Number(e.target.value) })} placeholder="0" /></div>
          <div className="flex items-center gap-2 py-1"><input type="checkbox" id="ret" checked={draft.returned} onChange={(e) => setDraft({ ...draft, returned: e.target.checked, fineAmount: e.target.checked ? 0 : draft.fineAmount })} className="size-4 rounded border-gray-350" /><Label htmlFor="ret" className="cursor-pointer text-sm">Mark as Returned (clears outstanding fine)</Label></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="gradient-bg text-primary-foreground" onClick={save}>Save</Button></div>
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
        <DialogHeader><DialogTitle className="font-display">{draft.id ? "Edit Asset Assignment" : "New Asset Assignment"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <StudentSelect value={draft.studentId} onChange={(v) => setDraft({ ...draft, studentId: v })} students={students} />
          <div className="space-y-1.5"><Label htmlFor="asset">Asset Name</Label><Input id="asset" value={draft.asset} onChange={(e) => setDraft({ ...draft, asset: e.target.value })} placeholder="e.g. Laptop LP-102" /></div>
          <div className="space-y-1.5"><Label htmlFor="cost">Replacement Liability (NGN)</Label><Input id="cost" type="number" value={draft.replacementCost || ""} onChange={(e) => setDraft({ ...draft, replacementCost: Number(e.target.value) })} placeholder="0" /></div>
          <div className="flex items-center gap-2 py-1"><input type="checkbox" id="iret" checked={draft.returned} onChange={(e) => setDraft({ ...draft, returned: e.target.checked, replacementCost: e.target.checked ? 0 : draft.replacementCost })} className="size-4 rounded border-gray-350" /><Label htmlFor="iret" className="cursor-pointer text-sm">Mark as Returned</Label></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="gradient-bg text-primary-foreground" onClick={save}>Save</Button></div>
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
        <DialogHeader><DialogTitle className="font-display">{draft.id ? "Edit Hostel Assignment" : "New Hostel Assignment"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <StudentSelect value={draft.studentId} onChange={(v) => setDraft({ ...draft, studentId: v })} students={students} />
          <div className="space-y-1.5"><Label htmlFor="room">Room Details</Label><Input id="room" value={draft.room} onChange={(e) => setDraft({ ...draft, room: e.target.value })} placeholder="e.g. Hall A, Room 304" /></div>
          <div className="space-y-1.5"><Label htmlFor="damage">Damage / Outstanding Fees (NGN)</Label><Input id="damage" type="number" value={draft.damageFee || ""} onChange={(e) => setDraft({ ...draft, damageFee: Number(e.target.value) })} placeholder="0" /></div>
          <div className="flex items-center gap-2 py-1"><input type="checkbox" id="hco" checked={draft.checkedOut} onChange={(e) => setDraft({ ...draft, checkedOut: e.target.checked })} className="size-4 rounded border-gray-350" /><Label htmlFor="hco" className="cursor-pointer text-sm">Mark as Checked Out</Label></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="gradient-bg text-primary-foreground" onClick={save}>Save</Button></div>
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
        <DialogHeader><DialogTitle className="font-display">{draft.id ? "Edit Sports Loan" : "New Sports Loan"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <StudentSelect value={draft.studentId} onChange={(v) => setDraft({ ...draft, studentId: v })} students={students} />
          <div className="space-y-1.5"><Label htmlFor="equip">Equipment Name</Label><Input id="equip" value={draft.equipment} onChange={(e) => setDraft({ ...draft, equipment: e.target.value })} placeholder="e.g. Football kit" /></div>
          <div className="space-y-1.5"><Label htmlFor="scost">Replacement / Fine (NGN)</Label><Input id="scost" type="number" value={draft.replacementCost || ""} onChange={(e) => setDraft({ ...draft, replacementCost: Number(e.target.value) })} placeholder="0" /></div>
          <div className="flex items-center gap-2 py-1"><input type="checkbox" id="sret" checked={draft.returned} onChange={(e) => setDraft({ ...draft, returned: e.target.checked, replacementCost: e.target.checked ? 0 : draft.replacementCost })} className="size-4 rounded border-gray-350" /><Label htmlFor="sret" className="cursor-pointer text-sm">Mark as Returned</Label></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button className="gradient-bg text-primary-foreground" onClick={save}>Save</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
