// UX-12 P4: the footer and sign-up links to the legal pages, hidden until each text is reviewed; robots.txt and the sitemap.
import fs from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { SiteFooterView } from "@/components/shell/SiteFooter";
import { SignupForm, type SignupFormProps } from "@/pages/site/signin/SignupForm";

import { PRIVACY_REVIEWED, TERMS_REVIEWED } from "./reviewed";

const ROOT = path.resolve(__dirname, "../../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

const footer = (extra: { showPrivacy?: boolean; showTerms?: boolean } = {}) =>
  render(
    <MemoryRouter>
      <ThemeProvider>
        <SiteFooterView signedIn={false} onSignOut={() => {}} onConnect={() => {}} {...extra} />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("the footer", () => {
  it("shows neither link while the texts are not reviewed (and by default)", () => {
    footer();
    expect(screen.queryByRole("link", { name: "Privacy" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Terms" })).toBeNull();
  });

  it("shows both after API docs, in the neighbours' style, once told they are reviewed", () => {
    footer({ showPrivacy: true, showTerms: true });
    const links = screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["buildgallery", "/"],
      ["About", "/about"],
      ["API docs", "/api-docs"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Sign in", "/login"],
    ]);
    const style = (name: string) => screen.getByRole("link", { name }).getAttribute("style");
    expect(style("Privacy")).toBe(style("About"));
    expect(style("Terms")).toBe(style("About"));
  });

  it("is hidden for real while the flags are false", () => {
    expect(PRIVACY_REVIEWED || TERMS_REVIEWED).toBe(false);
  });
});

const signup = (over: Partial<SignupFormProps> = {}): SignupFormProps => ({
  displayName: "",
  username: "",
  email: "",
  password: "",
  agreedToTerms: false,
  onDisplayNameChange: () => {},
  onUsernameChange: () => {},
  onEmailChange: () => {},
  onPasswordChange: () => {},
  onAgreedToTermsChange: () => {},
  usernameValidation: { state: "idle" },
  emailValidation: { state: "idle" },
  passwordStrength: "weak",
  canSubmit: true,
  isSubmitting: false,
  onSubmit: () => {},
  onProvider: () => {},
  loadingProvider: null,
  ...over,
});

describe("the sign-up line", () => {
  it("is absent until both texts are reviewed", () => {
    render(<MemoryRouter><SignupForm {...signup()} /></MemoryRouter>);
    expect(screen.queryByTestId("signup-legal-line")).toBeNull();
  });

  it("says the sentence, with working links in the same tab, in label colour", () => {
    let left = 0;
    const props = signup({ showLegalLine: true, onLeaveForLegal: () => (left += 1) });
    render(<MemoryRouter><SignupForm {...props} /></MemoryRouter>);
    const line = screen.getByTestId("signup-legal-line");
    expect(line.textContent).toBe("By creating an account you agree to the Terms and have read the Privacy policy.");
    const terms = line.querySelector('a[href="/terms"]') as HTMLAnchorElement;
    const privacy = line.querySelector('a[href="/privacy"]') as HTMLAnchorElement;
    expect(terms.textContent).toBe("Terms");
    expect(privacy.textContent).toBe("Privacy policy");
    expect(terms.getAttribute("target")).toBeNull();
    terms.click();
    privacy.click();
    expect(left).toBe(2);
    expect(renderToStaticMarkup(<MemoryRouter><SignupForm {...props} /></MemoryRouter>)).toContain("color:var(--label)");
  });
});

describe("robots.txt and the sitemap", () => {
  it("allow both pages", () => {
    const robots = read("public/robots.txt");
    expect(robots).toMatch(/^Allow: \/privacy$/m);
    expect(robots).toMatch(/^Allow: \/terms$/m);
  });
  it("list both in the generator and in public/sitemap.xml", () => {
    const generator = read("scripts/generate-sitemap.js");
    const xml = read("public/sitemap.xml");
    for (const page of ["/privacy", "/terms"]) {
      expect(generator).toContain(`path: "${page}"`);
      expect(xml).toMatch(new RegExp(`<loc>https://[^<]+${page}</loc>`));
    }
  });
});
