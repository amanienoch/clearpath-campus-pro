import { cn } from "@/lib/utils";
import { ClearanceStatus } from "@/lib/types";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

export function StatusBadge({ status, className }: { status: ClearanceStatus; className?: string }) {
  const map = {
    approved: {
      label: "Approved",
      cls: "bg-success/15 text-success border-success/30",
      icon: <CheckCircle2 className="size-3.5" />,
    },
    rejected: {
      label: "Rejected",
      cls: "bg-destructive/15 text-destructive border-destructive/30",
      icon: <XCircle className="size-3.5" />,
    },
    pending: {
      label: "Pending",
      cls: "bg-warning/15 text-[oklch(0.5_0.16_75)] border-warning/40 dark:text-warning",
      icon: <Clock className="size-3.5" />,
    },
  } as const;
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-transform",
        "animate-scale-in hover:scale-[1.04]",
        s.cls,
        status === "pending" && "pulse-ring",
        className,
      )}
    >
      {s.icon}
      {s.label}
    </span>
  );
}
