import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Supabase auto-exchanges the recovery token in the URL hash for a session
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setValidSession(true);
        setChecking(false);
      }
    });

    // Also check if already in a session (e.g. token already exchanged)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setValidSession(true);
      }
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => navigate("/browse", { replace: true }), 2000);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) return null;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <SeoHead title="Reset Password — NeoScale AI" description="Set a new password for your account." path="/reset-password" noIndex />
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8">
        {!validSession ? (
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-foreground">Invalid or expired link</h1>
            <p className="text-sm text-muted-foreground">
              This password reset link is no longer valid. Please request a new one.
            </p>
            <Button onClick={() => navigate("/login")} className="mt-4">Back to sign in</Button>
          </div>
        ) : success ? (
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-foreground">Password updated ✓</h1>
            <p className="text-sm text-muted-foreground">Redirecting you now…</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  minLength={8}
                  placeholder="Min 8 characters"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Update password
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
