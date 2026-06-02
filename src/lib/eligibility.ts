import {
  Department,
  FeeBalance,
  HostelAssignment,
  IctAsset,
  LibraryLoan,
  SportsLoan,
} from "./types";

export interface ObligationLine {
  label: string;
  detail?: string;
  cost: number;
  blocking: boolean;
}

export interface EligibilityResult {
  department: Department;
  eligible: boolean;
  outstandingCount: number;
  totalCost: number;
  obligations: ObligationLine[];
  recommendation: "approve" | "action_required" | "review";
  summary: string;
}

export interface ObligationData {
  loans: LibraryLoan[];
  fees: FeeBalance[];
  assets: IctAsset[];
  hostel: HostelAssignment[];
  sports: SportsLoan[];
}

export const NGN = (n: number) =>
  "KES " + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

export function evaluateDepartment(
  department: Department,
  studentId: string,
  data: ObligationData,
): EligibilityResult {
  switch (department) {
    case "Library": {
      const mine = data.loans.filter((l) => l.studentId === studentId);
      const obligations: ObligationLine[] = mine.map((l) => ({
        label: l.bookTitle,
        detail: l.returned
          ? `Returned · due ${new Date(l.dueDate).toLocaleDateString()}`
          : `Outstanding · due ${new Date(l.dueDate).toLocaleDateString()}`,
        cost: l.returned ? 0 : l.fineAmount,
        blocking: !l.returned,
      }));
      const outstanding = obligations.filter((o) => o.blocking);
      const totalCost = outstanding.reduce((s, o) => s + o.cost, 0);
      const eligible = outstanding.length === 0;
      return {
        department,
        eligible,
        outstandingCount: outstanding.length,
        totalCost,
        obligations,
        recommendation: eligible ? "approve" : "action_required",
        summary: eligible
          ? "No outstanding books. All library obligations met."
          : `${outstanding.length} book(s) not returned. Fines ${NGN(totalCost)}.`,
      };
    }
    case "Finance": {
      const mine = data.fees.filter((f) => f.studentId === studentId);
      const obligations: ObligationLine[] = mine.map((f) => ({
        label: f.item,
        cost: Number(f.amountDue),
        blocking: Number(f.amountDue) > 0,
      }));
      const totalCost = obligations.reduce((s, o) => s + o.cost, 0);
      const eligible = totalCost === 0;
      return {
        department,
        eligible,
        outstandingCount: obligations.filter((o) => o.blocking).length,
        totalCost,
        obligations,
        recommendation: eligible ? "approve" : "action_required",
        summary: eligible
          ? "All fees fully paid. No outstanding balance."
          : `Outstanding balance of ${NGN(totalCost)} on student account.`,
      };
    }
    case "ICT": {
      const mine = data.assets.filter((a) => a.studentId === studentId);
      const obligations: ObligationLine[] = mine.map((a) => ({
        label: a.asset,
        detail: a.returned ? "Returned" : "Not returned",
        cost: a.returned ? 0 : Number(a.replacementCost),
        blocking: !a.returned,
      }));
      const outstanding = obligations.filter((o) => o.blocking);
      const totalCost = outstanding.reduce((s, o) => s + o.cost, 0);
      const eligible = outstanding.length === 0;
      return {
        department,
        eligible,
        outstandingCount: outstanding.length,
        totalCost,
        obligations,
        recommendation: eligible ? "approve" : "action_required",
        summary: eligible
          ? "All assigned equipment returned in good standing."
          : `${outstanding.length} asset(s) not returned. Replacement liability ${NGN(totalCost)}.`,
      };
    }
    case "Hostel": {
      const mine = data.hostel.filter((h) => h.studentId === studentId);
      if (mine.length === 0) {
        return {
          department,
          eligible: true,
          outstandingCount: 0,
          totalCost: 0,
          obligations: [],
          recommendation: "approve",
          summary: "No hostel assignment on record.",
        };
      }
      const obligations: ObligationLine[] = mine.map((h) => ({
        label: h.room,
        detail: h.checkedOut ? "Checked out" : "Not checked out",
        cost: Number(h.damageFee),
        blocking: !h.checkedOut || Number(h.damageFee) > 0,
      }));
      const outstanding = obligations.filter((o) => o.blocking);
      const totalCost = obligations.reduce((s, o) => s + o.cost, 0);
      const eligible = outstanding.length === 0;
      return {
        department,
        eligible,
        outstandingCount: outstanding.length,
        totalCost,
        obligations,
        recommendation: eligible ? "approve" : "action_required",
        summary: eligible
          ? "Room checked out cleanly. No damages on record."
          : `Pending check-out or ${NGN(totalCost)} in damage charges.`,
      };
    }
    case "Registrar":
      return {
        department,
        eligible: true,
        outstandingCount: 0,
        totalCost: 0,
        obligations: [],
        recommendation: "review",
        summary: "Manual review required for academic standing & records.",
      };
    case "Sports": {
      const mine = data.sports.filter((s) => s.studentId === studentId);
      if (mine.length === 0) {
        return {
          department,
          eligible: true,
          outstandingCount: 0,
          totalCost: 0,
          obligations: [],
          recommendation: "approve",
          summary: "No sports equipment loans on record.",
        };
      }
      const obligations: ObligationLine[] = mine.map((s) => ({
        label: s.equipment,
        detail: s.returned ? "Returned" : "Not returned",
        cost: s.returned ? 0 : Number(s.replacementCost),
        blocking: !s.returned,
      }));
      const outstanding = obligations.filter((o) => o.blocking);
      const totalCost = outstanding.reduce((acc, o) => acc + o.cost, 0);
      const eligible = outstanding.length === 0;
      return {
        department,
        eligible,
        outstandingCount: outstanding.length,
        totalCost,
        obligations,
        recommendation: eligible ? "approve" : "action_required",
        summary: eligible
          ? "All sports equipment returned in good standing."
          : `${outstanding.length} item(s) not returned. Replacement liability ${NGN(totalCost)}.`,
      };
    }
  }
}
