import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: string;
  department?: string | null;
}

/**
 * Validates a user's Supabase JWT access token on the server.
 * Throws an Error if token is missing, expired, or invalid.
 */
export async function requireAuth(accessToken?: string): Promise<{ id: string; email?: string }> {
  if (!accessToken || typeof accessToken !== "string" || accessToken.trim().length === 0) {
    throw new Error("Unauthorized: missing access token");
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken.trim());
  if (authError || !authData?.user) {
    throw new Error("Unauthorized: invalid or expired session");
  }

  return {
    id: authData.user.id,
    email: authData.user.email,
  };
}

/**
 * Ensures the authenticated user possesses the 'admin' role.
 */
export async function requireAdmin(accessToken?: string): Promise<AuthenticatedUser> {
  const authUser = await requireAuth(accessToken);

  const { data: userRole, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", authUser.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError || !userRole) {
    throw new Error("Forbidden: administrator privileges required");
  }

  return {
    id: authUser.id,
    email: authUser.email,
    role: "admin",
  };
}

/**
 * Ensures the authenticated user is either an administrator or a staff member in the Registrar department.
 */
export async function requireRegistrarOrAdmin(accessToken?: string): Promise<AuthenticatedUser> {
  const authUser = await requireAuth(accessToken);

  const { data: adminRole, error: adminRoleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", authUser.id)
    .eq("role", "admin")
    .maybeSingle();

  if (adminRoleError) {
    throw new Error("Unable to verify authorization");
  }

  if (adminRole) {
    return { id: authUser.id, email: authUser.email, role: "admin" };
  }

  const { data: deptRole, error: deptRoleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", authUser.id)
    .eq("role", "department")
    .maybeSingle();

  if (deptRoleError) {
    throw new Error("Unable to verify authorization");
  }

  if (deptRole) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("department")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileError) {
      throw new Error("Unable to verify authorization");
    }

    if (profile?.department?.trim().toLowerCase() === "registrar") {
      return {
        id: authUser.id,
        email: authUser.email,
        role: "department",
        department: "Registrar",
      };
    }
  }

  throw new Error("Forbidden: Registrar or Admin privileges required");
}
