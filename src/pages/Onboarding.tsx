import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApprovedToolNames } from "@/hooks/useApprovedTools";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check } from "lucide-react";
import { uiTransition } from "@/lib/theme/controls";
import { elevation } from "@/lib/theme/elevation";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { cardTitle, data as dataText, eyebrow, FIGTREE, tabular } from "@/lib/theme/type";

const USE_CASES = ["Social Media", "Research", "Business", "Productivity", "Content", "Learning", "Email", "Finance", "Hobby", "Other"];

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
    // Skip onboarding if user has already completed it
    if (!loading && isLoggedIn && profile && profile.user_interests && (profile.user_interests as string[]).length > 0) {
      navigate("/browse", { replace: true });
    }
  }, [loading, isLoggedIn, profile, navigate]);

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

  /* ── Paint ─────────────────────────────────────────────────────────────────
     Onboarding is the other half of the signed-out entry: the reader arrives
     here straight off the auth card and it has to be the same room. So it takes
     the same surface — `--glass` on a `--glass-border` hairline at `--r-panel`,
     raised — even though it renders INSIDE the frame rather than outside it.

     THE PROGRESS BAR IS GONE AND THE WORDS STAY. Three amber-ish segments were
     progress expressed as a graphic, and this theme carries progress as light
     or as words and never as a coloured meter someone has to decode. "Step 2 of
     3" says the same thing, reads on a screen reader without an aria-label, and
     costs no colour the nine category hues have a claim on.

     The option tiles are the only real state on the page, so they take the
     accent: `--action` edge over a low-alpha `--action` ground when chosen, a
     `--recess` well on a `--line` hairline when not. `transition-all` is
     replaced by the kit's transition — the theme forbids `all`, which here was
     animating padding and border-width alongside the colour.
     ───────────────────────────────────────────────────────────────────────── */

  const panelStyle = {
    background: t.glass,
    borderWidth: 1,
    borderStyle: "solid" as const,
    borderColor: t.glassBorder,
    borderRadius: r.panel,
    ...elevation.raised,
  };

  const headingStyle = { ...cardTitle, color: t.text };

  const subheadingStyle = {
    marginTop: "4px",
    fontFamily: FIGTREE,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.55,
    color: t.text2,
  };

  const tileStyle = (selected: boolean) => ({
    background: selected ? tokenAlpha("action", 0.12) : t.recess,
    borderWidth: 1,
    borderStyle: "solid" as const,
    borderColor: selected ? t.action : t.line,
    borderRadius: r.control,
    color: selected ? t.text : t.text2,
    fontFamily: FIGTREE,
    transition: uiTransition(),
  });

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <SeoHead title="Onboarding — buildgallery.ai" description="Set up your buildgallery.ai profile." path="/onboarding" noIndex />
      <div className="w-full max-w-lg p-6 sm:p-8" style={panelStyle}>
        {/* Where the reader is, in words. */}
        <p style={{ ...eyebrow, color: t.text2, marginBottom: "24px" }}>
          Step {step} of 3
        </p>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 style={headingStyle}>What do you want your AI to do?</h1>
              <p style={subheadingStyle}>Select one or more areas you're interested in.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {USE_CASES.map((uc) => {
                const selected = interests.includes(uc);
                return (
                  <button
                    key={uc}
                    onClick={() => toggle(interests, uc, setInterests)}
                    aria-pressed={selected}
                    className="relative flex items-center justify-center p-4 text-sm font-medium"
                    style={tileStyle(selected)}
                  >
                    {uc}
                    {selected && (
                      <Check
                        className="absolute top-2 right-2 h-3.5 w-3.5"
                        style={{ color: t.action }}
                      />
                    )}
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
              <h1 style={headingStyle}>Which AI tools do you use?</h1>
              <p style={subheadingStyle}>Pick all that apply.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {AI_TOOLS.filter((tool) => tool !== "Any Tool").map((tool) => {
                const selected = tools.includes(tool);
                return (
                  <button
                    key={tool}
                    onClick={() => toggle(tools, tool, setTools)}
                    aria-pressed={selected}
                    className="relative flex items-center justify-center p-4 text-sm font-medium"
                    style={tileStyle(selected)}
                  >
                    {tool}
                    {selected && (
                      <Check
                        className="absolute top-2 right-2 h-3.5 w-3.5"
                        style={{ color: t.action }}
                      />
                    )}
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
              <h1 style={headingStyle}>You're all set</h1>
              <p style={{ ...subheadingStyle, marginTop: "8px" }}>
                Your Discover page is now personalised to show content matching your interests.
              </p>
            </div>
            <Button onClick={finishUser} className="w-full">Start browsing</Button>
          </div>
        )}

        {step === 3 && profile?.account_type === "creator" && (
          <div className="space-y-6">
            <div>
              <h1 style={headingStyle}>Set up your creator profile</h1>
              <p style={subheadingStyle}>Tell people a bit about yourself.</p>
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
                <p
                  className="text-right"
                  style={{ ...dataText, ...tabular, fontSize: "12px", color: t.text2 }}
                >
                  {bio.length}/200
                </p>
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
