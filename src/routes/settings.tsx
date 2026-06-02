import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { authStore, useAuthUser, usePasswordChangeRequired } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, KeyRound, CheckCircle2, LayoutDashboard, BadgeCheck } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Account Settings — E-Clearance" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const user = useAuthUser();
  const navigate = useNavigate();
  const passwordChangeRequired = usePasswordChangeRequired();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) {
    return null;
  }

  // Define nav links dynamically based on user role
  const navLinks =
    user.role === "student"
      ? [
          { to: "/student", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
          { to: "/verify", label: "Verify Certificate", icon: <BadgeCheck className="size-4" /> },
        ]
      : user.role === "admin"
        ? [
            { to: "/admin", label: "Overview", icon: <LayoutDashboard className="size-4" /> },
            { to: "/verify", label: "Verify Certificate", icon: <BadgeCheck className="size-4" /> },
          ]
        : [
            { to: "/department", label: "Queue", icon: <LayoutDashboard className="size-4" /> },
          ];

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      return toast.error("All password fields are required");
    }

    if (newPassword.length < 6) {
      return toast.error("New password must be at least 6 characters long");
    }

    if (newPassword !== confirmPassword) {
      return toast.error("New passwords do not match");
    }

    setLoading(true);
    try {
      // Supabase auth update password along with setting metadata flag
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { password_changed: true },
      });

      if (error) {
        throw error;
      }

      toast.success("Password updated successfully!");
      
      // Clear forms
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Update store state
      authStore.setPasswordChangeRequired(false);

      // Redirect student to their dashboard
      if (user.role === "student") {
        navigate({ to: "/student" });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Account Settings" role={user.role} nav={navLinks}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="font-display font-semibold text-xl sm:text-2xl">Security Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your account credentials and security preferences.</p>
        </div>

        {passwordChangeRequired && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 space-y-3 animate-fade-up">
            <div className="flex items-center gap-2 text-warning font-bold text-sm">
              <ShieldAlert className="size-5 animate-pulse" />
              <span>Change Password Required</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
              You are currently using your default temporary credentials. To unlock access to the E-Clearance dashboard and student portal services, you must change your password.
            </p>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="glass-strong rounded-2xl p-6 border border-border/40 space-y-5 animate-fade-up">
          <div className="flex items-center gap-2 border-b border-border/30 pb-3 mb-2">
            <KeyRound className="size-4.5 text-primary" />
            <h3 className="font-semibold text-sm">Change Password</h3>
          </div>

          <div className="space-y-4">
            {/* Supabase auth updateUser doesn't strictly enforce currentPassword check client-side, but standard security forms require it */}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password (optional)</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="gradient-bg text-primary-foreground shadow-elegant h-10 hover:scale-[1.01] transition-transform"
            >
              {loading ? "Updating…" : "Update Password"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
