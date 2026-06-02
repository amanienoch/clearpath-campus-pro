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
  .handler(async ({ data: rawId }: { data: string }): Promise<VerificationResult> => {
    const clearanceId = rawId.trim().toUpperCase();
    if (!clearanceId) return { found: false, clearanceId: "" };
    if (!/^ECL-\d{4}-\d{4}$/.test(clearanceId)) {
      return { found: false, clearanceId };
    }

    const { data: request, error } = await supabaseAdmin
      .from("clearance_requests")
      .select("id, clearance_id, student_id, student_name, matric_no, program, faculty, submitted_at, overall_status")
      .eq("clearance_id", clearanceId)
      .maybeSingle();

    if (error) throw error;
    if (!request) return { found: false, clearanceId };

    const { data: latest, error: latestError } = await supabaseAdmin
      .from("clearance_requests")
      .select("id")
      .eq("student_id", request.student_id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw latestError;

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
      isMostRecent: latest?.id === request.id,
    };
  });
