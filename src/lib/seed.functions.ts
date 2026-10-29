import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "./server-auth";

type Dept = "Finance" | "Library" | "ICT" | "Registrar" | "Hostel" | "Sports";

interface DemoUser {
  id?: string; // optional fixed id
  email: string;
  password: string;
  name: string;
  role: "student" | "department" | "admin";
  department?: Dept;
  matric_no?: string;
  program?: string;
  faculty?: string;
  level?: string;
}

const DEMOS: DemoUser[] = [
  {
    email: "glorian.bana@university.edu",
    password: "student123",
    name: "Glorian Bana",
    role: "student",
    matric_no: "U/2021/CS/0421",
    program: "B.Sc. Computer Science",
    faculty: "Faculty of Science",
    level: "400",
  },
  { email: "finance@university.edu", password: "dept123", name: "Adaeze Okafor", role: "department", department: "Finance" },
  { email: "library@university.edu", password: "dept123", name: "Samuel Eze", role: "department", department: "Library" },
  { email: "ict@university.edu", password: "dept123", name: "Khadija Bello", role: "department", department: "ICT" },
  { email: "registrar@university.edu", password: "dept123", name: "Tunde Adeyemi", role: "department", department: "Registrar" },
  { email: "hostel@university.edu", password: "dept123", name: "Mary Johnson", role: "department", department: "Hostel" },
  { email: "sports@university.edu", password: "dept123", name: "Coach Idris", role: "department", department: "Sports" },
  { email: "admin@university.edu", password: "admin123", name: "Dr. Amaka Nwosu", role: "admin" },
];

export const ensureSeed = createServerFn({ method: "POST" })
  .validator((data: string) => data)
  .handler(async ({ data: accessToken }: { data: string }) => {
    await requireAdmin(accessToken);
    // Idempotency check
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", "admin@university.edu")
    .maybeSingle();
  if (existing) return { seeded: false };

  const idByEmail = new Map<string, string>();

  for (const u of DEMOS) {
    // Try create; if email already exists in auth, look it up
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name },
    });
    let uid = created?.user?.id;
    if (error || !uid) {
      // Find existing user
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const found = list?.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
      if (!found) {
        console.error("Seed: cannot create or find user", u.email, error?.message);
        continue;
      }
      uid = found.id;
    }
    idByEmail.set(u.email, uid);

    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      name: u.name,
      email: u.email,
      department: u.department ?? null,
      matric_no: u.matric_no ?? null,
      program: u.program ?? null,
      faculty: u.faculty ?? null,
      level: u.level ?? null,
    });

    await supabaseAdmin.from("user_roles").upsert(
      { user_id: uid, role: u.role },
      { onConflict: "user_id,role" },
    );
  }

  // Sample requests
  const glorianId = idByEmail.get("glorian.bana@university.edu")!;
  const financeReviewer = "Adaeze Okafor";
  const libraryReviewer = "Samuel Eze";
  const ictReviewer = "Khadija Bello";

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
  const cid = (n: number) => `ECL-${now.getFullYear()}-${1000 + Math.floor(Math.random() * 8999)}`;

  // 1) Glorian's in-progress request
  const r1 = await supabaseAdmin
    .from("clearance_requests")
    .insert({
      clearance_id: cid(1),
      student_id: glorianId,
      student_name: "Glorian Bana",
      matric_no: "U/2021/CS/0421",
      program: "B.Sc. Computer Science",
      faculty: "Faculty of Science",
      level: "400",
      email: "glorian.bana@university.edu",
      reason: "Final year graduation clearance",
      submitted_at: daysAgo(4),
    })
    .select("id")
    .single();
  if (r1.data) {
    await supabaseAdmin.from("dept_reviews").update({
      status: "approved", remarks: "All fees paid in full.", reviewed_by: financeReviewer, reviewed_at: daysAgo(3),
    }).eq("request_id", r1.data.id).eq("department", "Finance");
    await supabaseAdmin.from("dept_reviews").update({
      status: "approved", remarks: "No outstanding books.", reviewed_by: libraryReviewer, reviewed_at: daysAgo(3),
    }).eq("request_id", r1.data.id).eq("department", "Library");
    await supabaseAdmin.from("dept_reviews").update({
      status: "approved", remarks: "Lab equipment returned.", reviewed_by: ictReviewer, reviewed_at: daysAgo(2),
    }).eq("request_id", r1.data.id).eq("department", "ICT");
  }

  // Sample requests for other students (fake student_ids — fine, no FK)
  const others = [
    {
      sid: crypto.randomUUID(),
      name: "Chinedu Obi", matric: "U/2021/EE/0118", prog: "B.Eng Electrical Engineering",
      fac: "Faculty of Engineering", lvl: "400", email: "chinedu.obi@university.edu",
      reason: "Final year clearance", days: 7,
      reviews: [
        { d: "Finance", s: "approved", r: "Cleared.", by: financeReviewer },
        { d: "Library", s: "rejected", r: "Outstanding book: Signals & Systems.", by: libraryReviewer },
      ] as { d: Dept; s: string; r: string; by: string }[],
    },
    {
      sid: crypto.randomUUID(),
      name: "Fatima Yusuf", matric: "U/2020/LAW/0902", prog: "LL.B Law",
      fac: "Faculty of Law", lvl: "500", email: "fatima.yusuf@university.edu",
      reason: "Transfer clearance", days: 2, reviews: [],
    },
    {
      sid: crypto.randomUUID(),
      name: "Emeka Okonkwo", matric: "U/2022/MED/0233", prog: "MBBS Medicine",
      fac: "Faculty of Medicine", lvl: "300", email: "emeka.o@university.edu",
      reason: "Inter-faculty transfer", days: 1, reviews: [],
    },
  ];
  for (const o of others) {
    const r = await supabaseAdmin.from("clearance_requests").insert({
      clearance_id: cid(2),
      student_id: o.sid,
      student_name: o.name,
      matric_no: o.matric,
      program: o.prog,
      faculty: o.fac,
      level: o.lvl,
      email: o.email,
      reason: o.reason,
      submitted_at: daysAgo(o.days),
    }).select("id").single();
    if (r.data) {
      for (const rv of o.reviews) {
        await supabaseAdmin.from("dept_reviews").update({
          status: rv.s as "approved" | "rejected" | "pending",
          remarks: rv.r,
          reviewed_by: rv.by,
          reviewed_at: daysAgo(o.days - 1),
        }).eq("request_id", r.data.id).eq("department", rv.d);
      }
    }
  }

  return { seeded: true };
});
