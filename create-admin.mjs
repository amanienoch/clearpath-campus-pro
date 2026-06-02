import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Parse .env file manually
const envRaw = fs.readFileSync(".env", "utf8");
const env = {};
envRaw.split("\n").forEach((line) => {
  const match = line.match(/^\s*(VITE_)?(SUPABASE_[A-Z_]+)="?([^"]+)"?/);
  if (match) env[match[1] ? "VITE_" + match[2] : match[2]] = match[3];
});

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const usersToCreate = [
  { name: "Master Admin", email: "admin@university.edu", password: "adminpassword", role: "admin" },
  { name: "ICT Department", email: "ict@university.edu", password: "departmentpassword", role: "department", department: "ICT" },
  { name: "Finance Department", email: "finance@university.edu", password: "departmentpassword", role: "department", department: "Finance" },
  { name: "Library Department", email: "library@university.edu", password: "departmentpassword", role: "department", department: "Library" },
  { name: "Registrar Department", email: "registrar@university.edu", password: "departmentpassword", role: "department", department: "Registrar" },
  { name: "Hostel Department", email: "hostel@university.edu", password: "departmentpassword", role: "department", department: "Hostel" },
  { name: "Sports Department", email: "sports@university.edu", password: "departmentpassword", role: "department", department: "Sports" },
  { name: "Glorian Bana", email: "glorian.bana@university.edu", password: "studentpassword", role: "student", matric_no: "U19/CS/1021", program: "BSc Computer Science", faculty: "Science", level: "400" },
];

async function seed() {
  console.log("Seeding users...");
  for (const u of usersToCreate) {
    let uid;
    // Check if user exists in auth
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = list?.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());

    if (existingAuthUser) {
      uid = existingAuthUser.id;
      console.log(`User ${u.email} already exists in auth. Updating password...`);
      await supabaseAdmin.auth.admin.updateUserById(uid, {
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name },
      });
    } else {
      console.log(`Creating user ${u.email}...`);
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name },
      });
      if (error) {
        console.error(`Error creating auth user ${u.email}:`, error);
        continue;
      }
      uid = created.user.id;
    }

    // Insert into profiles
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: uid,
      name: u.name,
      email: u.email,
      department: u.department ?? null,
      matric_no: u.matric_no ?? null,
      program: u.program ?? null,
      faculty: u.faculty ?? null,
      level: u.level ?? null,
    });
    if (profileError) {
      console.error(`Error inserting profile for ${u.email}:`, profileError);
    }

    // Insert into roles
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: uid, role: u.role },
      { onConflict: "user_id,role" }
    );
    if (roleError) {
      console.error(`Error inserting role for ${u.email}:`, roleError);
    }
    
    console.log(`Successfully seeded ${u.email}`);
  }
  console.log("Done seeding users!");
}

seed().catch(console.error);
