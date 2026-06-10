import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useMemo, type ReactNode } from "react";
import { authStore, useAuthHydrated, useAuthUser, useStore, usePasswordChangeRequired } from "@/lib/store";
import { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Menu, Moon, ShieldCheck, Sun, X, PanelLeftClose, PanelLeftOpen, Bell, Search, Settings, Inbox, CheckCircle2, XCircle, Clock, BadgeCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface NavItem { to: string; label: string; icon: ReactNode; }

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: "Actions" | "Students" | "Requests" | "Certificates" | "Users" | "Departments";
  action: () => void;
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

let globalIsCollapsed = false;
let isHydrated = false;
if (typeof window !== "undefined") {
  globalIsCollapsed = localStorage.getItem("sidebar-collapsed") === "true";
}

export function AppShell({ nav, title, children, role }: { nav: NavItem[]; title: string; children: ReactNode; role?: Role }) {
  const user = useAuthUser();
  const authReady = useAuthHydrated();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const passwordChangeRequired = usePasswordChangeRequired();
  const [open, setOpen] = useState(false);

  const finalNav = user?.role === "student" && passwordChangeRequired ? [] : nav;
  const [dark, setDark] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined" && isHydrated) {
      return globalIsCollapsed;
    }
    return false;
  });

  useEffect(() => {
    if (!isHydrated) {
      isHydrated = true;
      if (globalIsCollapsed) {
        setIsCollapsed(true);
      }
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      globalIsCollapsed = next;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const [showNotifications, setShowNotifications] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [notifFilter, setNotifFilter] = useState<"all" | "unread" | "approvals" | "rejections" | "certificates" | "system">("all");

  useEffect(() => {
    const saved = localStorage.getItem("clearance-read-ids");
    if (saved) {
      try {
        setReadIds(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const activity = useStore((s) => s.activity);
  const requests = useStore((s) => s.requests);

  // Derive notifications list based on the user's role
  const userNotifications = useMemo(() => {
    if (!user) return [];
    
    // Sort chronologically descending
    const sorted = [...activity].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return sorted.map((act) => {
      let shouldShow = false;
      let title = "";
      let description = act.action;
      let statusIcon: "approved" | "rejected" | "pending" | "info" | "certificate" | "system" = "info";
      
      const lowerAction = act.action.toLowerCase();

      // Look up corresponding request
      const req = requests.find(r => r.clearanceId === act.clearanceId || r.id === act.target);
      const isMyRequest = req && req.studentId === user.id;

      if (user.role === "student") {
        if (isMyRequest) {
          shouldShow = true;
          if (act.status === "approved") {
            if (lowerAction.includes("certificate") || lowerAction.includes("generated")) {
              title = "Clearance Completed";
              description = "Your overall clearance is fully approved. Certificate generated successfully!";
              statusIcon = "certificate";
            } else {
              title = "Department Approved";
              description = `${act.department} has approved your clearance request (${act.clearanceId}).`;
              statusIcon = "approved";
            }
          } else if (act.status === "rejected") {
            title = "Department Rejected";
            description = `${act.department} has rejected your clearance request. Please verify outstanding obligations.`;
            statusIcon = "rejected";
          } else if (lowerAction.includes("submit")) {
            title = "Clearance Request Submitted";
            description = `Your ${req.requestType.toUpperCase()} clearance request (${act.clearanceId}) was successfully submitted.`;
            statusIcon = "pending";
          }
        }
      } else if (user.role === "department") {
        const dept = user.department;
        if (dept) {
          if (lowerAction.includes("submit") && req && req.departments.some(d => d.department === dept)) {
            shouldShow = true;
            title = "New Request Assigned";
            description = `A new ${req.requestType.toUpperCase()} clearance request (${act.clearanceId}) has been assigned to your department.`;
            statusIcon = "pending";
          }
          if (act.actorRole === "registrar" && req && req.departments.some(d => d.department === dept)) {
            shouldShow = true;
            title = "Registrar Completed Review";
            description = `Registrar has ${act.status} request ${act.clearanceId} for ${req.studentName}.`;
            statusIcon = act.status === "approved" ? "approved" : "rejected";
          }
          if (act.actorRole === "department" && act.department === dept) {
            shouldShow = true;
            title = act.status === "approved" ? "Approval Recorded" : "Rejection Recorded";
            description = `You marked request ${act.clearanceId} as ${act.status}.`;
            statusIcon = act.status === "approved" ? "approved" : "rejected";
          }
          if (lowerAction.includes("submit") && req && req.departments.find(d => d.department === dept)?.status === "pending") {
            const ageMs = Date.now() - new Date(act.timestamp).getTime();
            if (ageMs > 24 * 60 * 60 * 1000) {
              shouldShow = true;
              title = "Pending Review Reminder";
              description = `Clearance request ${act.clearanceId} is still pending your department review.`;
              statusIcon = "pending";
            }
          }
        }
      } else if (user.role === "registrar") {
        if (act.status === "approved" && act.actorRole === "department" && req) {
          const allOtherCleared = req.departments.every(
            d => d.department === "Registrar" || d.status === "approved"
          );
          const registrarStatus = req.departments.find(d => d.department === "Registrar")?.status;
          if (allOtherCleared && registrarStatus === "pending") {
            shouldShow = true;
            title = "Ready For Approval";
            description = `Request ${act.clearanceId} for ${req.studentName} is now ready for final registrar sign-off.`;
            statusIcon = "pending";
          }
        }
        if (lowerAction.includes("bulk")) {
          shouldShow = true;
          title = "Bulk Approval Completed";
          description = `Bulk approval of ready requests was executed successfully.`;
          statusIcon = "approved";
        }
        if (lowerAction.includes("generated certificate")) {
          shouldShow = true;
          title = "Certificate Generated";
          description = `Certificate generated for request ${act.clearanceId}.`;
          statusIcon = "certificate";
        }
      } else if (user.role === "admin") {
        shouldShow = true;
        if (lowerAction.includes("user")) {
          title = lowerAction.includes("created") ? "User Created" : lowerAction.includes("deleted") ? "User Deleted" : "User Updated";
          description = `User account details saved or deleted: ${act.target || ""}`;
          statusIcon = "system";
        } else if (lowerAction.includes("obligation")) {
          title = lowerAction.includes("added") ? "Obligation Added" : lowerAction.includes("removed") ? "Obligation Removed" : "Obligation Updated";
          description = `${act.actor} modified obligations record: ${act.action}`;
          statusIcon = "system";
        } else if (lowerAction.includes("verify")) {
          title = "Certificate Verification Event";
          description = `Clearance certificate ID ${act.clearanceId} was publically verified.`;
          statusIcon = "info";
        } else {
          title = "System Alert";
          description = `${act.actor} ${act.action} ${act.target ? `(${act.target})` : ""}`;
          statusIcon = "system";
        }
      }

      return {
        id: act.id,
        timestamp: act.timestamp,
        title: title || "Notification",
        description,
        statusIcon,
        read: readIds.includes(act.id),
        shouldShow
      };
    }).filter(n => n.shouldShow);
  }, [activity, requests, user, readIds]);

  const unreadCount = useMemo(() => userNotifications.filter(n => !n.read).length, [userNotifications]);

  const markAllAsRead = () => {
    const allIds = userNotifications.map((n) => n.id);
    const updatedReadIds = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(updatedReadIds);
    localStorage.setItem("clearance-read-ids", JSON.stringify(updatedReadIds));
  };

  const markAsRead = (id: string) => {
    if (readIds.includes(id)) return;
    const updated = [...readIds, id];
    setReadIds(updated);
    localStorage.setItem("clearance-read-ids", JSON.stringify(updated));
  };

  const filteredNotifications = useMemo(() => {
    return userNotifications.filter(n => {
      if (notifFilter === "unread") return !n.read;
      if (notifFilter === "approvals") return n.statusIcon === "approved";
      if (notifFilter === "rejections") return n.statusIcon === "rejected";
      if (notifFilter === "certificates") return n.statusIcon === "certificate";
      if (notifFilter === "system") return n.statusIcon === "system";
      return true;
    });
  }, [userNotifications, notifFilter]);

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
    if (!authReady) return;
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    if (user.role === "student" && passwordChangeRequired && path !== "/settings") {
      toast.error("Change Password Required", {
        description: "Please update your password before accessing the student dashboard.",
      });
      navigate({ to: "/settings" });
      return;
    }
    if (role && user.role !== role) {
      toast.error("You don't have access to that page");
      const dest = user.role === "student" ? "/student" : user.role === "admin" ? "/admin" : "/department";
      navigate({ to: dest });
    }
  }, [authReady, user, navigate, role, passwordChangeRequired, path]);

  // --- Command Palette State & Search ---
  const [showPalette, setShowPalette] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allRequests = useStore((s) => s.requests);
  const allUsers = useStore((s) => s.users);

  // Global event listener for Ctrl+K / Cmd+K (restricted to admins)
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (user?.role !== "admin") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowPalette((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, [user?.role]);

  // Build the complete search index
  const searchIndex = useMemo((): SearchResult[] => {
    const list: SearchResult[] = [];

    // 1. Actions
    list.push(
      {
        id: "act-analytics",
        title: "Open Executive Analytics",
        subtitle: "View visual metrics and department rates",
        category: "Actions",
        action: () => {
          navigate({ to: "/admin", search: { tab: "analytics" } as any });
        }
      },
      {
        id: "act-create-user",
        title: "Create Student / User Account",
        subtitle: "Register a new profile in user management",
        category: "Actions",
        action: () => {
          navigate({ to: "/admin", search: { tab: "users", openNew: "true" } as any });
        }
      },
      {
        id: "act-add-obligation",
        title: "Add Obligation Record",
        subtitle: "Create library loan, finance charge, or sport loan",
        category: "Actions",
        action: () => {
          navigate({ to: "/admin", search: { tab: "obligations", openNew: "true" } as any });
        }
      },
      {
        id: "act-user-management",
        title: "Open User Management",
        subtitle: "Inspect student profiles, officers, and admins",
        category: "Actions",
        action: () => {
          navigate({ to: "/admin", search: { tab: "users" } as any });
        }
      },
      {
        id: "act-cert-verify",
        title: "Verify Certificate Online",
        subtitle: "Inspect clearance hashes and verify legitimacy",
        category: "Actions",
        action: () => {
          navigate({ to: "/verify" });
        }
      }
    );

    // 2. Students
    allUsers.filter((u) => u.role === "student").forEach((s) => {
      list.push({
        id: `student-${s.id}`,
        title: s.name,
        subtitle: `Matric: ${s.matricNo || "N/A"} · Email: ${s.email}`,
        category: "Students",
        action: () => {
          navigate({ to: "/admin", search: { tab: "users", search: s.name } as any });
        }
      });
    });

    // 3. Requests
    allRequests.forEach((r) => {
      list.push({
        id: `req-${r.id}`,
        title: `${r.studentName} — ${r.clearanceId}`,
        subtitle: `${r.requestType.toUpperCase()} Clearance · Status: ${r.overallStatus.toUpperCase()}`,
        category: "Requests",
        action: () => {
          if (user?.role === "admin") {
            navigate({ to: "/admin", search: { tab: "overview", search: r.clearanceId } as any });
          } else if (user?.role === "department") {
            navigate({ to: "/department", search: { search: r.clearanceId } as any });
          } else {
            navigate({ to: "/student" });
          }
        }
      });
    });

    // 4. Certificates
    allRequests.filter((r) => r.overallStatus === "approved").forEach((r) => {
      list.push({
        id: `cert-${r.id}`,
        title: `Certificate: ${r.studentName}`,
        subtitle: `ID: ${r.clearanceId} · Verified Digital E-Clearance`,
        category: "Certificates",
        action: () => {
          navigate({ to: "/verify", search: { id: r.clearanceId } as any });
        }
      });
    });

    // 5. Users
    allUsers.forEach((u) => {
      list.push({
        id: `user-${u.id}`,
        title: u.name,
        subtitle: `Role: ${u.role.toUpperCase()} ${u.department ? `(${u.department})` : ""} · ${u.email}`,
        category: "Users",
        action: () => {
          navigate({ to: "/admin", search: { tab: "users", search: u.name } as any });
        }
      });
    });

    // 6. Departments
    ["Finance", "Library", "ICT", "Hostel", "Sports", "Registrar"].forEach((d) => {
      list.push({
        id: `dept-${d}`,
        title: `${d} Department`,
        subtitle: "University Clearance Reviewing Section",
        category: "Departments",
        action: () => {
          if (user?.role === "department" && user.department === d) {
            navigate({ to: "/department" });
          } else {
            navigate({ to: "/admin", search: { tab: "obligations", search: d } as any });
          }
        }
      });
    });

    return list;
  }, [allRequests, allUsers, user]);

  // Filter items matching query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return searchIndex.filter((item) => item.category === "Actions");
    }
    const q = searchQuery.toLowerCase();
    return searchIndex.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [searchQuery, searchIndex]);

  // Reset keyboard selected index when filter query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Bind keyboard navigation to Command Palette
  useEffect(() => {
    if (!showPalette) return;
    const handlePaletteKeys = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          setShowPalette(false);
          setSearchQuery("");
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowPalette(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handlePaletteKeys);
    return () => window.removeEventListener("keydown", handlePaletteKeys);
  }, [showPalette, filteredItems, selectedIndex]);

  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-300">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen z-40 transition-all duration-300 glass-strong border-r flex flex-col shrink-0",
          isCollapsed ? "lg:w-20" : "lg:w-72",
          open ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0 w-72",
        )}
      >
        <div className={cn("p-6 flex items-center shrink-0 border-b border-border/40 h-16 justify-between", isCollapsed ? "lg:justify-center px-4" : "gap-3")}>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl gradient-bg grid place-items-center shadow-glow shrink-0">
              <ShieldCheck className="size-5 text-primary-foreground animate-pulse" />
            </div>
            {!isCollapsed && (
              <div className="animate-fade-in truncate">
                <div className="font-display font-bold text-base leading-none tracking-tight">E-Clearance</div>
                <div className="text-[10px] text-muted-foreground mt-1 font-medium tracking-wide uppercase">University Portal</div>
              </div>
            )}
          </div>
          {/* Mobile close button inside sidebar */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden size-8 -mr-2 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="size-5" />
          </Button>
        </div>
        <nav className="px-3 py-4 flex-1 space-y-1 overflow-y-auto custom-scrollbar">
          {finalNav.map((item) => {
            const active = path === item.to || (item.to !== "/" && path.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden group/item h-11",
                  isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                  active
                    ? "bg-gradient-to-r from-primary/15 to-primary/5 text-primary font-semibold shadow-xs"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                {/* Stripe/Linear style left indicator */}
                {active && (
                  <div className="absolute left-0 top-2.5 bottom-2.5 w-[3.5px] rounded-r bg-primary animate-fade-in shadow-[0_0_8px_var(--color-ring)]" />
                )}
                <div className={cn("size-5 shrink-0 flex items-center justify-center transition-transform group-hover/item:scale-105", active ? "text-primary animate-pulse" : "text-muted-foreground group-hover/item:text-foreground")}>
                  {item.icon}
                </div>
                {!isCollapsed && <span className="truncate transition-all duration-300">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border/40 shrink-0 bg-muted/5">
          <div className={cn("flex items-center rounded-xl", isCollapsed ? "justify-center p-1" : "gap-3 px-2 py-2")}>
            <div className="size-9 rounded-full gradient-bg grid place-items-center text-primary-foreground text-xs font-semibold shrink-0" title={user?.name}>
              {user?.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-fade-in">
                <div className="text-sm font-semibold truncate leading-none mb-0.5">{user?.name}</div>
                <div className="text-[10px] text-muted-foreground truncate capitalize font-medium">
                  {user?.role}{user?.department ? ` · ${user.department}` : ""}
                </div>
              </div>
            )}
          </div>
          
          <div className={cn("flex flex-col gap-1 mt-2", isCollapsed && "items-center")}>
            <Button
              variant="ghost"
              size={isCollapsed ? "icon" : "default"}
              className={cn(
                "w-full justify-start gap-2 h-9",
                path === "/settings" ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground",
                isCollapsed ? "justify-center size-9 p-0" : "px-3 py-2"
              )}
              onClick={() => navigate({ to: "/settings" })}
              title="Change Password"
            >
              <Settings className={cn("size-4", path === "/settings" ? "text-primary" : "text-muted-foreground")} />
              {!isCollapsed && <span className="text-xs font-medium">Change Password</span>}
            </Button>
            <Button
              variant="ghost"
              size={isCollapsed ? "icon" : "default"}
              className={cn("w-full justify-start gap-2 text-muted-foreground hover:text-foreground h-9", isCollapsed ? "justify-center size-9 p-0" : "px-3 py-2")}
              onClick={toggleSidebar}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              {!isCollapsed && <span className="text-xs font-medium">Collapse Sidebar</span>}
            </Button>
            <Button
              variant="ghost"
              size={isCollapsed ? "icon" : "default"}
              className={cn("w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive h-9", isCollapsed ? "justify-center size-9 p-0" : "px-3 py-2")}
              onClick={() => { authStore.logout(); navigate({ to: "/" }); }}
              title="Sign out"
            >
              <LogOut className="size-4" />
              {!isCollapsed && <span className="text-xs font-medium">Sign out</span>}
            </Button>
          </div>
        </div>
      </aside>

      {open && (
        <button
          aria-label="close"
          className="lg:hidden fixed inset-0 bg-black/40 z-30 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 glass border-b border-border/40">
          <div className="flex items-center gap-3 px-4 sm:px-8 h-16">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((v) => !v)}>
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <GraduationCap className="size-5 text-primary" />
              <h1 className="font-display font-semibold text-base sm:text-lg tracking-tight">{title}</h1>
            </div>
            
            <div className="ml-auto flex items-center gap-2 relative">
              {/* Discoverable Command Palette Trigger (restricted to admins) */}
              {user?.role === "admin" && (
                <button
                  onClick={() => setShowPalette(true)}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/40 bg-muted/40 text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors cursor-pointer mr-2 shadow-xs hover:bg-muted"
                >
                  <Search className="size-3.5" />
                  <span>Search...</span>
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-popover px-1.5 font-mono text-[9px] font-bold opacity-100">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </button>
              )}

              {/* Notification Bell */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative rounded-full hover:bg-accent/40 size-9 flex items-center justify-center"
                  onClick={() => setShowNotifications(true)}
                  aria-label="Notifications"
                >
                  <Bell className="size-4.5 text-foreground/80 hover:text-foreground transition-colors" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground font-mono text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center border border-background animate-pulse shadow-elegant">
                      {unreadCount}
                    </span>
                  )}
                </Button>

                {/* Notification Drawer Sheet */}
                <Sheet open={showNotifications} onOpenChange={setShowNotifications}>
                  <SheetContent className="sm:max-w-md flex flex-col h-full bg-background/95 backdrop-blur-md border-l">
                    <SheetHeader className="pb-4 border-b">
                      <div className="flex items-center justify-between">
                        <SheetTitle className="font-display font-semibold text-lg flex items-center gap-2">
                          <Bell className="size-5 text-primary animate-pulse" /> Notifications
                          {unreadCount > 0 && (
                            <span className="bg-primary text-primary-foreground font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {unreadCount} unread
                            </span>
                          )}
                        </SheetTitle>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                    </SheetHeader>

                    {/* Filters */}
                    <div className="py-3 flex gap-1.5 overflow-x-auto border-b scrollbar-none">
                      {(
                        [
                          { id: "all", label: "All" },
                          { id: "unread", label: "Unread" },
                          { id: "approvals", label: "Approvals" },
                          { id: "rejections", label: "Rejections" },
                          { id: "certificates", label: "Certificates" },
                          { id: "system", label: "System" }
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setNotifFilter(f.id)}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all duration-150 cursor-pointer",
                            notifFilter === f.id
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted/40 text-muted-foreground border-transparent hover:text-foreground"
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {/* Scrollable list */}
                    <div className="flex-1 overflow-y-auto divide-y divide-border/20 py-2 custom-scrollbar">
                      {filteredNotifications.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground select-none">
                          <Bell className="size-8 mx-auto text-muted-foreground/35 mb-2.5" />
                          <div className="text-xs font-bold text-foreground/80">No Notifications</div>
                          <p className="text-[10px] mt-0.5">No notifications match this filter.</p>
                        </div>
                      ) : (
                        filteredNotifications.map((notif) => {
                          let StatusIcon = Shield;
                          let iconColor = "bg-blue-500/10 text-blue-500 border-blue-500/20";
                          if (notif.statusIcon === "approved") {
                            StatusIcon = CheckCircle2;
                            iconColor = "bg-success/15 text-success border-success/30";
                          } else if (notif.statusIcon === "rejected") {
                            StatusIcon = XCircle;
                            iconColor = "bg-destructive/15 text-destructive border-destructive/30";
                          } else if (notif.statusIcon === "pending") {
                            StatusIcon = Clock;
                            iconColor = "bg-warning/15 text-[oklch(0.5_0.16_75)] dark:text-warning border-warning/30";
                          } else if (notif.statusIcon === "certificate") {
                            StatusIcon = BadgeCheck;
                            iconColor = "bg-purple-500/15 text-purple-500 border-purple-500/30";
                          } else if (notif.statusIcon === "system") {
                            StatusIcon = ShieldCheck;
                            iconColor = "bg-blue-500/15 text-blue-400 border-blue-500/30";
                          }

                          return (
                            <button
                              key={notif.id}
                              onClick={() => markAsRead(notif.id)}
                              className={cn(
                                "w-full p-4 flex items-start gap-3.5 hover:bg-accent/40 transition-colors text-left border-b border-border/10 cursor-pointer",
                                !notif.read && "bg-primary/5"
                              )}
                            >
                              {/* Status Icon */}
                              <div className={cn("size-8.5 rounded-xl border flex items-center justify-center shrink-0 shadow-xs", iconColor)}>
                                <StatusIcon className="size-4" />
                              </div>

                              {/* Title & Description */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-foreground truncate">{notif.title}</span>
                                  <span className="text-[9px] text-muted-foreground font-semibold shrink-0">
                                    {formatRelativeTime(notif.timestamp)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed font-semibold">
                                  {notif.description}
                                </p>
                              </div>

                              {/* Read Dot */}
                              {!notif.read && (
                                <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="p-3 border-t text-center bg-muted/10 shrink-0">
                      <span className="text-[10px] text-muted-foreground font-semibold">Secure Real-time clearance system active</span>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              <Button variant="ghost" size="icon" className="rounded-full size-9" onClick={toggleTheme} aria-label="Toggle theme">
                {dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
              </Button>
            </div>
          </div>
        </header>
        <main key={path} className="flex-1 px-4 sm:px-8 py-6 sm:py-10 max-w-7xl w-full mx-auto animate-fade-up">
          {children}
        </main>
      </div>

      {/* Global Command Palette Overlay Dialog */}
      <AnimatePresence>
        {user?.role === "admin" && showPalette && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowPalette(false); setSearchQuery(""); }}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 transition-opacity"
            />
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -10 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-lg bg-popover/95 border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[420px] pointer-events-auto"
              >
                {/* Search Bar Input Header */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
                  <Search className="size-4 text-muted-foreground" />
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search students, requests, actions..."
                    className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground text-sm py-1"
                  />
                  <kbd className="pointer-events-none inline-flex select-none items-center rounded border bg-muted px-1.5 font-mono text-[9px] font-medium text-muted-foreground opacity-100">
                    ESC
                  </kbd>
                </div>

                {/* Flat/Grouped Results container */}
                <div className="flex-1 overflow-y-auto p-2 space-y-3 max-h-[320px] custom-scrollbar">
                  {filteredItems.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground select-none">
                      <Inbox className="size-8 mx-auto text-muted-foreground/30 mb-2.5" />
                      <div className="text-xs font-semibold text-foreground/80">No results found</div>
                      <div className="text-[10px] mt-0.5">No records match the current filters.</div>
                    </div>
                  ) : (
                    (() => {
                      const categories = Array.from(new Set(filteredItems.map(item => item.category)));
                      return categories.map(cat => {
                        const catItems = filteredItems.filter(item => item.category === cat);
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                              {cat}
                            </div>
                            {catItems.map(item => {
                              const currentIndex = filteredItems.indexOf(item);
                              const isSelected = currentIndex === selectedIndex;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    item.action();
                                    setShowPalette(false);
                                    setSearchQuery("");
                                  }}
                                  onMouseEnter={() => setSelectedIndex(currentIndex)}
                                  className={cn(
                                    "w-full flex flex-col text-left px-3 py-2 rounded-xl transition-all cursor-pointer",
                                    isSelected
                                      ? "bg-primary text-primary-foreground shadow-sm font-medium"
                                      : "hover:bg-accent/40 text-foreground"
                                  )}
                                >
                                  <div className="text-sm font-semibold leading-tight">{item.title}</div>
                                  <div className={cn("text-xs mt-0.5", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                    {item.subtitle}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      });
                    })()
                  )}
                </div>

                {/* Instructions Footer */}
                <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10 flex items-center justify-between text-[10px] text-muted-foreground font-medium select-none">
                  <div className="flex items-center gap-1.5">
                    <span>↑↓ to navigate</span>
                    <span>&middot;</span>
                    <span>Enter to select</span>
                  </div>
                  <span>Ctrl + K to toggle</span>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
