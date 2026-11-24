import { useState, useEffect } from "react";
import { useRegisterPageBar } from "@/components/shell/phoneBarRegistry";
import { BigButton } from "@/components/phone/BigButton";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApprovedToolNames } from "@/hooks/useApprovedTools";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { uiTransition } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { data as dataText, DM_MONO, FIGTREE, tabular } from "@/lib/theme/type";
import { SITE_NAME } from "@/lib/site";

const USE_CASES = ["Social Media", "Research", "Business", "Productivity", "Content", "Learning", "Email", "Finance", "Hobby", "Other"];

export default function Onboarding() {
  const { isLoggedIn, profile, loading: sessionLoading, profileLoading, refreshProfile } = useAuth();
  // What to ask next depends on what the profile already holds, which arrives after the session (SV-03).
  const loading = sessionLoading || profileLoading;
  const navigate = useNavigate();
  const phone = useIsPhone();
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
      navigate("/gallery", { replace: true });
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
    navigate("/gallery");
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
    navigate(`/profile/${profile.username}`);
  }

  // Prompt 19: the phone's top bar offers Skip, which leaves for the gallery as finishing does, saving nothing.
  useRegisterPageBar({ skip: () => navigate("/gallery"), title: `${step} of 3`, progress: { step, of: 3 } });

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

  /* Synth 13 Part C: one panel, 560 wide, 40 from the top, 28 padding. "1 of 3" in mono 13 Text 3; the question as the h1
     (31/36); the line under it 15 Text 2; the choices as small pills (chosen: Inverse), names as text with no logos. */
  const panelStyle = {
    background: t.surface,
    borderRadius: r.panel,
    width: "100%",
    maxWidth: 560,
    padding: 28,
    boxSizing: "border-box" as const,
  };
  const headingStyle = phone
    ? { margin: 0, fontFamily: FIGTREE, fontSize: 24, lineHeight: "28px", fontWeight: 600, letterSpacing: "-0.02em", color: t.text }
    : { margin: 0, fontFamily: FIGTREE, fontSize: 31, lineHeight: "36px", fontWeight: 600, color: t.text };
  const subheadingStyle = {
    margin: "8px 0 0",
    fontFamily: FIGTREE,
    fontSize: "15px",
    fontWeight: 400,
    lineHeight: "20px",
    color: t.text2,
  };
  const tileStyle = (selected: boolean) => ({
    height: phone ? 36 : 32,
    padding: phone ? "0 16px" : "0 14px",
    background: selected ? t.inverse : t.module,
    border: 0,
    borderRadius: phone ? 18 : 16,
    color: selected ? t.onInverse : t.text,
    fontFamily: FIGTREE,
    fontSize: 13,
    fontWeight: selected ? 600 : 500,
    transition: uiTransition(),
  });
  const mainButton = { height: 40, borderRadius: 20, background: t.action, color: t.onAction, fontSize: 15, fontWeight: 600 };

  /* Mobile prompt 27 Part C: the main button, "Continue", pinned in a sticky footer on a phone; the desktop's own button elsewhere. */
  const stepStyle = { display: "flex", flexDirection: "column" as const, gap: 24, flexGrow: 1 };
  const cta = (label: string, onClick: () => void, disabled: boolean, busy: boolean) =>
    phone ? (
      <div
        data-testid="onboarding-footer"
        style={{ position: "sticky", bottom: 0, marginTop: "auto", marginLeft: -16, marginRight: -16, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", background: t.frame, boxSizing: "border-box" }}
      >
        <BigButton main full onClick={onClick} disabled={disabled}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {label}
        </BigButton>
      </div>
    ) : (
      <Button onClick={onClick} disabled={disabled} className="w-full" style={mainButton}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {label}
      </Button>
    );

  return (
    <div className="flex min-h-[80vh] justify-center px-4" style={{ paddingTop: phone ? 8 : 40, alignItems: phone ? "stretch" : "flex-start", flexDirection: phone ? "column" : undefined }}>
      <SeoHead title="Onboarding" description={`Set up your ${SITE_NAME} profile.`} path="/onboarding" noIndex />
      <div style={phone ? { display: "flex", flexDirection: "column", flexGrow: 1, boxSizing: "border-box" } : panelStyle}>
        {/* Where the reader is, in words. On a phone the top bar says it. */}
        {phone ? null : (
          <p style={{ fontFamily: DM_MONO, fontSize: 13, lineHeight: "16px", color: t.label, margin: "0 0 12px", ...tabular }}>
            {step} of 3
          </p>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div className={phone ? undefined : "space-y-6"} style={phone ? stepStyle : undefined}>
            <div>
              <h1 style={headingStyle}>What do you want your AI to do?</h1>
              <p style={subheadingStyle}>Select one or more areas you're interested in.</p>
            </div>
            <div className="flex flex-wrap" style={{ gap: 8 }} data-testid="onboarding-chips">
              {USE_CASES.map((uc) => {
                const selected = interests.includes(uc);
                return (
                  <button
                    key={uc}
                    onClick={() => toggle(interests, uc, setInterests)}
                    aria-pressed={selected}
                    className="flex items-center justify-center"
                    style={tileStyle(selected)}
                  >
                    {uc}
                  </button>
                );
              })}
            </div>
            {cta("Continue", saveStep1, interests.length === 0 || saving, saving)}
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className={phone ? undefined : "space-y-6"} style={phone ? stepStyle : undefined}>
            <div>
              <h1 style={headingStyle}>Which AI tools do you use?</h1>
              <p style={subheadingStyle}>Pick all that apply.</p>
            </div>
            <div className="flex flex-wrap" style={{ gap: 8 }} data-testid="onboarding-chips">
              {AI_TOOLS.filter((tool) => tool !== "Any Tool").map((tool) => {
                const selected = tools.includes(tool);
                return (
                  <button
                    key={tool}
                    onClick={() => toggle(tools, tool, setTools)}
                    aria-pressed={selected}
                    className="flex items-center justify-center"
                    style={tileStyle(selected)}
                  >
                    {tool}
                  </button>
                );
              })}
            </div>
            {cta("Continue", saveStep2, tools.length === 0 || saving, saving)}
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && profile?.account_type !== "creator" && (
          <div className={phone ? undefined : "space-y-6 text-center"} style={phone ? stepStyle : undefined}>
            <div>
              <h1 style={headingStyle}>You're all set</h1>
              <p style={{ ...subheadingStyle, marginTop: "8px" }}>
                Your Discover page is now personalised to show content matching your interests.
              </p>
            </div>
            {cta("Start browsing", finishUser, false, false)}
          </div>
        )}

        {step === 3 && profile?.account_type === "creator" && (
          <div className={phone ? undefined : "space-y-6"} style={phone ? stepStyle : undefined}>
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
                <Label htmlFor="twitter">Twitter handle (optional)</Label>
                <Input id="twitter" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website">Website URL (optional)</Label>
                <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </div>
            </div>
            {cta("Save", finishCreator, saving, saving)}
          </div>
        )}
      </div>
    </div>
  );
}
