import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authStore, useAuthHydrated, useAuthUser } from "@/lib/store";
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



function LoginPage() {
  const navigate = useNavigate();
  const user = useAuthUser();
  const authReady = useAuthHydrated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!authReady || !user) return;
    
    // If logged in and password change is required, force them to settings immediately
    if (user.role === "student" && authStore.isPasswordChangeRequired()) {
      navigate({ to: "/settings" });
      return;
    }

    const dest = user.role === "student" ? "/student" : user.role === "admin" ? "/admin" : "/department";
    navigate({ to: dest });
  }, [authReady, user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const role = await authStore.login(email, password);
    if (!role) return toast.error("Invalid email, admission number, or password");
    
    if (role === "student" && authStore.isPasswordChangeRequired()) {
      toast.error("Change Password Required", {
        description: "You must update your default password before accessing your student portal.",
      });
      navigate({ to: "/settings" });
      return;
    }

    toast.success(`Welcome back!`);
    navigate({ to: role === "student" ? "/student" : role === "admin" ? "/admin" : "/department" });
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
          <Link to="/verify" search={{ id: "" }} className="inline-flex items-center gap-2 hover:underline">
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
            <div className="space-y-2 animate-fade-in">
              <Label htmlFor="email" className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Admission Number / Email Address</Label>
              <Input id="email" type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. 122000 or you@university.edu" className="rounded-xl h-11 border-border/80 bg-background/50 focus-visible:ring-primary focus-visible:ring-2 transition-all" required />
            </div>
            <div className="space-y-2 animate-fade-in" style={{ animationDelay: "50ms" }}>
              <Label htmlFor="password" className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="rounded-xl h-11 border-border/80 bg-background/50 focus-visible:ring-primary focus-visible:ring-2 transition-all" required />
            </div>

            {/* Student credentials display instructions */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground space-y-2 font-medium shadow-sm backdrop-blur-xs animate-fade-in" style={{ animationDelay: "100ms" }}>
              <div className="font-bold text-primary flex items-center gap-1.5 mb-1 bg-primary/10 w-fit px-2.5 py-1 rounded-lg">
                <Sparkles className="size-3.5 text-primary animate-pulse" /> Student Login Info
              </div>
              <div className="flex items-center justify-between border-b border-border/40 pb-1.5"><span className="text-muted-foreground">Username</span><span className="font-mono font-bold text-foreground bg-muted/80 px-2 py-0.5 rounded">Admission Number (e.g. 122000)</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Password</span><span className="font-mono font-bold text-foreground bg-muted/80 px-2 py-0.5 rounded">Admission Number (first login)</span></div>
            </div>

            <Button type="submit" className="w-full gradient-bg text-primary-foreground shadow-elegant h-11 text-base neon-glow hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer font-semibold rounded-xl">
              Sign in <ArrowRight className="ml-1 size-4" />
            </Button>
          </form>



          <p className="text-center text-xs text-muted-foreground">
            <Link to="/verify" search={{ id: "" }} className="hover:text-foreground underline-offset-4 hover:underline">
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
