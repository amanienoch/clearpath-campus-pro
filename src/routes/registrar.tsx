import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useAuthUser, useStore, store } from "@/lib/store";
import { ClearanceRequest, ClearanceStatus, Department, REQUEST_TYPE_LABEL, User, DEPARTMENTS } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { UnifiedActivityFeed } from "@/components/UnifiedActivityFeed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { QrCode } from "@/components/QrCode";
import { NGN, evaluateDepartment } from "@/lib/eligibility";
import {
  LayoutDashboard, Search, CheckCircle2, Clock, XCircle, Inbox, BadgeCheck, Sparkles, AlertTriangle,
  Activity, TrendingUp, BarChart3, Timer, CalendarDays, Percent, FileText, ExternalLink,
  BookOpen, Wallet, Laptop, Home, Trophy, Check, Shield, Zap, ChevronRight, Download, Filter, ArrowUpDown, ChevronDown,
  HelpCircle
} from "lucide-react";
import { Tooltip as ShTooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/registrar")({
  head: () => ({
    meta: [
      { title: "Registrar Operations Center — E-Clearance" },
      { name: "description", content: "Executive operations center for the Office of the Registrar." }
    ]
  }),
  component: RegistrarDashboard,
});

/* ─────────────────────────────────────────────────────────────────────────────
 * GLASSMORPHISM TOOLTIP STYLE
 * ───────────────────────────────────────────────────────────────────────── */
const GLASS_TOOLTIP = {
  background: "var(--glass-bg)",
  backdropFilter: "blur(8px)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "var(--shadow-glass)",
} as const;
const TOOLTIP_ITEM = { fontSize: 11, fontWeight: 600 } as const;
const TOOLTIP_LABEL = { fontSize: 11, fontWeight: 700 } as const;

/* Chart colors matching dark SaaS oklch palette */
const COLOR_APPROVED = "oklch(0.65 0.18 155)";
const COLOR_PENDING = "oklch(0.78 0.16 75)";
const COLOR_REJECTED = "oklch(0.6 0.23 27)";
const COLOR_PRIMARY = "oklch(0.52 0.22 265)";

