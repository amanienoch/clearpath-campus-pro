import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isPasswordLongEnough, MIN_PASSWORD_LENGTH } from "./password-validation";
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
  if (u.password && !isPasswordLongEnough(u.password)) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

function getAuthFailureMessage(error: { code?: string; message: string }, action: string): string {
  const code = error.code?.toLowerCase();
  if (
    code === "weak_password" ||
    /weak password|password.{0,30}(?:minimum|at least|too short)/i.test(error.message)
  ) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters and meet the configured password requirements.`;
  }
  if (code === "email_exists" || code === "user_already_exists") {
    return "An account with this email already exists.";
  }
  if (code === "user_not_found") {
    return "The selected account could not be found in Supabase Auth.";
  }
  return `Supabase Auth could not ${action} this account. Please try again or contact support.`;
}

export const secureUpsertUser = createServerFn({
  method: "POST",
})
  .validator((data: AdminFnPayload<User>) => data)
  .handler(async ({ data: payload }: { data: AdminFnPayload<User> }) => {
    await requireAdmin(payload.accessToken);
    const u = payload.data;
    validateUserInput(u);
    let uid = u.id;

    // Check if user exists in auth
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError || !list) {
      throw new Error("Unable to verify the account in Supabase Auth. Please try again.");
    }
    const existingAuthUser = list?.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());

    if (existingAuthUser) {
      uid = existingAuthUser.id;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, {
        user_metadata: { name: u.name },
        ...(u.password ? { password: u.password } : {}),
      });
      if (error) throw new Error(getAuthFailureMessage(error, "update"));
    } else {
      if (!u.password) throw new Error("Password is required for new users.");
      // Create new user in auth
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name },
      });
      if (error) throw new Error(getAuthFailureMessage(error, "create"));
      if (!created?.user?.id) throw new Error("Supabase Auth did not return the new account.");
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
    if (profileError) throw new Error("Supabase Auth was updated, but the user profile could not be saved.");

    // And roles (delete existing roles first, then insert to ensure exactly one role)
    const { error: deleteRoleError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    if (deleteRoleError) throw new Error("The user profile was saved, but the role could not be updated.");
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: uid,
      role: u.role,
    });
    if (roleError) throw new Error("The user profile was saved, but the role could not be updated.");

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
  .validator((data: AdminFnPayload<string>) => data)
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

type SetUserPasswordPayload = {
  accessToken: string;
  userId: string;
  password: string;
};

export const secureSetUserPassword = createServerFn({
  method: "POST",
})
  .validator((data: SetUserPasswordPayload) => data)
  .handler(async ({ data: payload }: { data: SetUserPasswordPayload }) => {
    if (
      !payload ||
      typeof payload.accessToken !== "string" ||
      typeof payload.userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.userId) ||
      typeof payload.password !== "string"
    ) {
      throw new Error("Invalid password update request");
    }
    if (!isPasswordLongEnough(payload.password)) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    await requireAdmin(payload.accessToken);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(payload.userId, {
      password: payload.password,
    });
    if (error) throw new Error(getAuthFailureMessage(error, "update"));

    return { success: true };
  });
