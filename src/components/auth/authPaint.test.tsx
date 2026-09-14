// BG-P27 — the auth surface's paint, asserted.
//
// WHY THIS IS A STATIC-MARKUP TEST AND NOT A TESTING-LIBRARY ONE. Every colour
// on these pages is a `var(--token)` string, and jsdom's CSS parser stores
// NOTHING when one is assigned — not the reference, not a fallback, not the
// property. So `toHaveStyle` cannot see a token at all. `staticDoc` renders
// through `renderToStaticMarkup`, which writes the style attribute as a string
// and never hands it to the parser; see src/test/tokenStyle.tsx. Structure and
// ORDER are still real DOM questions and are asked of that same document.
//
// WHAT IT IS FOR. The auth pages render outside the frame, so nothing else in
// the suite covers them, and every surface here was a raw hex before this
// prompt — the point of the last test in the file is that none of them can come
// back without this failing.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { AuthButton } from "./AuthButton";
import { AuthCheckbox } from "./AuthCheckbox";
import { AuthDivider } from "./AuthDivider";
import { AuthInput } from "./AuthInput";
import { AuthShell } from "./AuthShell";
import { OAuthButtons } from "./OAuthButtons";
import { PasswordStrengthMeter, type PasswordStrength } from "./PasswordStrengthMeter";
import { ThemeProvider, THEME_STORAGE_KEY } from "@/contexts/ThemeContext";
import { BODONI, DISPLAY_MIN_PX } from "@/lib/theme/type";
import { staticDoc, styleOf } from "@/test/tokenStyle";