function RegistrarDashboard() {
  const user = useAuthUser();
  const navigate = useNavigate();

  // Authentication and role check
  useEffect(() => {
    if (user && user.role !== "admin" && user.department !== "Registrar") {
      toast.error("Access Denied: Only the Registrar or Admins can access this portal");
      navigate({ to: "/" });
    }
  }, [user, navigate]);

  const requests = useStore((s) => s.requests);
  const users = useStore((s) => s.users);
  const activity = useStore((s) => s.activity);
  const loans = useStore((s) => s.loans);
  const fees = useStore((s) => s.fees);
  const assets = useStore((s) => s.assets);
  const hostel = useStore((s) => s.hostel);
  const sports = useStore((s) => s.sports);
  const hydrated = useStore((s) => s.hydrated);

  // States
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "pending" | "blocked" | "approved" | "rejected">("all");
  const [sortBy, setSortBy] = useState<"date" | "score" | "name" | "clearanceId">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedRequest, setSelectedRequest] = useState<ClearanceRequest | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);

  // Modal Remarks State
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [showDurationModal, setShowDurationModal] = useState(false);

  // Helpers
  const getStudentObligations = useCallback((studentId: string) => {
    const studentFees = fees.filter((f) => f.studentId === studentId && Number(f.amountDue ?? 0) > 0);
    const studentLoans = loans.filter((l) => l.studentId === studentId && !l.returned);
    const studentAssets = assets.filter((a) => a.studentId === studentId && !a.returned);
    const studentHostel = hostel.filter((h) => h.studentId === studentId && (!h.checkedOut || Number(h.damageFee ?? 0) > 0));
    const studentSports = sports.filter((sp) => sp.studentId === studentId && !sp.returned);
    
    return {
      fees: studentFees,
      loans: studentLoans,
      assets: studentAssets,
      hostel: studentHostel,
      sports: studentSports,
      totalCount: studentFees.length + studentLoans.length + studentAssets.length + studentHostel.length + studentSports.length,
      totalValue: 
        studentFees.reduce((sum, f) => sum + Number(f.amountDue ?? 0), 0) +
        studentLoans.reduce((sum, l) => sum + Number(l.fineAmount ?? 0), 0) +
        studentAssets.reduce((sum, a) => sum + Number(a.replacementCost ?? 0), 0) +
        studentHostel.reduce((sum, h) => sum + Number(h.damageFee ?? 0), 0) +
        studentSports.reduce((sum, sp) => sum + Number(sp.replacementCost ?? 0), 0)
    };
  }, [fees, loans, assets, hostel, sports]);

  const calculateReadiness = useCallback((studentId: string, request?: ClearanceRequest) => {
    const ob = getStudentObligations(studentId);
    
    let outstandingDepts = 5; // default if no request exists yet
    let hasRejection = false;
    if (request) {
      outstandingDepts = request.departments.filter(
        (d) => d.department !== "Registrar" && d.status !== "approved"
      ).length;
      hasRejection = request.departments.some(
        (d) => d.department !== "Registrar" && d.status === "rejected"
      );
    } else {
      // Proactively evaluate using evaluateDepartment if no request exists
      const data = { loans, fees, assets, hostel, sports };
      const deptsToEvaluate: Department[] = ["Finance", "Library", "ICT", "Hostel", "Sports"];
      let ineligibleDeptsCount = 0;
      deptsToEvaluate.forEach((d) => {
        const result = evaluateDepartment(d, studentId, data);
        if (!result.eligible) {
          ineligibleDeptsCount++;
        }
      });
      outstandingDepts = ineligibleDeptsCount;
    }
    
    let score = 100 - (outstandingDepts * 20) - (ob.totalCount * 5);
    
    // Clamp score to max 49 if any department has rejected the request
    if (hasRejection) {
      score = Math.min(score, 49);
    }
    
    score = Math.max(0, Math.min(100, score));
    
    let label: "Ready" | "Almost Ready" | "Blocked" = "Blocked";
    if (score >= 90) label = "Ready";
    else if (score >= 70) label = "Almost Ready";
    
    return { score, label, outstandingDepts, obligationsCount: ob.totalCount };
  }, [getStudentObligations, loans, fees, assets, hostel, sports]);

  const calculateRecommendation = useCallback((request: ClearanceRequest) => {
    const ob = getStudentObligations(request.studentId);
    const pendingDepts = request.departments.filter(
      (d) => d.department !== "Registrar" && d.status !== "approved"
    ).length;
    
    const score = Math.max(0, Math.min(100, 100 - (pendingDepts * 10) - (ob.totalCount * 5)));
    const action: "APPROVE" | "REJECT" = (score >= 90 && pendingDepts === 0) ? "APPROVE" : "REJECT";
    
    return { score, action };
  }, [getStudentObligations]);

  // Derived KPI Selectors
  const kpiStats = useMemo(() => {
    const total = requests.length;
    const approvedOverall = requests.filter((r) => r.overallStatus === "approved").length;
    
    const awaitingRegistrar = requests.filter((r) => {
      const reg = r.departments.find((d) => d.department === "Registrar");
      return reg && reg.status === "pending";
    }).length;

    // Ready for graduation (active clearance requests with readiness score >= 90)
    const readyForGrad = requests.filter((r) => {
      const read = calculateReadiness(r.studentId, r);
      return read.score >= 90;
    }).length;

    const completionRate = total > 0 ? Math.round((approvedOverall / total) * 100) : 0;

    // Average Clearance Duration (for approved ones)
    const approvedReqs = requests.filter((r) => r.overallStatus === "approved");
    let avgDurationStr = "—";
    if (approvedReqs.length > 0) {
      const totalDuration = approvedReqs.reduce((sum, r) => {
        const start = new Date(r.submittedAt).getTime();
        const end = r.departments.reduce((max, d) => {
          if (!d.reviewedAt) return max;
          const t = new Date(d.reviewedAt).getTime();
          return t > max ? t : max;
        }, start);
        return sum + (end - start);
      }, 0);
      const avgDays = totalDuration / approvedReqs.length / (1000 * 60 * 60 * 24);
      avgDurationStr = avgDays < 1 ? `${Math.round(avgDays * 24)}h` : `${avgDays.toFixed(1)}d`;
    }

    // Students blocked (active requests with readiness score <= 69)
    const blockedCount = requests.filter((r) => {
      const read = calculateReadiness(r.studentId, r);
      return read.score <= 69;
    }).length;

    // Outstanding Obligations Value across the entire university (aggregate all financial liabilities)
    const outstandingVal = 
      fees.reduce((s, f) => s + Number(f.amountDue ?? 0), 0) +
      loans.reduce((s, l) => s + (l.returned ? 0 : Number(l.fineAmount ?? 0)), 0) +
      assets.reduce((s, a) => s + (a.returned ? 0 : Number(a.replacementCost ?? 0)), 0) +
      hostel.reduce((s, h) => s + Number(h.damageFee ?? 0), 0) +
      sports.reduce((s, sp) => s + (sp.returned ? 0 : Number(sp.replacementCost ?? 0)), 0);

    return {
      total,
      readyForGrad,
      awaitingRegistrar,
      certsIssued: approvedOverall,
      completionRate,
      avgDuration: avgDurationStr,
      blockedCount,
      outstandingVal
    };
  }, [requests, calculateReadiness, fees, loans, assets, hostel, sports]);

  // Operational widgets metrics (Queue Intelligence)
  const queueMetrics = useMemo(() => {
    const awaitingReg = requests.filter((r) => r.departments.find((d) => d.department === "Registrar")?.status === "pending");
    const awaitingReview = awaitingReg.length;

    const readyForApproval = awaitingReg.filter((r) => 
      r.departments.every((d) => d.department === "Registrar" || d.status === "approved")
    ).length;

    const blockedCases = requests.filter((r) => r.departments.some((d) => d.status === "rejected")).length;

    const pendingCerts = readyForApproval; // ready requests that just need registrar approval

    return {
      awaitingReview,
      readyForApproval,
      blockedCases,
      pendingCerts
    };
  }, [requests]);

  // Filter and Sort Requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // 1. Text Search
      const matchesSearch = 
        !searchQuery ||
        r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.matricNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.clearanceId.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Status Filter
      const regReview = r.departments.find((d) => d.department === "Registrar");
      const regStatus = regReview?.status ?? "pending";
      const isOthersApproved = r.departments.every((d) => d.department === "Registrar" || d.status === "approved");
      const hasAnyRejected = r.departments.some((d) => d.status === "rejected");
      
      let matchesStatus = true;
      if (statusFilter === "ready") {
        matchesStatus = isOthersApproved && regStatus === "pending";
      } else if (statusFilter === "pending") {
        matchesStatus = regStatus === "pending";
      } else if (statusFilter === "blocked") {
        matchesStatus = hasAnyRejected;
      } else if (statusFilter === "approved") {
        matchesStatus = regStatus === "approved";
      } else if (statusFilter === "rejected") {
        matchesStatus = regStatus === "rejected";
      }

      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      // 3. Sorting
      let valA: any = a.submittedAt;
      let valB: any = b.submittedAt;

      if (sortBy === "name") {
        valA = a.studentName.toLowerCase();
        valB = b.studentName.toLowerCase();
      } else if (sortBy === "clearanceId") {
        valA = a.clearanceId.toLowerCase();
        valB = b.clearanceId.toLowerCase();
      } else if (sortBy === "score") {
        valA = calculateReadiness(a.studentId, a).score;
        valB = calculateReadiness(b.studentId, b).score;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [requests, searchQuery, statusFilter, sortBy, sortOrder, calculateReadiness]);

  // Bulk approvals list (Ready requests ONLY)
  const readyRequestsForBulk = useMemo(() => {
    return requests.filter((r) => 
      r.departments.every((d) => d.department === "Registrar" || d.status === "approved") &&
      r.departments.find((d) => d.department === "Registrar")?.status === "pending"
    );
  }, [requests]);

  const handleSelectAllRows = (checked: boolean) => {
    if (checked) {
      setSelectedRows(readyRequestsForBulk.map((r) => r.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (requestId: string, checked: boolean) => {
    if (checked) {
      setSelectedRows((prev) => [...prev, requestId]);
    } else {
      setSelectedRows((prev) => prev.filter((id) => id !== requestId));
    }
  };

  // Bulk Approve Action
  const handleBulkApprove = async () => {
    if (selectedRows.length === 0) return;
    setBulkApproving(true);
    let successCount = 0;
    
    const toastId = toast.loading(`Approving ${selectedRows.length} clearance requests...`);

    for (const rid of selectedRows) {
      const req = requests.find((r) => r.id === rid);
      if (req) {
        try {
          await store.reviewDepartment(
            req.id,
            "Registrar",
            "approved",
            "Clearance approved via Registrar Operations Center bulk action.",
            user?.name || "Registrar"
          );
          successCount++;
        } catch (e) {
          console.error(`Failed to approve request ${req.clearanceId}:`, e);
        }
      }
    }

    setBulkApproving(false);
    setSelectedRows([]);
    toast.success(`Successfully approved ${successCount} requests.`, { id: toastId });
    try {
      await store.logActivity(
        user?.name || "Registrar",
        `executed bulk approval of ${successCount} requests`
      );
    } catch (err) {
      console.error("Failed to log bulk approval activity", err);
    }
  };

  // Single Approve / Reject Actions
  const handleSingleReview = async (status: "approved" | "rejected") => {
    if (!selectedRequest) return;
    const trimmedRemarks = reviewRemarks.trim();
    
    if (status === "rejected" && !trimmedRemarks) {
      toast.error("Please provide remarks explaining the reason for rejection");
      return;
    }

    const toastId = toast.loading(`Submitting clearance ${status === "approved" ? "approval" : "rejection"}...`);
    try {
      await store.reviewDepartment(
        selectedRequest.id,
        "Registrar",
        status,
        trimmedRemarks || "Academic records and graduation compliance verified.",
        user?.name || "Registrar"
      );
      toast.success(`Clearance request ${status === "approved" ? "approved" : "rejected"} successfully!`, { id: toastId });
      setSelectedRequest(null);
      setReviewRemarks("");
    } catch (e) {
      toast.error("Review submission failed: " + (e as Error).message, { id: toastId });
    }
  };

  // Pipeline funnel calculations - mathematically consistent
  const pipelineStages = useMemo(() => {
    const total = requests.length;
    const totalSafe = total || 1;
    
    // Stage 1: Submitted (All requests)
    const stage1 = total;
    
    // Stage 2: Departments Review (At least one department review excluding Registrar is pending or rejected)
    const stage2 = requests.filter((r) => 
      r.overallStatus !== "approved" &&
      r.departments.some((d) => d.department !== "Registrar" && d.status !== "approved")
    ).length;
    
    // Stage 3: All Departments Approved (All other departments cleared)
    const stage3 = requests.filter((r) => 
      r.departments.every((d) => d.department === "Registrar" || d.status === "approved")
    ).length;
    
    // Stage 4: Registrar Review (All other departments cleared but Registrar is pending)
    const stage4 = requests.filter((r) => 
      r.departments.every((d) => d.department === "Registrar" || d.status === "approved") &&
      r.departments.find((d) => d.department === "Registrar")?.status === "pending"
    ).length;
    
    // Stage 5: Certificate Generated (Overall status approved)
    const stage5 = requests.filter((r) => r.overallStatus === "approved").length;
    
    // Stage 6: Public Verification (Same as approved)
    const stage6 = stage5;
    
    return [
      { name: "Student Submit", count: stage1, pct: Math.round((stage1/totalSafe)*100), color: "border-primary/30 bg-primary/5 text-primary", key: "all" },
      { name: "Dept Reviews", count: stage2, pct: Math.round((stage2/totalSafe)*100), color: "border-warning/30 bg-warning/5 text-warning", key: "pending" },
      { name: "Depts Approved", count: stage3, pct: Math.round((stage3/totalSafe)*100), color: "border-success/30 bg-success/5 text-success", key: "ready" },
      { name: "Registrar Review", count: stage4, pct: Math.round((stage4/totalSafe)*100), color: "border-indigo-500/30 bg-indigo-500/5 text-indigo-400", key: "ready" },
      { name: "Certified Ready", count: stage5, pct: Math.round((stage5/totalSafe)*100), color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400", key: "approved" },
      { name: "Verification", count: stage6, pct: Math.round((stage6/totalSafe)*100), color: "border-teal-500/30 bg-teal-500/5 text-teal-400", key: "approved" }
    ];
  }, [requests]);

  // Analytics tab chart computations
  const lineChartData = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (11 - i));
      const monthLabel = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const count = requests.filter((r) => {
        const rd = new Date(r.submittedAt);
        return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear();
      }).length;
      return { month: monthLabel, requests: count };
    });
  }, [requests]);

  const deptPerformanceData = useMemo(() => {
    return DEPARTMENTS.map((d) => {
      const reviews = requests.flatMap((r) => r.departments.filter((x) => x.department === d));
      return {
        name: d,
        Approved: reviews.filter((x) => x.status === "approved").length,
        Pending: reviews.filter((x) => x.status === "pending").length,
        Rejected: reviews.filter((x) => x.status === "rejected").length,
      };
    });
  }, [requests]);

  const funnelChartData = useMemo(() => {
    const total = requests.length;
    const underReview = requests.filter(r => r.overallStatus === "pending" && !r.departments.every(d => d.department === "Registrar" || d.status === "approved")).length;
    const ready = requests.filter(r => r.departments.every(d => d.department === "Registrar" || d.status === "approved") && r.departments.find(d => d.department === "Registrar")?.status === "pending").length;
    const approved = requests.filter(r => r.overallStatus === "approved").length;
    const certified = approved;
    return [
      { name: "Submitted", count: total, fill: "oklch(0.52 0.22 265)" },
      { name: "Under Review", count: underReview, fill: "oklch(0.78 0.16 75)" },
      { name: "Ready", count: ready, fill: "oklch(0.65 0.18 155)" },
      { name: "Approved", count: approved, fill: "oklch(0.65 0.18 155)" },
      { name: "Certified", count: certified, fill: "oklch(0.65 0.18 155)" },
    ];
  }, [requests]);

  const certIssuanceData = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const monthLabel = d.toLocaleString("default", { month: "short" });
      const count = requests.filter((r) => {
        if (r.overallStatus !== "approved") return false;
        const rd = new Date(r.submittedAt);
        return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear();
      }).length;
      return { month: monthLabel, Certificates: count };
    });
  }, [requests]);

  const pieChartData = useMemo(() => {
    let ready = 0;
    let almostReady = 0;
    let blocked = 0;

    requests.forEach((r) => {
      const info = calculateReadiness(r.studentId, r);
      if (info.score >= 90) ready++;
      else if (info.score >= 70) almostReady++;
      else blocked++;
    });

    return [
      { name: "Ready (90-100)", value: ready, color: "oklch(0.65 0.18 155)" },
      { name: "Almost Ready (70-89)", value: almostReady, color: "oklch(0.78 0.16 75)" },
      { name: "Blocked (0-69)", value: blocked, color: "oklch(0.6 0.23 27)" },
    ];
  }, [requests, calculateReadiness]);

  // Clearance Duration Audit calculations for breakdown modal
  const overallAvgDuration = useMemo(() => {
    const approvedReqs = requests.filter((r) => r.overallStatus === "approved");
    if (approvedReqs.length === 0) return { avgStr: "—", count: 0 };
    const totalDuration = approvedReqs.reduce((sum, r) => {
      const start = new Date(r.submittedAt).getTime();
      const end = r.departments.reduce((max, d) => {
        if (!d.reviewedAt) return max;
        const t = new Date(d.reviewedAt).getTime();
        return t > max ? t : max;
      }, start);
      return sum + (end - start);
    }, 0);
    const avgDays = totalDuration / approvedReqs.length / (1000 * 60 * 60 * 24);
    const avgStr = avgDays < 1 ? `${Math.round(avgDays * 24)}h` : `${avgDays.toFixed(1)}d`;
    return { avgStr, count: approvedReqs.length };
  }, [requests]);

  const deptDurations = useMemo(() => {
    return DEPARTMENTS.map((d) => {
      const reviewedReqs = requests.filter((r) => {
        const rev = r.departments.find((x) => x.department === d);
        return rev && rev.status !== "pending" && rev.reviewedAt;
      });
      if (reviewedReqs.length === 0) return { name: d, avgStr: "—", count: 0 };
      const totalDuration = reviewedReqs.reduce((sum, r) => {
        const rev = r.departments.find((x) => x.department === d)!;
        const start = new Date(r.submittedAt).getTime();
        const end = new Date(rev.reviewedAt!).getTime();
        return sum + Math.max(0, end - start);
      }, 0);
      const avgDays = totalDuration / reviewedReqs.length / (1000 * 60 * 60 * 24);
      const avgStr = avgDays < 1 ? `${Math.round(avgDays * 24)}h` : `${avgDays.toFixed(1)}d`;
      return { name: d, avgStr, count: reviewedReqs.length };
    });
  }, [requests]);

  // Certificate Control Center statistics
  const certCenterStats = useMemo(() => {
    const issued = requests.filter((r) => r.overallStatus === "approved").length;
    const pending = requests.filter((r) => 
      r.departments.every((d) => d.department === "Registrar" || d.status === "approved") &&
      r.departments.find((d) => d.department === "Registrar")?.status === "pending"
    ).length;
    const revoked = 0; // Mock value
    const verificationReqs = activity.filter((a) => a.action.toLowerCase().includes("verify") || a.action.toLowerCase().includes("scan")).length;

    return {
      issued,
      pending,
      revoked,
      verificationReqs
    };
  }, [requests, activity]);

  // Activity Feed tab filtering
  const [activityTypeFilter, setActivityTypeFilter] = useState<"all" | "approval" | "rejection" | "certificate" | "verification">("all");
  const [activitySearch, setActivitySearch] = useState("");

  const filteredActivity = useMemo(() => {
    return activity.filter((act) => {
      const textMatches = 
        !activitySearch ||
        act.actor.toLowerCase().includes(activitySearch.toLowerCase()) ||
        act.action.toLowerCase().includes(activitySearch.toLowerCase()) ||
        (act.target && act.target.toLowerCase().includes(activitySearch.toLowerCase()));

      let typeMatches = true;
      if (activityTypeFilter === "approval") {
        typeMatches = act.action.toLowerCase().includes("approve") || act.action.toLowerCase().includes("cleared");
      } else if (activityTypeFilter === "rejection") {
        typeMatches = act.action.toLowerCase().includes("reject") || act.action.toLowerCase().includes("blocked");
      } else if (activityTypeFilter === "certificate") {
        typeMatches = act.action.toLowerCase().includes("certificate") || act.action.toLowerCase().includes("issued");
      } else if (activityTypeFilter === "verification") {
        typeMatches = act.action.toLowerCase().includes("verify") || act.action.toLowerCase().includes("scan");
      }

      return textMatches && typeMatches;
    });
  }, [activity, activitySearch, activityTypeFilter]);

  // Selection definitions for Dialog & Sheet
  const activeStudentProfile = useMemo(() => {
    if (!selectedStudentId) return null;
    return users.find((u) => u.id === selectedStudentId) || null;
  }, [selectedStudentId, users]);

  const studentDetailsData = useMemo(() => {
    if (!selectedStudentId) return null;
    const ob = getStudentObligations(selectedStudentId);
    const studentRequests = requests.filter((r) => r.studentId === selectedStudentId);
    
    // gather verification activities
    const verHistory = activity.filter(
      (a) => a.target === studentRequests[0]?.clearanceId && (a.action.includes("verify") || a.action.includes("scan"))
    );

    return {
      obligations: ob,
      requests: studentRequests,
      verifications: verHistory
    };
  }, [selectedStudentId, requests, getStudentObligations, activity]);

  // Timeline events for modal
  const clearanceTimelineEvents = useMemo(() => {
    if (!selectedRequest) return [];
    const events: { title: string; desc: string; time?: string; done: boolean; color: string }[] = [];

    // Stage 1
    events.push({
      title: "Request Submitted",
      desc: `Student clearance request submitted for validation.`,
      time: selectedRequest.submittedAt,
      done: true,
      color: "bg-primary"
    });

    // Stage 2
    const totalDepts = selectedRequest.departments.filter(d => d.department !== "Registrar").length;
    const clearedDepts = selectedRequest.departments.filter(d => d.department !== "Registrar" && d.status === "approved").length;
    events.push({
      title: "Department Reviews",
      desc: `${clearedDepts} of ${totalDepts} required departments cleared.`,
      done: clearedDepts > 0,
      color: clearedDepts === totalDepts ? "bg-success" : "bg-warning"
    });

    // Stage 3
    const regReview = selectedRequest.departments.find(d => d.department === "Registrar");
    const regApproved = regReview && regReview.status === "approved";
    events.push({
      title: "Final Registrar Approval",
      desc: regApproved ? `Approved by ${regReview.reviewedBy || "Registrar"}` : "Awaiting Registrar final review.",
      time: regReview?.reviewedAt,
      done: regApproved,
      color: regApproved ? "bg-success" : "bg-muted"
    });

    // Stage 4
    events.push({
      title: "Certificate Generated",
      desc: selectedRequest.overallStatus === "approved" ? "Digital certificate generated and active." : "Locked until final approvals are recorded.",
      done: selectedRequest.overallStatus === "approved",
      color: selectedRequest.overallStatus === "approved" ? "bg-success" : "bg-muted"
    });

    return events;
  }, [selectedRequest]);

  return (
    <AppShell
      title="Registrar Operations Center"
      role="department"
      nav={[
        { to: "/registrar", label: "Operations", icon: <LayoutDashboard className="size-4" /> },
        { to: "/verify", label: "Verify Certificate", icon: <BadgeCheck className="size-4" /> },
      ]}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="glass rounded-xl p-1 flex-wrap h-auto">
          <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
          <TabsTrigger value="approvals" className="rounded-lg">Final Approvals</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg">Analytics</TabsTrigger>
          <TabsTrigger value="activity" className="rounded-lg">Activity</TabsTrigger>
        </TabsList>

        {/* ─────────────────────────────────────────────────────────────────────────
         * TAB 1: OVERVIEW
         * ───────────────────────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => { setStatusFilter("all"); setActiveTab("approvals"); }}
              className="text-left w-full hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer block rounded-2xl"
            >
              <BigStat icon={<FileText className="size-6 text-primary animate-pulse" />} label="Total Requests" value={kpiStats.total} />
            </button>
            <button
              onClick={() => { setStatusFilter("ready"); setActiveTab("approvals"); }}
              className="text-left w-full hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer block rounded-2xl"
            >
              <BigStat icon={<CheckCircle2 className="size-6" />} label="Ready For Graduation" value={kpiStats.readyForGrad} tone="success" />
            </button>
            <button
              onClick={() => { setStatusFilter("pending"); setActiveTab("approvals"); }}
              className="text-left w-full hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer block rounded-2xl"
            >
              <BigStat icon={<Clock className="size-6" />} label="Awaiting Registrar Approval" value={kpiStats.awaitingRegistrar} tone="warning" />
            </button>
            <button
              onClick={() => { setStatusFilter("approved"); setActiveTab("approvals"); }}
              className="text-left w-full hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer block rounded-2xl"
            >
              <BigStat icon={<BadgeCheck className="size-6" />} label="Certificates Issued" value={kpiStats.certsIssued} tone="success" />
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className="text-left w-full hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer block rounded-2xl"
            >
              <BigStat icon={<Percent className="size-6 text-emerald-400 animate-pulse" />} label="Completion Rate" value={`${kpiStats.completionRate}%`} tone="success" />
            </button>
            <button
              onClick={() => setShowDurationModal(true)}
              className="text-left w-full hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer block rounded-2xl"
            >
              <BigStat icon={<Timer className="size-6 text-primary" />} label="Average Duration" value={kpiStats.avgDuration} />
            </button>
            <button
              onClick={() => { setStatusFilter("blocked"); setActiveTab("approvals"); }}
              className="text-left w-full hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer block rounded-2xl"
            >
              <BigStat icon={<AlertTriangle className="size-6 text-destructive" />} label="Students Blocked" value={kpiStats.blockedCount} tone="destructive" />
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className="text-left w-full hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer block rounded-2xl"
            >
              <BigStat
                icon={<Wallet className="size-6 text-destructive animate-pulse" />}
                label="Total University Liabilities"
                value={NGN(kpiStats.outstandingVal)}
                tone="destructive"
                tooltip="Aggregated financial value of all outstanding student obligations: unpaid fees, library fines, ICT asset replacements, hostel damages, and sports kit liabilities across the university."
              />
            </button>
          </div>

          {/* University Clearance Pipeline */}
          <div className="glass-strong rounded-2xl p-6 border border-border/40 space-y-4">
            <div>
              <h3 className="font-display font-semibold text-lg flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" /> University Clearance Pipeline
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">Track real-time student workflow stages from initial request to public credential verification</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
              {pipelineStages.map((stage, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setStatusFilter(stage.key as any);
                    setActiveTab("approvals");
                  }}
                  className={cn(
                    "p-4 rounded-xl border text-left flex flex-col justify-between hover-lift cursor-pointer transition-all duration-200",
                    stage.color
                  )}
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">{stage.name}</span>
                    <div className="font-display font-bold text-xl sm:text-2xl mt-1 tracking-tight">
                      <AnimatedCounter value={stage.count} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs opacity-75 font-semibold">
                    <span>Cohort Split</span>
                    <span>{stage.pct}%</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Certificate Control Center */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 space-y-6 lg:col-span-2">
              <div>
                <h3 className="font-display font-semibold text-lg flex items-center gap-2">
                  <Shield className="size-5 text-indigo-400" /> Certificate Control Center
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">Oversee the issuance, pending authorizations, and security verification logs</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-muted/40 rounded-xl border border-border/20 text-left">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Issued</span>
                  <span className="font-display text-2xl font-bold text-success"><AnimatedCounter value={certCenterStats.issued} /></span>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border/20 text-left">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Pending</span>
                  <span className="font-display text-2xl font-bold text-warning"><AnimatedCounter value={certCenterStats.pending} /></span>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border/20 text-left">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Revoked</span>
                  <span className="font-display text-2xl font-bold text-muted-foreground"><AnimatedCounter value={certCenterStats.revoked} /></span>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl border border-border/20 text-left">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Verifications</span>
                  <span className="font-display text-2xl font-bold text-primary"><AnimatedCounter value={certCenterStats.verificationReqs} /></span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="font-bold text-sm text-indigo-400">Generate Student Digital Certificate</div>
                  <p className="text-xs text-muted-foreground max-w-md font-medium leading-normal">
                    Certificates are cryptographically generated automatically once you sign off final approval. Ready cases can be verified and downloaded instantly.
                  </p>
                </div>
                <Button 
                  onClick={() => { setStatusFilter("ready"); setActiveTab("approvals"); }}
                  className="gradient-bg text-primary-foreground shadow-elegant hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer rounded-xl font-bold text-xs"
                >
                  View Ready Approvals <ChevronRight className="size-4 ml-1.5" />
                </Button>
              </div>
            </div>

            {/* Department Quick Stats */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 space-y-4">
              <h3 className="font-display font-semibold text-base sm:text-lg">Readiness Split</h3>
              <div className="space-y-3">
                {pieChartData.map((e, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20">
                    <div className="flex items-center gap-2 font-semibold text-xs">
                      <div className="size-3 rounded-full" style={{ backgroundColor: e.color }} />
                      <span>{e.name}</span>
                    </div>
                    <span className="font-display font-bold text-base"><AnimatedCounter value={e.value} /></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────────────────────
         * TAB 2: FINAL APPROVALS
         * ───────────────────────────────────────────────────────────────────────── */}
        <TabsContent value="approvals" className="space-y-6">
          
          {/* Registrar Queue Intelligence Widgets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="glass-strong rounded-2xl p-4 border border-border/40 text-left hover-lift">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Awaiting Review</span>
              <span className="font-display text-2xl font-bold text-foreground mt-2 block"><AnimatedCounter value={queueMetrics.awaitingReview} /></span>
              <span className="text-[9px] text-muted-foreground mt-1 block">In Registrar department queue</span>
            </div>
            <div className="glass-strong rounded-2xl p-4 border border-border/40 text-left hover-lift">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Ready For Approval</span>
              <span className="font-display text-2xl font-bold text-success mt-2 block"><AnimatedCounter value={queueMetrics.readyForApproval} /></span>
              <span className="text-[9px] text-muted-foreground mt-1 block">All other departments approved</span>
            </div>
            <div className="glass-strong rounded-2xl p-4 border border-border/40 text-left hover-lift">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Blocked Cases</span>
              <span className="font-display text-2xl font-bold text-destructive mt-2 block"><AnimatedCounter value={queueMetrics.blockedCases} /></span>
              <span className="text-[9px] text-muted-foreground mt-1 block">Any department rejected</span>
            </div>
            <button
              onClick={() => setShowDurationModal(true)}
              className="glass-strong rounded-2xl p-4 border border-border/40 text-left hover-lift cursor-pointer hover:border-primary/50 transition-colors w-full"
            >
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Avg Processing Time</span>
              <span className="font-display text-2xl font-bold text-primary mt-2 block">{kpiStats.avgDuration}</span>
              <span className="text-[9px] text-muted-foreground mt-1 block">Submission to completion</span>
            </button>
            <div className="glass-strong rounded-2xl p-4 border border-border/40 text-left hover-lift col-span-2 sm:col-span-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Certificates Pending</span>
              <span className="font-display text-2xl font-bold text-indigo-400 mt-2 block"><AnimatedCounter value={queueMetrics.pendingCerts} /></span>
              <span className="text-[9px] text-muted-foreground mt-1 block">Awaiting Registrar signature</span>
            </div>
          </div>

          <div className="glass-strong rounded-2xl overflow-hidden border border-border/40">
            {/* Search & Filters */}
            <div className="p-5 border-b border-border/40 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, matric number, or clearance ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 rounded-xl border-border/60 bg-background/50 h-10"
                  />
                </div>
                
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold bg-muted/40 p-1 rounded-xl border">
                    <button
                      onClick={() => setStatusFilter("all")}
                      className={cn("px-2.5 py-1.5 rounded-lg transition-all", statusFilter === "all" ? "bg-background text-foreground shadow-xs font-bold" : "hover:text-foreground")}
                    >All</button>
                    <button
                      onClick={() => setStatusFilter("ready")}
                      className={cn("px-2.5 py-1.5 rounded-lg transition-all", statusFilter === "ready" ? "bg-success/10 text-success shadow-xs font-bold border border-success/20" : "hover:text-foreground")}
                    >Ready</button>
                    <button
                      onClick={() => setStatusFilter("pending")}
                      className={cn("px-2.5 py-1.5 rounded-lg transition-all", statusFilter === "pending" ? "bg-warning/10 text-[oklch(0.5_0.16_75)] dark:text-warning shadow-xs font-bold border border-warning/20" : "hover:text-foreground")}
                    >Pending</button>
                    <button
                      onClick={() => setStatusFilter("blocked")}
                      className={cn("px-2.5 py-1.5 rounded-lg transition-all", statusFilter === "blocked" ? "bg-destructive/10 text-destructive shadow-xs font-bold border border-destructive/20" : "hover:text-foreground")}
                    >Blocked</button>
                    <button
                      onClick={() => setStatusFilter("approved")}
                      className={cn("px-2.5 py-1.5 rounded-lg transition-all", statusFilter === "approved" ? "bg-success/15 text-success shadow-xs font-bold border border-success/20" : "hover:text-foreground")}
                    >Approved</button>
                    <button
                      onClick={() => setStatusFilter("rejected")}
                      className={cn("px-2.5 py-1.5 rounded-lg transition-all", statusFilter === "rejected" ? "bg-destructive/15 text-destructive shadow-xs font-bold border border-destructive/20" : "hover:text-foreground")}
                    >Rejected</button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSortOrder((prev) => prev === "asc" ? "desc" : "asc");
                      }}
                      className="size-10 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-center cursor-pointer"
                      title={`Sort Order: ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
                    >
                      <ArrowUpDown className="size-4" />
                    </button>
                    
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-background/50 border border-border/60 rounded-xl text-xs font-semibold h-10 px-3 outline-none cursor-pointer focus:ring-1 focus:ring-primary"
                    >
                      <option value="date">Sort by Date</option>
                      <option value="score">Sort by Ready Score</option>
                      <option value="name">Sort by Name</option>
                      <option value="clearanceId">Sort by ID</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bulk Actions Banner */}
              {readyRequestsForBulk.length > 0 && (
                <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-4 flex-wrap animate-fade-in">
                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      checked={selectedRows.length === readyRequestsForBulk.length && readyRequestsForBulk.length > 0}
                      onCheckedChange={(checked) => handleSelectAllRows(!!checked)}
                      id="select-all-bulk"
                    />
                    <Label htmlFor="select-all-bulk" className="text-xs font-semibold cursor-pointer">
                      Select all Ready requests for bulk approval ({selectedRows.length} of {readyRequestsForBulk.length} selected)
                    </Label>
                  </div>
                  
                  {selectedRows.length > 0 && (
                    <Button
                      disabled={bulkApproving}
                      onClick={handleBulkApprove}
                      className="gradient-bg text-primary-foreground shadow-elegant h-8 text-xs font-bold hover:scale-[1.01] transition-transform rounded-lg cursor-pointer"
                    >
                      {bulkApproving ? "Processing approvals..." : `Bulk Approve Selected (${selectedRows.length})`}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto relative">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-muted-foreground font-semibold sticky top-0 backdrop-blur-md border-b">
                  <tr>
                    <th className="px-4 py-3.5 w-12 text-center">
                      <Checkbox
                        checked={selectedRows.length === readyRequestsForBulk.length && readyRequestsForBulk.length > 0}
                        onCheckedChange={(checked) => handleSelectAllRows(!!checked)}
                        disabled={readyRequestsForBulk.length === 0}
                      />
                    </th>
                    <th className="px-4 py-3.5 font-bold">Student Details</th>
                    <th className="px-4 py-3.5 font-bold">Clearance ID</th>
                    <th className="px-4 py-3.5 font-bold">Clearance Type</th>
                    <th className="px-4 py-3.5 font-bold text-center">Ready Score</th>
                    <th className="px-4 py-3.5 font-bold">Submitted Date</th>
                    <th className="px-4 py-3.5 font-bold">Registrar Status</th>
                    <th className="px-4 py-3.5 font-bold">Overall Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {!hydrated ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-4 text-center"><Skeleton className="size-4 mx-auto rounded" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-3 w-24" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                      </tr>
                    ))
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground select-none">
                        <Inbox className="size-10 mx-auto text-muted-foreground/35 mb-3" />
                        <div className="font-semibold text-sm">No clearance requests found.</div>
                        <div className="text-xs mt-1">Try resetting the status filters or refining your search.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((r, i) => {
                      const regReview = r.departments.find((d) => d.department === "Registrar");
                      const regStatus = regReview?.status ?? "pending";
                      const readiness = calculateReadiness(r.studentId, r);
                      
                      const isReadyForReg = r.departments.every((d) => d.department === "Registrar" || d.status === "approved") && regStatus === "pending";
                      const isChecked = selectedRows.includes(r.id);

                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedRequest(r)}
                          className={cn(
                            "border-t row-hover-premium cursor-pointer transition-colors duration-150",
                            isChecked && "bg-primary/5 hover:bg-primary/8 text-primary"
                          )}
                        >
                          <td 
                            className="px-4 py-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => handleSelectRow(r.id, !!checked)}
                              disabled={!isReadyForReg}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudentId(r.studentId);
                              }}
                              className="font-bold hover:underline hover:text-primary text-left text-foreground leading-tight"
                            >
                              {r.studentName}
                            </button>
                            <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">{r.matricNo} &middot; {r.program}</div>
                          </td>
                          <td className="px-4 py-4 font-mono font-bold text-xs text-foreground/90">{r.clearanceId}</td>
                          <td className="px-4 py-4 text-xs font-semibold text-muted-foreground">{REQUEST_TYPE_LABEL[r.requestType]}</td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={cn(
                                "font-mono font-bold text-xs",
                                readiness.score >= 90 ? "text-success" : readiness.score >= 70 ? "text-warning" : "text-destructive"
                              )}>{readiness.score}</span>
                              <span className="text-[10px] text-muted-foreground opacity-60">/100</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-muted-foreground font-medium">{new Date(r.submittedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</td>
                          <td className="px-4 py-4"><StatusBadge status={regStatus} /></td>
                          <td className="px-4 py-4"><StatusBadge status={r.overallStatus} /></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────────────────────
         * TAB 3: ANALYTICS
         * ───────────────────────────────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Chart 1: Monthly Clearance Trends */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Monthly Clearance Trends</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <Tooltip contentStyle={GLASS_TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
                  <Line type="monotone" dataKey="requests" stroke="oklch(0.52 0.22 265)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Department Performance */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Departmental Reviews Distribution</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deptPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <Tooltip contentStyle={GLASS_TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 600, paddingBottom: 10 }} />
                  <Bar dataKey="Approved" fill={COLOR_APPROVED} stackId="a" />
                  <Bar dataKey="Pending" fill={COLOR_PENDING} stackId="a" />
                  <Bar dataKey="Rejected" fill={COLOR_REJECTED} stackId="a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 3: Clearance Funnel */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Clearance Pipeline Funnel</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={funnelChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} width={80} />
                  <Tooltip contentStyle={GLASS_TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                    {funnelChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 4: Certificate Issuance Trends */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4">Certificate Issuance Speed (Past 6 Months)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={certIssuanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 500 }} />
                  <Tooltip contentStyle={GLASS_TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
                  <defs>
                    <linearGradient id="colorCert" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLOR_APPROVED} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={COLOR_APPROVED} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="Certificates" stroke={COLOR_APPROVED} strokeWidth={3} fillOpacity={1} fill="url(#colorCert)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 5: Graduation Readiness Distribution */}
            <div className="glass-strong rounded-2xl p-6 border border-border/40 shadow-sm lg:col-span-2 flex flex-col items-center">
              <h3 className="font-display font-semibold text-base sm:text-lg mb-4 w-full text-left">Graduation Readiness Cohort Distribution</h3>
              <div className="w-full flex flex-col md:flex-row items-center justify-around gap-6">
                <ResponsiveContainer width="100%" height={260} className="max-w-[320px]">
                  <PieChart>
                    <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>
                      {pieChartData.map((e, idx) => (
                        <Cell key={idx} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={GLASS_TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="space-y-4 w-full max-w-sm">
                  {pieChartData.map((e, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3.5 border rounded-xl bg-card">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <div className="size-3 rounded-full" style={{ backgroundColor: e.color }} />
                        <span>{e.name}</span>
                      </div>
                      <span className="font-display font-bold text-lg"><AnimatedCounter value={e.value} /> students</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────────────────────
         * TAB 4: ACTIVITY
         * ───────────────────────────────────────────────────────────────────────── */}
        <TabsContent value="activity" className="space-y-6">
          <div className="glass-strong rounded-2xl p-6 border border-border/40 space-y-6">
            <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
              <Activity className="size-5 text-primary animate-pulse" /> Real-time Activity Feed
            </h3>
            <UnifiedActivityFeed items={activity} />
          </div>
        </TabsContent>
      </Tabs>

      {/* ─────────────────────────────────────────────────────────────────────────
       * STUDENT INTELLIGENCE DRAWER (Right Sheet)
       * ───────────────────────────────────────────────────────────────────────── */}
      <Sheet open={!!selectedStudentId} onOpenChange={(o) => !o && setSelectedStudentId(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto custom-scrollbar">
          <SheetHeader>
            <SheetTitle className="font-display text-xl flex items-center gap-2">
              <UsersIcon className="size-5 text-primary" /> Student Intelligence File
            </SheetTitle>
            <SheetDescription className="text-xs">Comprehensive administrative profile and clearance obligations details</SheetDescription>
          </SheetHeader>

          {activeStudentProfile && studentDetailsData && (
            <div className="space-y-6 mt-6">
              {/* Profile Card */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border text-xs">
                <Info label="Full Name" value={activeStudentProfile.name} />
                <Info label="Matric Number" value={activeStudentProfile.matricNo || "—"} />
                <Info label="Admission Number" value={activeStudentProfile.admissionNumber || "—"} />
                <Info label="Program" value={activeStudentProfile.program || "—"} />
                <Info label="Faculty" value={activeStudentProfile.faculty || "—"} />
                <Info label="Level" value={activeStudentProfile.level || "—"} />
                <Info label="Email Address" value={activeStudentProfile.email || "—"} />
                <Info label="Readiness Score" value={`${calculateReadiness(activeStudentProfile.id, studentDetailsData.requests[0]).score}/100`} />
              </div>

              {/* Outstanding Obligations */}
              <div className="space-y-3">
                <h4 className="font-display font-bold text-sm flex items-center gap-2 border-b pb-2">
                  <AlertTriangle className="size-4 text-destructive" /> Outstanding Obligations ({studentDetailsData.obligations.totalCount})
                </h4>
                {studentDetailsData.obligations.totalCount === 0 ? (
                  <div className="p-4 border border-success/30 bg-success/5 text-success rounded-xl flex items-center gap-2 text-xs font-bold">
                    <Check className="size-4 animate-pulse" /> All clear! No outstanding obligations in any department.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {studentDetailsData.obligations.fees.map((f) => (
                      <div key={f.id} className="flex justify-between items-center text-xs p-3 rounded-lg border border-destructive/20 bg-destructive/5 font-semibold">
                        <div>
                          <div className="font-bold text-destructive">Finance Department</div>
                          <div className="text-muted-foreground font-medium mt-0.5">{f.item}</div>
                        </div>
                        <div className="font-mono font-bold text-destructive text-sm">{NGN(f.amountDue)}</div>
                      </div>
                    ))}
                    {studentDetailsData.obligations.loans.map((l) => (
                      <div key={l.id} className="flex justify-between items-center text-xs p-3 rounded-lg border border-destructive/20 bg-destructive/5 font-semibold">
                        <div>
                          <div className="font-bold text-destructive">Library Book Loan</div>
                          <div className="text-muted-foreground font-medium mt-0.5">{l.bookTitle} (Due {new Date(l.dueDate).toLocaleDateString()})</div>
                        </div>
                        {l.fineAmount > 0 && <div className="font-mono font-bold text-destructive text-sm">{NGN(l.fineAmount)}</div>}
                      </div>
                    ))}
                    {studentDetailsData.obligations.assets.map((a) => (
                      <div key={a.id} className="flex justify-between items-center text-xs p-3 rounded-lg border border-destructive/20 bg-destructive/5 font-semibold">
                        <div>
                          <div className="font-bold text-destructive">ICT Asset Assignment</div>
                          <div className="text-muted-foreground font-medium mt-0.5">{a.asset}</div>
                        </div>
                        {a.replacementCost > 0 && <div className="font-mono font-bold text-destructive text-sm">{NGN(a.replacementCost)}</div>}
                      </div>
                    ))}
                    {studentDetailsData.obligations.hostel.map((h) => (
                      <div key={h.id} className="flex justify-between items-center text-xs p-3 rounded-lg border border-destructive/20 bg-destructive/5 font-semibold">
                        <div>
                          <div className="font-bold text-destructive">Hostel Room Checkout</div>
                          <div className="text-muted-foreground font-medium mt-0.5">{h.room} {!h.checkedOut && "· Pending checkout"}</div>
                        </div>
                        {h.damageFee > 0 && <div className="font-mono font-bold text-destructive text-sm">{NGN(h.damageFee)}</div>}
                      </div>
                    ))}
                    {studentDetailsData.obligations.sports.map((s) => (
                      <div key={s.id} className="flex justify-between items-center text-xs p-3 rounded-lg border border-destructive/20 bg-destructive/5 font-semibold">
                        <div>
                          <div className="font-bold text-destructive">Sports Kit Loan</div>
                          <div className="text-muted-foreground font-medium mt-0.5">{s.equipment}</div>
                        </div>
                        {s.replacementCost > 0 && <div className="font-mono font-bold text-destructive text-sm">{NGN(s.replacementCost)}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Clearance History */}
              <div className="space-y-3">
                <h4 className="font-display font-bold text-sm flex items-center gap-2 border-b pb-2">
                  <FileText className="size-4 text-primary" /> Clearance History ({studentDetailsData.requests.length})
                </h4>
                {studentDetailsData.requests.length === 0 ? (
                  <div className="p-6 border rounded-xl text-center text-muted-foreground text-xs bg-muted/10 font-semibold select-none">
                    No requests submitted.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {studentDetailsData.requests.map((r) => (
                      <div key={r.id} className="flex justify-between items-center p-3 rounded-lg border bg-card/50 text-xs font-semibold">
                        <div>
                          <div className="font-bold text-foreground">{REQUEST_TYPE_LABEL[r.requestType]}</div>
                          <div className="text-muted-foreground font-mono font-medium mt-0.5">{r.clearanceId} &middot; {new Date(r.submittedAt).toLocaleDateString()}</div>
                        </div>
                        <StatusBadge status={r.overallStatus} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Verification History */}
              <div className="space-y-3">
                <h4 className="font-display font-bold text-sm flex items-center gap-2 border-b pb-2">
                  <BadgeCheck className="size-4 text-emerald-400" /> Public Verification Logs ({studentDetailsData.verifications.length})
                </h4>
                {studentDetailsData.verifications.length === 0 ? (
                  <div className="p-6 border rounded-xl text-center text-muted-foreground text-xs bg-muted/10 font-semibold select-none">
                    No verification lookups logged.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                    {studentDetailsData.verifications.map((v) => (
                      <div key={v.id} className="p-2.5 rounded-lg border bg-muted/20 text-xs font-medium flex justify-between items-center">
                        <span className="text-muted-foreground">{v.action} by <span className="font-bold text-foreground">{v.actor}</span></span>
                        <span className="font-mono text-[10px] text-muted-foreground">{new Date(v.at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─────────────────────────────────────────────────────────────────────────
       * FINAL APPROVAL MODAL
       * ───────────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center justify-between gap-4 flex-wrap">
              <span>Final Clearance Review</span>
              <span className="font-mono text-sm text-muted-foreground px-2 py-0.5 bg-muted rounded-lg font-bold">{selectedRequest?.clearanceId}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">Authorize or reject graduation e-clearance certificate for the selected student</DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              
              {/* Section 1: Student Profile */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-muted/40 border text-xs">
                <Info label="Student Name" value={selectedRequest.studentName} />
                <Info label="Matric Number" value={selectedRequest.matricNo} />
                <Info label="Admission Number" value={(users.find(u=>u.id===selectedRequest.studentId)||{}).admissionNumber || "—"} />
                <Info label="Program" value={selectedRequest.program} />
                <Info label="Faculty" value={selectedRequest.faculty} />
                <Info label="Level" value={selectedRequest.level} />
                <Info label="Email" value={selectedRequest.email} />
                <Info label="Request Type" value={REQUEST_TYPE_LABEL[selectedRequest.requestType]} />
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Overall Status</span>
                  <StatusBadge status={selectedRequest.overallStatus} />
                </div>
              </div>

              {/* Section 5: Graduation Readiness Assessment */}
              <div className="glass-strong rounded-2xl p-5 border border-border/40 space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h4 className="font-display font-semibold text-sm">Graduation Readiness Assessment</h4>
                  <span className={cn(
                    "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border",
                    calculateReadiness(selectedRequest.studentId, selectedRequest).score >= 90 
                      ? "bg-success/15 text-success border-success/30" 
                      : calculateReadiness(selectedRequest.studentId, selectedRequest).score >= 70
                        ? "bg-warning/15 text-warning border-warning/30"
                        : "bg-destructive/15 text-destructive border-destructive/30"
                  )}>
                    {calculateReadiness(selectedRequest.studentId, selectedRequest).label}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Ready Score Calculation</span>
                    <span className="font-mono text-sm text-foreground">{calculateReadiness(selectedRequest.studentId, selectedRequest).score}%</span>
                  </div>
                  <Progress value={calculateReadiness(selectedRequest.studentId, selectedRequest).score} className="h-2 rounded-full" />
                  <p className="text-[11px] text-muted-foreground leading-normal mt-2 font-medium">
                    * Readiness score is evaluated as `100 - (Outstanding Departments × 20) - (Outstanding Obligations × 5)`. Clamp score between 0 and 100.
                  </p>
                </div>
              </div>

              {/* Recommendation Engine Card */}
              <div className="p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 grid sm:grid-cols-3 gap-4 items-center">
                <div className="sm:col-span-2 space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-indigo-400 font-extrabold flex items-center gap-1.5">
                    <Sparkles className="size-3 animate-pulse" /> Recommendation Engine
                  </div>
                  <div className="text-sm font-bold text-foreground">
                    System Recommendation:{" "}
                    <span className={cn(
                      "font-black underline underline-offset-4",
                      calculateRecommendation(selectedRequest).action === "APPROVE" ? "text-success" : "text-destructive"
                    )}>
                      {calculateRecommendation(selectedRequest).action}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium leading-normal pt-1">
                    Based on academic record audit checklist, outstanding obligations, and department sign-offs.
                  </p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 border border-border/20 text-center">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider block">Confidence</span>
                  <span className="font-display font-extrabold text-2xl text-indigo-400 mt-1 block">
                    {calculateRecommendation(selectedRequest).score}%
                  </span>
                </div>
              </div>

              {/* Section 2: Department Summary */}
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Department reviews summary</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {selectedRequest.departments.map((d) => {
                    const isApproved = d.status === "approved";
                    const isRejected = d.status === "rejected";
                    return (
                      <div key={d.department} className="flex items-center justify-between p-3 rounded-xl border bg-card/30 text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          {isApproved ? (
                            <CheckCircle2 className="size-4 text-success" />
                          ) : isRejected ? (
                            <XCircle className="size-4 text-destructive" />
                          ) : (
                            <Clock className="size-4 text-warning" />
                          )}
                          <span>{d.department}</span>
                        </div>
                        <span className={cn(
                          "capitalize font-bold text-[11px]",
                          isApproved ? "text-success" : isRejected ? "text-destructive" : "text-warning"
                        )}>{d.status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Outstanding Issues */}
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Outstanding Obligations detail</div>
                {getStudentObligations(selectedRequest.studentId).totalCount === 0 ? (
                  <div className="p-3.5 border border-success/30 bg-success/5 text-success rounded-xl text-xs font-bold flex items-center gap-2">
                    <Check className="size-4" /> No outstanding obligations or liabilities blocking approval.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getStudentObligations(selectedRequest.studentId).fees.map((f) => (
                      <div key={f.id} className="flex justify-between items-center text-xs p-3.5 rounded-lg border bg-card font-semibold">
                        <span>Fee Balance: {f.item}</span>
                        <span className="font-mono text-destructive">{NGN(f.amountDue)}</span>
                      </div>
                    ))}
                    {getStudentObligations(selectedRequest.studentId).loans.map((l) => (
                      <div key={l.id} className="flex justify-between items-center text-xs p-3.5 rounded-lg border bg-card font-semibold">
                        <span>Library Loan Overdue: {l.bookTitle}</span>
                        <span className="font-mono text-destructive">{NGN(l.fineAmount)} fine</span>
                      </div>
                    ))}
                    {getStudentObligations(selectedRequest.studentId).assets.map((a) => (
                      <div key={a.id} className="flex justify-between items-center text-xs p-3.5 rounded-lg border bg-card font-semibold">
                        <span>ICT Asset Liability: {a.asset}</span>
                        <span className="font-mono text-destructive">{NGN(a.replacementCost)}</span>
                      </div>
                    ))}
                    {getStudentObligations(selectedRequest.studentId).hostel.map((h) => (
                      <div key={h.id} className="flex justify-between items-center text-xs p-3.5 rounded-lg border bg-card font-semibold">
                        <span>Hostel Room Checkout: {h.room} {!h.checkedOut && "· Pending checkout"}</span>
                        <span className="font-mono text-destructive">{NGN(h.damageFee)} damage</span>
                      </div>
                    ))}
                    {getStudentObligations(selectedRequest.studentId).sports.map((s) => (
                      <div key={s.id} className="flex justify-between items-center text-xs p-3.5 rounded-lg border bg-card font-semibold">
                        <span>Sports Gear Unreturned: {s.equipment}</span>
                        <span className="font-mono text-destructive">{NGN(s.replacementCost)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 4: Clearance Timeline */}
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Clearance Timeline Tracker</div>
                <div className="relative pl-6 border-l border-border ml-2 space-y-4">
                  {clearanceTimelineEvents.map((evt, idx) => (
                    <div key={idx} className="relative text-xs">
                      <div className={cn("absolute -left-9 top-0.5 size-5 rounded-full grid place-items-center text-primary-foreground text-[9px] shadow-sm", evt.color)}>
                        {evt.done ? <Check className="size-2.5 text-foreground dark:text-foreground font-bold" /> : idx + 1}
                      </div>
                      <div className="space-y-0.5">
                        <div className="font-bold text-foreground">{evt.title}</div>
                        <p className="text-muted-foreground text-[10px] leading-normal font-medium">{evt.desc}</p>
                        {evt.time && <span className="text-[9px] text-muted-foreground/80 font-mono mt-0.5 block">{new Date(evt.time).toLocaleString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 6: Certificate Impact Summary */}
              {selectedRequest.overallStatus === "approved" && (
                <div className="p-4 rounded-xl border border-success/30 bg-success/5 text-success text-xs font-semibold flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-0.5">
                    <div className="font-bold">Clearance Certificate Active</div>
                    <p className="text-muted-foreground text-[10px] leading-normal font-medium max-w-sm">
                      This clearance is fully authenticated and registered under cryptographic signature.
                    </p>
                  </div>
                  <Button asChild className="gradient-bg text-primary-foreground shadow-elegant rounded-xl text-xs h-8">
                    <Link to="/verify" search={{ id: selectedRequest.clearanceId }} target="_blank">
                      Verify Certificate <ExternalLink className="size-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              )}

              {/* Single Review Remarks Panel */}
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="review-remarks" className="text-xs font-bold text-muted-foreground uppercase">Remarks / Sign-off Decision Feedback</Label>
                <Textarea
                  id="review-remarks"
                  placeholder="Academic eligibility confirmed. Required signatures validated."
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedRequest(null)}
                  className="rounded-xl border h-10 px-4 text-xs font-bold"
                >
                  Close Detail
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleSingleReview("rejected")}
                  className="rounded-xl h-10 px-4 text-xs font-bold hover:scale-[1.01] transition-transform cursor-pointer"
                >
                  Reject Clearance
                </Button>
                <Button
                  onClick={() => handleSingleReview("approved")}
                  className="gradient-bg text-primary-foreground shadow-elegant rounded-xl h-10 px-5 text-xs font-bold hover:scale-[1.01] transition-transform cursor-pointer"
                >
                  Approve Clearance
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clearance Duration Audit Breakdown Modal */}
      <Dialog open={showDurationModal} onOpenChange={setShowDurationModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Timer className="size-5 text-primary" /> Clearance Duration Audit
            </DialogTitle>
            <DialogDescription className="text-xs">Detailed audit of average processing times overall and across individual university departments</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Overall Average Clearance</span>
                <span className="text-xs text-muted-foreground font-medium">From student submission to final registrar certificate issue</span>
              </div>
              <div className="text-right">
                <span className="font-display text-2xl font-bold text-primary block">{overallAvgDuration.avgStr}</span>
                <span className="text-[10px] text-muted-foreground font-semibold">({overallAvgDuration.count} requests)</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Departmental Breakdowns</span>
              <div className="divide-y divide-border/20 border rounded-xl overflow-hidden bg-card/50">
                {deptDurations.map((d) => (
                  <div key={d.name} className="flex items-center justify-between p-3 text-xs font-semibold">
                    <span className="text-foreground">{d.name} Department</span>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-muted-foreground font-medium">({d.count} reviewed)</span>
                      <span className="font-mono text-foreground font-bold">{d.avgStr}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setShowDurationModal(false)} className="w-full gradient-bg text-primary-foreground shadow-elegant rounded-xl">
                Close Audit Modal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function BigStat({ icon, label, value, tone, tooltip }: { icon: React.ReactNode; label: string; value: number | string; tone?: "success" | "warning" | "destructive"; tooltip?: string }) {
  const toneBgCls = tone === "success" 
    ? "bg-success/15 text-success border border-success/20" 
    : tone === "warning" 
      ? "bg-warning/15 text-warning border border-warning/20" 
      : tone === "destructive" 
        ? "bg-destructive/15 text-destructive border border-destructive/20" 
        : "bg-primary/15 text-primary border border-primary/20";

  const content = (
    <div className="glass-strong rounded-2xl p-5 hover-lift animate-fade-up border border-border/40 shadow-xs hover:border-border/80 transition-all duration-200 text-left h-full">
      <div className="flex items-center justify-between">
        <div className={`size-11 rounded-xl grid place-items-center ${toneBgCls} transition-transform group-hover:scale-110`}>{icon}</div>
      </div>
      <div className="font-display font-bold text-2xl sm:text-3xl mt-4 tracking-tight text-foreground/95 truncate">
        {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-2 flex items-center gap-1.5">
        <span>{label}</span>
        {tooltip && <HelpCircle className="size-3 text-muted-foreground/60 hover:text-muted-foreground shrink-0 cursor-help" />}
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider delayDuration={200}>
        <ShTooltip>
          <TooltipTrigger asChild>
            <div className="h-full w-full">{content}</div>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] bg-popover text-popover-foreground border shadow-md p-2 text-xs leading-normal">
            {tooltip}
          </TooltipContent>
        </ShTooltip>
      </TooltipProvider>
    );
  }

  return content;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</div>
      <div className="font-bold mt-1 text-xs sm:text-sm text-foreground">{value}</div>
    </div>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
