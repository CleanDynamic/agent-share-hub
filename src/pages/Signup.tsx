import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2 } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const afterDownload = searchParams.get("after_download");
  const afterPurchase = searchParams.get("after_purchase");

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"user" | "creator">("user");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [usernameError, setUsernameError] = useState("");

  // Username availability
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (isLoggedIn) navigate("/", { replace: true });
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    const raw = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (raw.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", raw)
        .maybeSingle();
      setUsernameStatus(data ? "taken" : "available");
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setEmailError("");
    setUsernameError("");
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");

    if (!displayName.trim() || !cleanUsername || !email.trim() || password.length < 8) {
      setFormError("Please fill in all fields correctly.");
      return;
    }
    if (usernameStatus === "taken") {
      setUsernameError("That username is already taken. Please choose another.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName.trim(), username: cleanUsername, account_type: accountType },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("already been registered")) {
          setEmailError("An account with this email already exists.");
        } else {
          setFormError(error.message);
        }
        setSubmitting(false);
        return;
      }
      if (!data.user) throw new Error("Signup failed");

      // Update the profile row created by the trigger
      await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          username: cleanUsername,
          account_type: accountType,
          is_creator: accountType === "creator",
        })
        .eq("id", data.user.id);

      toast({ title: "Account created! Welcome to NeoScale AI." });

      if (afterDownload) {
        await supabase.from("ad_impressions").update({ converted: true } as any)
          .eq("content_id", afterDownload)
          .is("user_id", null)
          .is("dismissed_at", null)
          .order("shown_at", { ascending: false })
          .limit(1);
        const { triggerDownload } = await import("@/lib/download");
        triggerDownload(afterDownload, null);
        navigate(`/content/${afterDownload}`);
      } else if (afterPurchase) {
        navigate(`/content/${afterPurchase}`);
      } else {
        navigate("/onboarding");
      }
    } catch (err: any) {
      setFormError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const usernameIcon =
    usernameStatus === "checking" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> :
    usernameStatus === "available" ? <Check className="h-4 w-4 text-green-500" /> :
    usernameStatus === "taken" ? <X className="h-4 w-4 text-destructive" /> : null;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <SeoHead title="Join NeoScale AI" description="Create a free NeoScale AI account." path="/signup" noIndex />
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-foreground">Join NeoScale AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Free to join. Download AI assistants, save your favourites, and follow creators.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <Input
                id="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/\s/g, "")); setUsernameError(""); }}
                placeholder="lowercase, no spaces"
                required
              />
              {usernameIcon && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">{usernameIcon}</span>
              )}
            </div>
            {(usernameStatus === "taken" || usernameError) && (
              <p className="text-xs text-destructive">{usernameError || "That username is already taken. Please choose another."}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); }} required />
            {emailError && (
              <p className="text-xs text-destructive">
                {emailError}{" "}
                <Link to="/login" className="text-secondary hover:underline">Sign in instead?</Link>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="Min 8 characters"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>I want to…</Label>
            <RadioGroup value={accountType} onValueChange={(v) => setAccountType(v as "user" | "creator")} className="space-y-2">
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="user" id="type-user" className="mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-foreground">Discover and use AI assistants</span>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="creator" id="type-creator" className="mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-foreground">Share my work and earn from it</span>
                </div>
              </label>
            </RadioGroup>
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={submitting || usernameStatus === "taken"}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-secondary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
