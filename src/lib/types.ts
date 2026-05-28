export type Role = "student" | "department" | "admin";

export const DEPARTMENTS = ["Finance", "Library", "ICT", "Registrar", "Hostel", "Sports"] as const;
export type Department = typeof DEPARTMENTS[number];

export type ClearanceStatus = "pending" | "approved" | "rejected";

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
  password: string;
}

export interface ActivityItem {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
}
