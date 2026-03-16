import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApprovedToolNames } from "@/hooks/useApprovedTools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check } from "lucide-react";

const USE_CASES = ["Social Media", "Research", "Business", "Productivity", "Content", "Learning", "Email", "Finance"];

export default function Onboarding() {
  const { isLoggedIn, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { data: AI_TOOLS } = useApprovedToolNames();
  const [step, setStep] = useState(1);
  const [interests, setInterests] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isLoggedIn) navigate("/login", { replace: true });
  }, [loading, isLoggedIn, navigate]);

  const toggle = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  async function saveStep1() {
    if (!profile) return;
    setSaving(true);
    await supabase.from("profiles").update({ user_interests: interests } as any).eq("id", profile.id);
    setSaving(false);
    setStep(2);
  }

  async function saveStep2() {
    if (!profile) return;
    setSaving(true);
    await supabase.from("profiles").update({ user_ai_tools: tools } as any).eq("id", profile.id);
    setSaving(false);
    setStep(3);
  }

  async function finishUser() {
    navigate("/browse");
  }

  async function finishCreator() {
    if (!profile) return;
    setSaving(true);
    await supabase.from("profiles").update({
      bio: bio.trim() || null,
      website_url: website.trim() || null,
      twitter_handle: twitter.trim() || null,
    } as any).eq("id", profile.id);
    await refreshProfile();
    setSaving(false);
    navigate(`/creator/${profile.username}`);
  }

  if (loading) return null;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8">
        {/* Step indicators */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-accent"
              }`}
            />
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">What do you want your AI to do?</h1>
              <p className="text-sm text-muted-foreground mt-1">Select one or more areas you're interested in.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {USE_CASES.map((uc) => {
                const selected = interests.includes(uc);
                return (
                  <button
                    key={uc}
                    onClick={() => toggle(interests, uc, setInterests)}
                    className={`relative flex items-center justify-center rounded-xl border p-4 text-sm font-medium transition-all ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {uc}
                    {selected && <Check className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
            <Button onClick={saveStep1} disabled={interests.length === 0 || saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Next
            </Button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Which AI tools do you use?</h1>
              <p className="text-sm text-muted-foreground mt-1">Pick all that apply.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {AI_TOOLS.filter((t) => t !== "Any Tool").map((tool) => {
                const selected = tools.includes(tool);
                return (
                  <button
                    key={tool}
                    onClick={() => toggle(tools, tool, setTools)}
                    className={`relative flex items-center justify-center rounded-xl border p-4 text-sm font-medium transition-all ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {tool}
                    {selected && <Check className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
            <Button onClick={saveStep2} disabled={tools.length === 0 || saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Next
            </Button>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && profile?.account_type !== "creator" && (
          <div className="space-y-6 text-center">
            <div>
              <h1 className="text-2xl font-bold text-foreground">You're all set 🎉</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Your Browse page is now personalised to show content matching your interests.
              </p>
            </div>
            <Button onClick={finishUser} className="w-full">Start browsing</Button>
          </div>
        )}

        {step === 3 && profile?.account_type === "creator" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Set up your creator profile</h1>
              <p className="text-sm text-muted-foreground mt-1">Tell people a bit about yourself.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 200))}
                  placeholder="What do you create?"
                  rows={3}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground text-right">{bio.length}/200</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website">Website URL (optional)</Label>
                <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="twitter">Twitter handle (optional)</Label>
                <Input id="twitter" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" />
              </div>
            </div>
            <Button onClick={finishCreator} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Go to my profile
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
