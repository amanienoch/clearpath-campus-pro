import { useState, useMemo } from "react";
import { ActivityItem, ClearanceRequest, REQUEST_TYPE_LABEL } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  BadgeCheck,
  ShieldCheck,
  Shield,
  User,
  Inbox
} from "lucide-react";

// Format relative time helper
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

export function UnifiedActivityFeed({
  items = [],
  loading = false,
  className
}: {
  items: ActivityItem[];
  loading?: boolean;
  className?: string;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "approved" | "rejected" | "certificate" | "student" | "department" | "admin" | "registrar"
  >("all");

  const requests = useStore((s) => s.requests);

  // 1. Resolve studentName and matricNo for search and display
  const parsedItems = useMemo(() => {
    return items.map(item => {
      let studentName = "";
      let matricNo = "";
      
      const req = requests.find(r => r.clearanceId === item.clearanceId || r.id === item.target);
      if (req) {
        studentName = req.studentName;
        matricNo = req.matricNo;
      }
      
      return {
        ...item,
        studentName,
        matricNo
      };
    });
  }, [items, requests]);

  // 2. Filter items based on selected category and text search
  const filteredItems = useMemo(() => {
    return parsedItems.filter(item => {
      // Category Filter
      let matchesCategory = true;
      if (filter === "approved") {
        matchesCategory = item.status === "approved";
      } else if (filter === "rejected") {
        matchesCategory = item.status === "rejected";
      } else if (filter === "certificate") {
        matchesCategory =
          item.action.toLowerCase().includes("certificate") ||
          item.action.toLowerCase().includes("generated") ||
          item.action.toLowerCase().includes("downloaded");
      } else if (filter === "student") {
        matchesCategory = item.actorRole === "student";
      } else if (filter === "department") {
        matchesCategory = item.actorRole === "department";
      } else if (filter === "admin") {
        matchesCategory = item.actorRole === "admin";
      } else if (filter === "registrar") {
        matchesCategory = item.actorRole === "registrar";
      }

      if (!matchesCategory) return false;

      // Text Search Filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.actor.toLowerCase().includes(q) ||
        item.action.toLowerCase().includes(q) ||
        (item.clearanceId && item.clearanceId.toLowerCase().includes(q)) ||
        item.studentName.toLowerCase().includes(q) ||
        item.matricNo.toLowerCase().includes(q)
      );
    });
  }, [parsedItems, filter, search]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by student name, officer, matric no, clearance ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl border-border/60 bg-background/50 h-10 w-full"
          />
        </div>

        {/* Filters Selectors */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted">
          {(
            [
              { id: "all", label: "All" },
              { id: "approved", label: "Approvals" },
              { id: "rejected", label: "Rejections" },
              { id: "certificate", label: "Certificates" },
              { id: "student", label: "Students" },
              { id: "department", label: "Departments" },
              { id: "admin", label: "Admin" },
              { id: "registrar", label: "Registrar" }
            ] as const
          ).map((t) => {
            const active = filter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-semibold rounded-xl border whitespace-nowrap transition-all duration-200 cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground border-border/50"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Activity Feed Cards List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-4 rounded-xl border border-border/30 bg-card/40 animate-pulse">
              <Skeleton className="size-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            </div>
          ))
        ) : filteredItems.length === 0 ? (
          <div className="glass-strong rounded-3xl p-12 text-center border border-border/20">
            <Inbox className="size-10 mx-auto text-muted-foreground/35 mb-3 animate-pulse" />
            <h3 className="font-display font-semibold text-sm">No Activities Logged</h3>
            <p className="text-muted-foreground text-xs mt-1 font-medium max-w-sm mx-auto">
              No matching activity events found. Try refining your filters or search terms.
            </p>
          </div>
        ) : (
          filteredItems.map((act) => {
            const isCertificate =
              act.action.toLowerCase().includes("certificate") ||
              act.action.toLowerCase().includes("generated") ||
              act.action.toLowerCase().includes("downloaded");

            const isSystem = act.actorRole === "admin" || act.actorRole === "system";

            // Determine status color and icon
            let iconColor = "bg-blue-500/10 text-blue-500 border-blue-500/25";
            let StatusIcon = Shield;

            if (act.status === "approved") {
              iconColor = "bg-success/15 text-success border border-success/30";
              StatusIcon = CheckCircle2;
            } else if (act.status === "rejected") {
              iconColor = "bg-destructive/15 text-destructive border border-destructive/30";
              StatusIcon = XCircle;
            } else if (act.status === "pending") {
              iconColor = "bg-warning/15 text-[oklch(0.5_0.16_75)] dark:text-warning border border-warning/30";
              StatusIcon = Clock;
            } else if (isCertificate) {
              iconColor = "bg-purple-500/15 text-purple-500 border-purple-500/30";
              StatusIcon = BadgeCheck;
            } else if (isSystem) {
              iconColor = "bg-blue-500/15 text-blue-400 border-blue-500/30";
              StatusIcon = ShieldCheck;
            }

            return (
              <div
                key={act.id}
                className="flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 hover:shadow-elegant transition-all duration-200 text-left"
              >
                {/* Status Icon */}
                <div className={cn("size-9 rounded-xl border flex items-center justify-center shrink-0 shadow-sm", iconColor)}>
                  <StatusIcon className="size-4.5" />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                    <div>
                      {/* Actor & Role */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{act.actor}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted/65 text-muted-foreground border border-border/50">
                          {act.actorRole}{act.department ? ` · ${act.department}` : ""}
                        </span>
                      </div>
                      
                      {/* Action performed */}
                      <p className="text-xs text-muted-foreground mt-1 font-semibold leading-relaxed">
                        {act.action}
                      </p>
                    </div>

                    {/* Relative Timestamp */}
                    <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                      {formatRelativeTime(act.timestamp)}
                    </span>
                  </div>

                  {/* Target student & Clearance ID Footer info */}
                  {(act.clearanceId || act.studentName) && (
                    <div className="mt-3 flex items-center gap-2.5 flex-wrap">
                      {act.clearanceId && (
                        <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                          {act.clearanceId}
                        </span>
                      )}
                      
                      {act.studentName && (
                        <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                          <User className="size-3" />
                          <span>Student:</span>
                          <span className="text-foreground font-bold">{act.studentName}</span>
                          {act.matricNo && (
                            <span className="font-mono text-muted-foreground/75 font-medium">({act.matricNo})</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
