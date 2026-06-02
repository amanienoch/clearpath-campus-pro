import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PROGRAMS = [
  "Computer Science",
  "Information Technology",
  "Software Engineering",
  "Business Information Systems",
  "Accounting",
  "Procurement",
  "Nursing",
  "Education",
];

const EAST_AFRICAN_FIRST = [
  "James", "Joseph", "Mercy", "Amina", "Khadija", "John", "Peter", "Grace", "Fatima", "Samson",
  "Daniel", "Patrick", "Esther", "Brian", "Mark", "Susan", "Lillian", "Mary", "Michael", "David",
  "Josephine", "Emmanuel", "Victor", "Irene", "Linda",
];

const EAST_AFRICAN_LAST = [
  "Njoroge", "Bana", "Okafor", "Eze", "Bello", "Adeyemi", "Johnson", "Yusuf", "Obi", "Okonkwo",
  "Mwangi", "Kagwa", "Kato", "Mkwawa", "Katosi", "Achieng", "Otieno", "Mugabe", "Ngugi", "Mugisha",
];

function rand<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const generateDemoData = createServerFn({ method: "POST" }).handler(async () => {
  // Idempotency: if any profile with matric_no starting with 122 exists, do not run
  const { data: existing } = await supabaseAdmin.from("profiles").select("id").ilike("matric_no", "122%").limit(1);
  if (existing && existing.length > 0) return { seeded: false, reason: "already_seeded" };

  const createdStudents: string[] = [];
  const createdObligations: { fees: number; loans: number; ict: number; hostel: number; sports: number } = { fees: 0, loans: 0, ict: 0, hostel: 0, sports: 0 };
  const createdRequests: number[] = [];

  const now = new Date();

  for (let i = 0; i < 60; i++) {
    const admission = (122000 + i).toString();
    const email = `${admission}@students.university.edu`;
    const name = `${rand(EAST_AFRICAN_FIRST)} ${rand(EAST_AFRICAN_LAST)}`;
    const program = rand(PROGRAMS);
    const year = (Math.floor(Math.random() * 4) + 1).toString();

    // Create or find auth user
    let uid: string | undefined;
    try {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const found = list?.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
      if (found) {
        uid = found.id;
      } else {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: admission,
          email_confirm: true,
          user_metadata: { name },
        });
        if (error) {
          // skip this user on error
          console.error("createUser error", email, error.message);
          continue;
        }
        uid = created.user.id;
      }
    } catch (e) {
      console.error("auth error", e?.message ?? e);
      continue;
    }

    // profiles
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      name,
      email,
      matric_no: admission,
      program,
      faculty: "Faculty of Science",
      level: year,
    });

    // role
    await supabaseAdmin.from("user_roles").upsert({ user_id: uid, role: "student" }, { onConflict: "user_id,role" });

    createdStudents.push(uid);

    // Random obligations
    // Finance: 30% chance
    if (Math.random() < 0.3) {
      const amounts = [3500, 5000, 12000, 25000];
      const amt = rand(amounts);
      await supabaseAdmin.from("fee_balances").insert({ student_id: uid, item: "Tuition arrears", amount_due: amt });
      createdObligations.fees += 1;
    }

    // Library: 25% chance
    if (Math.random() < 0.25) {
      const books = ["Database Systems", "Java Programming", "Operating Systems", "Computer Networks"];
      const title = rand(books);
      const due = new Date(now.getTime() - Math.floor(Math.random() * 20) * 86400000).toISOString();
      await supabaseAdmin.from("library_loans").insert({ student_id: uid, book_title: title, due_date: due, fine_amount: Math.random() < 0.5 ? 0 : 200, returned: Math.random() < 0.5 });
      createdObligations.loans += 1;
    }

    // ICT: 10% chance
    if (Math.random() < 0.1) {
      const assets = ["Dell Latitude", "HP EliteBook", "Router", "Projector"];
      const asset = rand(assets);
      const cost = Math.floor(Math.random() * 70000) + 20000;
      await supabaseAdmin.from("ict_assets").insert({ student_id: uid, asset, replacement_cost: cost, returned: Math.random() < 0.6 });
      createdObligations.ict += 1;
    }

    // Hostel: 8% chance
    if (Math.random() < 0.08) {
      const room = `H-${Math.floor(Math.random() * 10) + 1}${String.fromCharCode(65 + Math.floor(Math.random() * 6))}`;
      const damage = Math.random() < 0.3 ? Math.floor(Math.random() * 5000) + 1000 : 0;
      await supabaseAdmin.from("hostel_assignments").insert({ student_id: uid, room, damage_fee: damage, checked_out: Math.random() < 0.3 });
      createdObligations.hostel += 1;
    }

    // Sports: 12% chance
    if (Math.random() < 0.12) {
      const kits = ["Football Kit", "Basketball Jersey", "Training Equipment"];
      const item = rand(kits);
      await supabaseAdmin.from("sports_loans").insert({ student_id: uid, item, returned: Math.random() < 0.5 });
      createdObligations.sports += 1;
    }

    // Some students get a clearance request (40% chance)
    if (Math.random() < 0.4) {
      const clearanceId = `ECL-${now.getFullYear()}-${122000 + i}`;
      const { data: r } = await supabaseAdmin.from("clearance_requests").insert({
        clearance_id: clearanceId,
        student_id: uid,
        student_name: name,
        matric_no: admission,
        program,
        faculty: "Faculty of Science",
        level: year,
        email,
        reason: "Graduation clearance",
        submitted_at: new Date(now.getTime() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
      }).select('id').single();
      if (r && r.id) {
        // Randomly approve some dept reviews
        const randStatus = Math.random();
        if (randStatus < 0.6) {
          // approve all
          await supabaseAdmin.from('dept_reviews').update({ status: 'approved', remarks: 'Cleared', reviewed_by: 'System' }).eq('request_id', r.id);
        } else if (randStatus < 0.85) {
          // some pending
        } else {
          // reject one dept
          await supabaseAdmin.from('dept_reviews').update({ status: 'rejected', remarks: 'Outstanding issue', reviewed_by: 'System' }).eq('request_id', r.id).limit(1);
        }
        createdRequests.push(1);
      }
    }
  }

  // Log activity so we know seeding was run
  await supabaseAdmin.from('activity_logs').insert({ actor: 'System', action: 'demo_seed', target: `created ${createdStudents.length} students` });

  return {
    seeded: true,
    studentsCreated: createdStudents.length,
    obligations: createdObligations,
    requestsCreated: createdRequests.length,
  };
});
