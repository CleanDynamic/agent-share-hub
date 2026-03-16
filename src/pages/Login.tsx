import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    if (isLoggedIn) navigate("/", { replace: true });
  }, [isLoggedIn, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      navigate("/browse");
    } catch (err: any) {
      toast({ title: err.message || "Invalid credentials.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({ title: "Enter your email first.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Sign in
          </Button>
        </form>

        {forgotSent ? (
          <p className="mt-3 text-center text-sm text-green-500">Check your email for a reset link.</p>
        ) : (
          <button
            type="button"
            onClick={handleForgotPassword}
            className="mt-3 block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Forgot password?
          </button>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="text-secondary hover:underline">Create a free account</Link>
        </p>
      </div>
    </div>
  );
}
