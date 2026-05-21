import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X } from "lucide-react";
import { checkUsernameAvailability } from "@/lib/auth/checkUsernameAvailability";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

/**
 * Profile completion step for first-time OAuth users — collects the display
 * name and username that an email signup would have provided up front.
 */
export default function OnboardingProfile() {
  const navigate = useNavigate();
  const { user, profile, loading, isLoggedIn, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameHint, setUsernameHint] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0);

  // Access / completion guards.
  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn) {
      navigate("/login", { replace: true });
      return;
    }
    if (profile?.display_name && profile?.username) {
      navigate("/onboarding", { replace: true });
    }
  }, [loading, isLoggedIn, profile, navigate]);

  // Prefill from the OAuth provider's metadata.
  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const pickString = (v: unknown): string => (typeof v === "string" ? v : "");

    const name = pickString(meta.full_name) || pickString(meta.name);
    if (name) setDisplayName((d) => d || name);

    const emailPrefix = (user.email || "").split("@")[0] || "";
    const seed = (
      pickString(meta.user_name) ||
      pickString(meta.preferred_username) ||
      emailPrefix
    )
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    if (seed) setUsername((u) => u || seed);
  }, [user]);

  const handleUsernameChange = (value: string) => {
    const next = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(next);
    setError("");
    setUsernameHint("");
    clearTimeout(debounce.current);

    if (!next) {
      setUsernameStatus("idle");
      return;
    }
    if (next.length < 3) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    const current = ++seq.current;
    debounce.current = setTimeout(async () => {
      const { available, suggestion } = await checkUsernameAvailability(next);
      if (current !== seq.current) return;
      if (available) {
        setUsernameStatus("available");
      } else {
        setUsernameStatus("taken");
        if (suggestion) setUsernameHint(`Try "${suggestion}".`);
      }
    }, 400);
  };

  const handleSave = async () => {
    if (!user) return;
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanName || cleanUsername.length < 3) {
      setError("Enter a display name and a username of at least 3 characters.");
      return;
    }
    if (usernameStatus === "taken" || usernameStatus === "invalid") {
      setError("Please choose an available username.");
      return;
    }

    setSaving(true);
    setError("");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: cleanName, username: cleanUsername })
      .eq("id", user.id);

    if (updateError) {
      setSaving(false);
      setError(
        updateError.message.toLowerCase().includes("duplicate")
          ? "That username is already taken."
          : "Could not save your profile. Please try again.",
      );
      return;
    }

    await refreshProfile();
    navigate("/onboarding", { replace: true });
  };

  if (loading) return null;

  const usernameIcon =
    usernameStatus === "checking" ? (
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    ) : usernameStatus === "available" ? (
      <Check className="h-4 w-4 text-green-500" />
    ) : usernameStatus === "taken" || usernameStatus === "invalid" ? (
      <X className="h-4 w-4 text-destructive" />
    ) : null;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <SeoHead
        title="Complete your profile — NeoScale"
        description="Finish setting up your NeoScale account."
        path="/onboarding/profile"
        noIndex
      />
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-foreground">Finish your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a display name and username so people can find you.
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setError("");
              }}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <Input
                id="username"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="username"
              />
              {usernameIcon && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">{usernameIcon}</span>
              )}
            </div>
            {usernameStatus === "invalid" && (
              <p className="text-xs text-destructive">
                Username must be at least 3 characters.
              </p>
            )}
            {usernameStatus === "taken" && (
              <p className="text-xs text-destructive">
                That username is taken. {usernameHint}
              </p>
            )}
            {usernameStatus === "available" && (
              <p className="text-xs text-green-500">Username available</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={handleSave}
            disabled={saving || usernameStatus === "checking"}
            className="w-full"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
