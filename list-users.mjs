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

async function listUsers() {
  console.log("Fetching users from auth...");
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    console.error("Error listing users:", error);
    return;
  }

  console.log(`Found ${users.length} users in auth:`);
  for (const u of users) {
    const { data: profile } = await supabaseAdmin.from("profiles").select("*").eq("id", u.id).maybeSingle();
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", u.id);
    
    console.log(`- Email: ${u.email}`);
    console.log(`  ID: ${u.id}`);
    console.log(`  Name: ${profile?.name || u.user_metadata?.name || "N/A"}`);
    console.log(`  Roles: ${roles?.map(r => r.role).join(", ") || "None"}`);
    if (profile?.department) console.log(`  Department: ${profile.department}`);
    if (profile?.matric_no) console.log(`  Matric No: ${profile.matric_no}`);
  }
}

listUsers().catch(console.error);
