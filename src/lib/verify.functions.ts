import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ClearanceStatus, Department } from "./types";

export interface VerificationResult {
  found: boolean;
  clearanceId: string;
  studentName?: string;
  matricNo?: string;
  program?: string;
  faculty?: string;
  submittedAt?: string;
  overallStatus?: ClearanceStatus;
  departments?: Department[];
  isMostRecent?: boolean;
}

export const verifyClearanceCertificate = createServerFn({ method: "POST" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: rawId }: { data: string }): Promise<VerificationResult> => {
    const clearanceId = rawId.trim().toUpperCase();
    if (!clearanceId) return { found: false, clearanceId: "" };
    if (!/^ECL-\d{4}-\d{4}$/.test(clearanceId)) {
      return { found: false, clearanceId };
    }

    const { data: request, error } = await supabaseAdmin
      .from("clearance_requests")
      .select("id, clearance_id, student_id, student_name, matric_no, program, faculty, submitted_at, overall_status, request_type")
      .eq("clearance_id", clearanceId)
      .maybeSingle();

    if (error) throw error;
    if (!request) return { found: false, clearanceId };

    // Log verification activity!
    await supabaseAdmin.from("activity_logs").insert({
      actor: "Verification System",
      action: `verified certificate`,
      target: clearanceId,
    });

    const { data: newerApproved, error: newerError } = await supabaseAdmin
      .from("clearance_requests")
      .select("id")
      .eq("student_id", request.student_id)
      .eq("request_type", request.request_type)
      .eq("overall_status", "approved")
      .gt("submitted_at", request.submitted_at)
      .limit(1);

    if (newerError) throw newerError;

    const { data: reviews, error: reviewsError } = await supabaseAdmin
      .from("dept_reviews")
      .select("department, status")
      .eq("request_id", request.id)
      .eq("status", "approved");

    if (reviewsError) throw reviewsError;

    return {
      found: true,
      clearanceId: request.clearance_id,
      studentName: request.student_name,
      matricNo: request.matric_no,
      program: request.program,
      faculty: request.faculty,
      submittedAt: request.submitted_at,
      overallStatus: request.overall_status,
      departments: (reviews ?? []).map((r) => r.department as Department),
      isMostRecent: !newerApproved || newerApproved.length === 0,
    };
  });

export const resolveMatricToEmail = createServerFn({ method: "POST" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: matricNo }: { data: string }): Promise<string | null> => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("matric_no", matricNo)
      .maybeSingle();
    return profile?.email ?? null;
  });

export const getRegistrarObligations = createServerFn({ method: "POST" })
  .handler(async (): Promise<{
    fees: any[];
    loans: any[];
    assets: any[];
    hostel: any[];
    sports: any[];
  }> => {
    const [fees, loans, assets, hostel, sports] = await Promise.all([
      supabaseAdmin.from("fee_balances").select("*"),
      supabaseAdmin.from("library_loans").select("*"),
      supabaseAdmin.from("ict_assets").select("*"),
      supabaseAdmin.from("hostel_assignments").select("*"),
      supabaseAdmin.from("sports_loans").select("*"),
    ]);

    return {
      fees: fees.data ?? [],
      loans: loans.data ?? [],
      assets: assets.data ?? [],
      hostel: hostel.data ?? [],
      sports: sports.data ?? [],
    };
  });
