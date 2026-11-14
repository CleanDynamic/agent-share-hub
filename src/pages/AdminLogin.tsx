import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AUTH_MESSAGES } from "@/lib/auth/authMessages";
import { signInWithEmail } from "@/lib/auth/signInWithEmail";
import { useTurnstile } from "@/lib/auth/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { SeoHead } from "@/components/SeoHead";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const captcha = useTurnstile();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // D3: the same email-only sign-in and the same invisible bot check as the dialog.
    if (!email.includes("@")) {
      setError("Sign in with your email address.");
      setLoading(false);
      return;
    }
    const check = await captcha.token();
    if (check.failed) {
      captcha.reset();
      setError(AUTH_MESSAGES.captcha);
      setLoading(false);
      return;
    }
    const result = await signInWithEmail(email, password, check.token).finally(() => captcha.reset());

    if (result.outcome !== "signed-in") {
      setError(
        result.outcome === "refused" && result.refusal === "captcha" ? AUTH_MESSAGES.captcha : "Invalid email or password. Please try again.",
      );
      setLoading(false);
      return;
    }

    navigate("/admin");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <SeoHead title="Admin Login" description="Admin login." path="/admin/login" noIndex />
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Admin Sign In</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to access the admin panel.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-card border-border rounded-xl"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-card border-border rounded-xl"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
