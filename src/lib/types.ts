export type Role = "student" | "department" | "admin";

export const DEPARTMENTS = ["Finance", "Library", "ICT", "Registrar", "Hostel", "Sports"] as const;
export type Department = typeof DEPARTMENTS[number];

export type ClearanceStatus = "pending" | "approved" | "rejected";

export const REQUEST_TYPES = ["library", "finance", "ict", "hostel", "general", "graduation"] as const;
export type RequestType = typeof REQUEST_TYPES[number];

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  library: "Library Clearance",
  finance: "Finance Clearance",
  ict: "ICT Clearance",
  hostel: "Hostel Clearance",
  general: "General Clearance",
  graduation: "Graduation Clearance",
};

export const REQUEST_TYPE_DEPARTMENTS: Record<RequestType, Department[]> = {
  library: ["Library"],
  finance: ["Finance"],
  ict: ["ICT"],
  hostel: ["Hostel"],
  general: ["Finance", "Library", "Registrar"],
  graduation: ["Finance", "Library", "ICT", "Registrar", "Hostel", "Sports"],
};

export interface DeptStatus {
  department: Department;
  status: ClearanceStatus;
  remarks?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ClearanceRequest {
  id: string;
  clearanceId: string;
  studentId: string;
  studentName: string;
  matricNo: string;
  program: string;
  faculty: string;
  level: string;
  email: string;
  submittedAt: string;
  reason: string;
  requestType: RequestType;
  departments: DeptStatus[];
  overallStatus: ClearanceStatus;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: Department;
  matricNo?: string;
  program?: string;
  faculty?: string;
  level?: string;
  admissionNumber?: string;
  password: string;
}

export interface ActivityItem {
  id: string;
  timestamp: string; // db 'at'
  actor: string;
  actorRole: string;
  department?: string;
  action: string;
  target?: string;
  clearanceId?: string;
  status?: "approved" | "rejected" | "pending" | "info";
}

// --- Obligations ---
export interface LibraryLoan {
  id: string;
  studentId: string;
  bookTitle: string;
  dueDate: string;
  returned: boolean;
  fineAmount: number;
}
export interface FeeBalance {
  id: string;
  studentId: string;
  item: string;
  amountDue: number;
}
export interface IctAsset {
  id: string;
  studentId: string;
  asset: string;
  returned: boolean;
  replacementCost: number;
}
export interface HostelAssignment {
  id: string;
  studentId: string;
  room: string;
  checkedOut: boolean;
  damageFee: number;
}
export interface SportsLoan {
  id: string;
  studentId: string;
  equipment: string;
  returned: boolean;
  replacementCost: number;
}
