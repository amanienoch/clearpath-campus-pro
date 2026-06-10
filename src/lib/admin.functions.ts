import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { User } from "./types";

type AdminFnPayload<T> = {
  accessToken: string;
  data: T;
};

async function requireAdmin(accessToken: string) {
  if (!accessToken) throw new Error("Unauthorized");

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) throw new Error("Unauthorized");

  const { data: role, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError || !role) throw new Error("Forbidden: admin access required");
  return authData.user;
}

function validateUserInput(u: User) {
  if (!u.name?.trim()) throw new Error("Name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email)) throw new Error("Valid email is required");
  if (!["student", "department", "admin"].includes(u.role)) throw new Error("Invalid role");
  if (u.role === "department" && !u.department) throw new Error("Department is required for department users");
  if (!u.id && (!u.password || u.password.length < 6)) {
    throw new Error("Password must be at least 6 characters for new users");
  }
}

export const secureUpsertUser = createServerFn({
  method: "POST",
})
  .inputValidator((data: AdminFnPayload<User>) => data)
  .handler(async ({ data: payload }: { data: AdminFnPayload<User> }) => {
    await requireAdmin(payload.accessToken);
    const u = payload.data;
    validateUserInput(u);
    let uid = u.id;

    // Check if user exists in auth
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = list?.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());

    if (existingAuthUser) {
      uid = existingAuthUser.id;
      // Update password if provided
      if (u.password && u.password.length >= 6) {
        await supabaseAdmin.auth.admin.updateUserById(uid, {
          password: u.password,
          user_metadata: { name: u.name },
        });
      } else {
        await supabaseAdmin.auth.admin.updateUserById(uid, {
          user_metadata: { name: u.name },
        });
      }
    } else {
      // Create new user in auth
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name },
      });
      if (error) throw error;
      if (!created?.user?.id) throw new Error("Failed to create user");
      uid = created.user.id;
    }

    // Now upsert into profiles
    const matricNo = u.role === "student" ? u.admissionNumber || u.matricNo : u.matricNo;
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: uid,
      name: u.name,
      email: u.email,
      department: u.department ?? null,
      matric_no: matricNo ?? null,
      program: u.program ?? null,
      faculty: u.faculty ?? null,
      level: u.level ?? null,
    });
    if (profileError) throw profileError;

    // And roles (delete existing roles first, then insert to ensure exactly one role)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: uid,
      role: u.role,
    });
    if (roleError) throw roleError;

    // Activity
    await supabaseAdmin.from("activity_logs").insert({
      actor: "Admin",
      action: `${existingAuthUser ? "updated" : "created"} user`,
      target: u.email,
    });

    return { success: true, id: uid };
  });

export const secureDeleteUser = createServerFn({
  method: "POST",
})
  .inputValidator((data: AdminFnPayload<string>) => data)
  .handler(async ({ data: payload }: { data: AdminFnPayload<string> }) => {
    await requireAdmin(payload.accessToken);
    const id = payload.data;
    if (!id) throw new Error("User id is required");
    // Delete roles first
    await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
    // Delete profile
    await supabaseAdmin.from("profiles").delete().eq("id", id);
    // Delete auth user
    await supabaseAdmin.auth.admin.deleteUser(id);
    await supabaseAdmin.from("activity_logs").insert({
      actor: "Admin",
      action: "deleted user",
      target: id,
    });
    return { success: true };
  });
