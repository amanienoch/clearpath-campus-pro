import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { authStore, useAuthUser } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Menu, Moon, ShieldCheck, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem { to: string; label: string; icon: ReactNode; }

export function AppShell({ nav, title, children }: { nav: NavItem[]; title: string; children: ReactNode }) {
  const user = useAuthUser();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") === "dark";
    setDark(saved);
    document.documentElement.classList.toggle("dark", saved);
  }, []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  useEffect(() => {
    if (!user) navigate({ to: "/" });
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen w-72 z-40 transition-transform glass-strong border-r flex flex-col",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="size-10 rounded-xl gradient-bg grid place-items-center shadow-glow">
            <ShieldCheck className="size-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none">E-Clearance</div>
            <div className="text-xs text-muted-foreground mt-1">University Portal</div>
          </div>
        </div>
        <nav className="px-4 py-4 flex-1 space-y-1">
          {nav.map((item) => {
            const active = path === item.to || (item.to !== "/" && path.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  active
                    ? "gradient-bg text-primary-foreground shadow-elegant"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 px-2 py-3 rounded-xl">
            <div className="size-10 rounded-full gradient-bg grid place-items-center text-primary-foreground font-semibold">
              {user?.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user?.name}</div>
              <div className="text-xs text-muted-foreground truncate capitalize">
                {user?.role}{user?.department ? ` · ${user.department}` : ""}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 mt-2"
            onClick={() => { authStore.logout(); navigate({ to: "/" }); }}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {open && (
        <button
          aria-label="close"
          className="lg:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 glass border-b">
          <div className="flex items-center gap-3 px-4 sm:px-8 h-16">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((v) => !v)}>
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <GraduationCap className="size-5 text-primary" />
              <h1 className="font-display font-semibold text-lg">{title}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-10 max-w-7xl w-full mx-auto animate-fade-up">
          {children}
        </main>
      </div>
    </div>
  );
}