/** AuthShell reads the resolved theme for its wash, so it needs the provider. */
const shell = (theme: "exhibition" | "dusk") => {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  return staticDoc(
    <ThemeProvider>
      <AuthShell>
        <p>card body</p>
      </AuthShell>
    </ThemeProvider>,
  );
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("AuthShell", () => {
  it("stands the entrance on --bg, with no dot grid left on it", () => {
    const ground = shell("exhibition").querySelector("div");
    const style = styleOf(ground);
    expect(style).toContain("background-color:var(--bg)");
    // The legacy paint was a 24px-tiled dot grid over #25252F.
    expect(style).not.toContain("background-size");
    expect(style).not.toContain("#25252F");
  });

  it("washes Exhibition in --lit and Dusk in --action, both very low", () => {
    expect(styleOf(shell("exhibition").querySelector("div"))).toContain(
      "radial-gradient(68% 54% at 50% 26%, color-mix(in srgb, var(--lit) 9%",
    );
    expect(styleOf(shell("dusk").querySelector("div"))).toContain(
      "radial-gradient(68% 54% at 50% 26%, color-mix(in srgb, var(--action) 10%",
    );
  });

  /* THE FACE COMES FROM THE CONSTANT, NOT FROM A STRING. type.test.ts holds the
     whole of src/ to naming the display family in exactly one module, which is
     what makes its 20px floor cover every route rather than one file — and a
     test that spelled the family out by hand would be the first hole in it. */
  it("sets the wordmark in the display face at 28, clear of its floor", () => {
    const doc = shell("exhibition");
    const wordmark = [...doc.querySelectorAll("span")].find(
      (span) => span.textContent === "buildgallery",
    );
    expect(wordmark).toBeTruthy();
    const style = styleOf(wordmark);
    expect(style).toContain(BODONI);
    expect(style).toContain("font-size:28px");
    expect(28).toBeGreaterThanOrEqual(DISPLAY_MIN_PX);
    expect(style).toContain("color:var(--text)");
  });

  it("gives the card glass, a --glass-border hairline, --r-panel and raised", () => {
    const doc = shell("exhibition");
    const card = [...doc.querySelectorAll("div")].find((div) =>
      styleOf(div).includes("var(--glass-border)"),
    );
    const style = styleOf(card);
    expect(style).toContain("background:var(--glass)");
    expect(style).toContain("border-color:var(--glass-border)");
    expect(style).toContain("border-radius:var(--r-panel)");
    expect(style).toContain("box-shadow:var(--elev-raised)");
    expect(style).toContain("backdrop-filter:blur(16px) saturate(1.15)");
  });

  it("puts the room's choice on the page, as a labelled radio group", () => {
    const group = shell("exhibition").querySelector('[role="radiogroup"]');
    expect(group?.getAttribute("aria-label")).toBe("Theme");
    expect(group?.querySelectorAll('[role="radio"]').length).toBe(3);
  });
});

describe("AuthInput", () => {
  const invalid = () =>
    staticDoc(
      <AuthInput
        label="Email"
        value="nope"
        onChange={() => {}}
        validation={{ state: "invalid", message: "That email is already registered." }}
      />,
    );

  it("puts the error message BENEATH the field, never only in a toast", () => {
    const doc = invalid();
    const input = doc.querySelector("input");
    const message = doc.querySelector("p");
    expect(message?.textContent).toBe("That email is already registered.");
    expect(input).toBeTruthy();
    // DOCUMENT_POSITION_FOLLOWING — the message comes after the field.
    expect(input!.compareDocumentPosition(message!) & 4).toBeTruthy();
  });

  it("paints the message and the field's edge from one token", () => {
    const doc = invalid();
    expect(styleOf(doc.querySelector("p"))).toContain("color:var(--cat-breakage)");
    expect(styleOf(doc.querySelector("input"))).toContain(
      "border-color:var(--cat-breakage)",
    );
    expect(doc.querySelector("input")?.getAttribute("aria-invalid")).toBe("true");
  });

  it("confirms a valid field in --evidence rather than a second green", () => {
    const doc = staticDoc(
      <AuthInput
        label="Username"
        value="ada"
        onChange={() => {}}
        validation={{ state: "valid", message: "Username available" }}
      />,
    );
    expect(styleOf(doc.querySelector("p"))).toContain("color:var(--evidence)");
  });

  it("rests on the kit's field treatment", () => {
    const doc = staticDoc(<AuthInput label="Email" value="" onChange={() => {}} />);
    const style = styleOf(doc.querySelector("input"));
    expect(style).toContain("background:var(--recess)");
    expect(style).toContain("border-color:var(--line)");
    expect(style).toContain("border-radius:var(--r-control)");
    // The iOS rule owns the mobile size; nothing here may outrank it.
    expect(style).toContain("font-size:14px");
  });
});

describe("the two button treatments", () => {
  it("makes AuthButton the primary: --action filled, --on-action labelled", () => {
    const doc = staticDoc(<AuthButton>Sign in</AuthButton>);
    const button = doc.querySelector("button");
    const style = styleOf(button);
    expect(style).toContain("background:var(--action)");
    expect(style).toContain("color:var(--on-action)");
    expect(style).toContain("border-radius:var(--r-control)");
    expect(style).not.toContain("linear-gradient");
    expect(button?.getAttribute("data-visual-slot")).toBe("btn-primary");
  });

  it("makes every OAuth button a secondary, and keeps the provider marks", () => {
    const doc = staticDoc(
      <OAuthButtons onOAuthClick={() => {}} loadingProvider={null} />,
    );
    const buttons = [...doc.querySelectorAll("button")];
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      const style = styleOf(button);
      expect(style).toContain("background:var(--glass)");
      expect(style).toContain("border-color:var(--line)");
      expect(button.getAttribute("data-visual-slot")).toBe("btn-secondary");
    }
    // Google's four brand fills survive untouched — they are a trademark, not
    // a colour this theme gets a vote on.
    expect(doc.body.innerHTML).toContain("#4285F4");
    expect(doc.body.innerHTML).toContain("#EA4335");
  });
});

describe("AuthCheckbox", () => {
  it("fills --action when checked and wells --recess when not", () => {
    const box = (checked: boolean) =>
      styleOf(
        [
          ...staticDoc(
            <AuthCheckbox id="terms" checked={checked} onChange={() => {}} label="Terms" />,
          ).querySelectorAll("div"),
        ].find((div) => styleOf(div).includes("border-radius:var(--r-chip)")),
      );

    expect(box(true)).toContain("background:var(--action)");
    expect(box(true)).toContain("color:var(--on-action)");
    expect(box(false)).toContain("background:var(--recess)");
    expect(box(false)).toContain("border-color:var(--line)");
  });
});

/* ── targets a thumb can hit ──────────────────────────────────────────────────
   `critique-affordance` floors a touch target at 44×44, and WCAG 2.5.8 floors
   it at 24×24 for anything that is not a word inside a sentence. Three controls
   on this surface were the size of their own text, and the reveal — the only
   way to see what you have typed — was an 18px icon.
   ─────────────────────────────────────────────────────────────────────────── */
