import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { User } from "./types";

export const secureUpsertUser = createServerFn({
  method: "POST",
})
  .handler(async ({ data: u }: { data: User }) => {
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
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: uid,
      name: u.name,
      email: u.email,
      department: u.department ?? null,
      matric_no: u.matricNo ?? null,
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
      action: "saved user",
      target: u.email,
    });

    return { success: true, id: uid };
  });

export const secureDeleteUser = createServerFn({
  method: "POST",
})
  .handler(async ({ data: id }: { data: string }) => {
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
