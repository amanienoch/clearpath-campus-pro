import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authStore, useAuthUser } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, GraduationCap, Sparkles, ArrowRight, QrCode } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — E-Clearance" },
      { name: "description", content: "Sign in to the university E-Clearance portal as a student, department officer, or administrator." },
    ],
  }),
  component: LoginPage,
});

const DEMOS = [
  { role: "Student", email: "glorian.bana@university.edu", password: "student123", path: "/student" },
  { role: "Finance", email: "finance@university.edu", password: "dept123", path: "/department" },
  { role: "Library", email: "library@university.edu", password: "dept123", path: "/department" },
  { role: "Admin", email: "admin@university.edu", password: "admin123", path: "/admin" },
];

function LoginPage() {
  const navigate = useNavigate();
  const user = useAuthUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      const dest = user.role === "student" ? "/student" : user.role === "admin" ? "/admin" : "/department";
      navigate({ to: dest });
    }
  }, [user, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const role = authStore.login(email, password);
    if (!role) return toast.error("Invalid email or password");
    toast.success(`Welcome back!`);
    navigate({ to: role === "student" ? "/student" : role === "admin" ? "/admin" : "/department" });
  };

  const quickLogin = (e: string, p: string, path: string) => {
    authStore.login(e, p);
    toast.success("Signed in as demo user");
    navigate({ to: path });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left hero */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 hero-bg text-primary-foreground overflow-hidden">
        <div className="absolute -top-20 -right-20 size-96 rounded-full bg-white/10 blur-3xl animate-float" />
        <div className="absolute bottom-10 -left-10 size-80 rounded-full bg-white/10 blur-3xl animate-float" style={{ animationDelay: "2s" }} />

        <div className="relative flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-white/15 backdrop-blur grid place-items-center">
            <ShieldCheck className="size-6" />
          </div>
          <div className="font-display font-bold text-xl">E-Clearance</div>
        </div>

        <div className="relative space-y-6 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-xs font-medium">
            <Sparkles className="size-3.5" /> Trusted by 12,000+ students
          </div>
          <h2 className="font-display font-bold text-5xl leading-tight">
            Clearance, reimagined for the digital campus.
          </h2>
          <p className="text-white/85 text-lg">
            Submit, track and verify your university clearance across all departments — anytime, on any device.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            <Stat n="6" l="Departments" />
            <Stat n="24h" l="Avg. response" />
            <Stat n="99.9%" l="Uptime" />
          </div>
        </div>

        <div className="relative text-sm text-white/80 flex items-center gap-2">
          <Link to="/verify" className="inline-flex items-center gap-2 hover:underline">
            <QrCode className="size-4" /> Verify a clearance certificate
          </Link>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8 animate-fade-up">
          <div className="lg:hidden flex items-center gap-3">
            <div className="size-10 rounded-xl gradient-bg grid place-items-center shadow-glow">
              <ShieldCheck className="size-5 text-primary-foreground" />
            </div>
            <div className="font-display font-bold text-xl">E-Clearance</div>
          </div>

          <div>
            <h1 className="font-display font-bold text-3xl">Welcome back</h1>
            <p className="text-muted-foreground mt-2">Sign in to continue your clearance journey.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full gradient-bg text-primary-foreground shadow-elegant h-11 text-base">
              Sign in <ArrowRight className="ml-1 size-4" />
            </Button>
          </form>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase tracking-wider">
              <div className="h-px flex-1 bg-border" /> Quick demo access <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMOS.map((d) => (
                <button
                  key={d.email}
                  onClick={() => quickLogin(d.email, d.password, d.path)}
                  className="glass rounded-xl px-3 py-2.5 text-left text-sm hover:shadow-elegant transition-all"
                >
                  <div className="font-medium flex items-center gap-1.5">
                    <GraduationCap className="size-3.5 text-primary" /> {d.role}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{d.email}</div>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            <Link to="/verify" className="hover:text-foreground underline-offset-4 hover:underline">
              Verify a clearance certificate →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="font-display font-bold text-3xl">{n}</div>
      <div className="text-xs text-white/75 mt-1">{l}</div>
    </div>
  );
}