describe("touch targets", () => {
  it("gives the password reveal 44px without moving the icon", () => {
    const doc = staticDoc(
      <AuthInput label="Password" value="x" onChange={() => {}} showPasswordToggle />,
    );
    const reveal = doc.querySelector("button");
    const style = styleOf(reveal);
    // 18px icon + 13px each side = 44. `right` comes back by the same 13, so
    // the icon's centre is where it was: 1 + 13 + 9 = 14 + 9.
    expect(style).toContain("padding:13px");
    expect(style).toContain("right:1px");
  });

  it("leaves the reveal in the tab order", () => {
    const doc = staticDoc(
      <AuthInput label="Password" value="x" onChange={() => {}} showPasswordToggle />,
    );
    const reveal = doc.querySelector("button");
    expect(reveal?.getAttribute("tabindex")).toBeNull();
    expect(reveal?.getAttribute("aria-label")).toBe("Show password");
  });

  it("makes the checkbox's whole label the target", () => {
    const doc = staticDoc(
      <AuthCheckbox id="terms" checked={false} onChange={() => {}} label="Terms" />,
    );
    expect(styleOf(doc.querySelector("label"))).toContain("padding:6px 0");
  });
});

describe("AuthDivider", () => {
  it("rebuilds the card's ground rather than guessing an opaque colour", () => {
    const doc = staticDoc(<AuthDivider text="or sign in with email" />);
    expect(styleOf(doc.querySelector("span"))).toContain(
      "background:linear-gradient(var(--glass), var(--glass)), var(--bg)",
    );
    expect(styleOf(doc.querySelector("div > div"))).toContain("background:var(--line)");
  });
});

describe("PasswordStrengthMeter", () => {
  const segments = (strength: PasswordStrength) => {
    const doc = staticDoc(<PasswordStrengthMeter strength={strength} />);
    return [...doc.querySelectorAll('[role="img"] > div')].map(styleOf);
  };

  it("is three segments, not four", () => {
    expect(segments("weak")).toHaveLength(3);
  });

  it.each([
    ["weak", 1, "var(--cat-breakage)"],
    ["fair", 2, "var(--cat-artefact)"],
    ["good", 3, "var(--evidence)"],
    ["strong", 3, "var(--evidence)"],
  ] as const)("fills %s to %i in %s", (strength, filled, token) => {
    const styles = segments(strength);
    expect(styles.filter((style) => style.includes(`background:${token}`))).toHaveLength(
      filled,
    );
    expect(
      styles.filter((style) => style.includes("background:var(--recess)")),
    ).toHaveLength(3 - filled);
  });

  it("never spends a raw traffic-light hue", () => {
    const markup = (["weak", "fair", "good", "strong"] as const)
      .map((strength) => staticDoc(<PasswordStrengthMeter strength={strength} />).body.innerHTML)
      .join("");
    for (const legacy of ["#ef4444", "#f59e0b", "#2EC4B6", "#E8571A"]) {
      expect(markup).not.toContain(legacy);
    }
  });

  it("names the strength for a reader who cannot see the bar", () => {
    const doc = staticDoc(<PasswordStrengthMeter strength="fair" />);
    expect(doc.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe(
      "Password strength: Fair",
    );
  });
});

/* ── the legacy paint, gone for good ──────────────────────────────────────────
   Every file on this surface carried the old dark theme's hexes, and a repaint
   that only moves the ones a test happens to render is a repaint that leaks
   back. This reads the sources.

   THE ONE ALLOWED EXCEPTION IS NAMED, not pattern-matched: Google's four brand
   fills in OAuthButtons.tsx. They are reproduced under another company's brand
   guidelines, which specify them exactly, so they are the one place on these
   pages where a raw hex is correct.
   ─────────────────────────────────────────────────────────────────────────── */
describe("the auth surface's sources", () => {
  const DIR = join(process.cwd(), "src/components/auth");
  const BRAND_HEXES = ["#4285F4", "#34A853", "#FBBC05", "#EA4335"];

  const files = readdirSync(DIR).filter(
    (name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"),
  );

  it("has every card in the folder under test", () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  /* COMMENTS ARE STRIPPED FIRST, and that is the point rather than a loophole:
     several of these files NAME the hex they replaced, because a note saying
     "`#ef4444` stood here and is a red nobody measured" is how the next reader
     learns why the token is the token. Scanning code only is what lets the
     record stay in the file. */
  const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it.each(files)("%s spends no hex and no rgba(255,…) of its own", (name) => {
    let source = code(readFileSync(join(DIR, name), "utf8"));
    for (const brand of BRAND_HEXES) source = source.split(brand).join("<brand>");

    expect(source.match(/#[0-9A-Fa-f]{6}\b/g) ?? [], `${name} still holds a hex`).toEqual(
      [],
    );
    expect(
      source.match(/rgba?\(\s*\d+\s*,/g) ?? [],
      `${name} still holds a literal rgb()`,
    ).toEqual([]);
  });
});
