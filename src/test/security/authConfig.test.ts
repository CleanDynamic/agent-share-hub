// The owner's auth settings, as far as supabase/config.toml can express them (docs/security/auth-settings.md).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const TOML = readFileSync("supabase/config.toml", "utf8");

/** The key = value lines of one [section], up to the next section. */
function section(name: string): Record<string, string> {
  const start = TOML.indexOf(`[${name}]\n`);
  if (start < 0) return {};
  const rest = TOML.slice(start + name.length + 3);
  const body = rest.slice(0, rest.search(/^\[/m) === -1 ? undefined : rest.search(/^\[/m));
  const out: Record<string, string> = {};
  for (const match of body.matchAll(/^([a-z_]+)\s*=\s*(.+)$/gm)) out[match[1]] = match[2].trim();
  return out;
}

describe("supabase/config.toml [auth]", () => {
  it("sets the site and exact redirect addresses, no wildcards", () => {
    const auth = section("auth");
    expect(auth.site_url).toBe('"https://openbuilds.ai"');
    expect(auth.additional_redirect_urls).toContain('"https://openbuilds.ai/auth/callback"');
    expect(auth.additional_redirect_urls).not.toContain("*");
    expect(auth.minimum_password_length).toBe("12");
  });

  it("confirms email, double-confirms changes, reauthenticates password changes, and links last an hour at most", () => {
    const email = section("auth.email");
    expect(email.enable_confirmations).toBe("true");
    expect(email.double_confirm_changes).toBe("true");
    expect(email.secure_password_change).toBe("true");
    expect(Number(email.otp_expiry)).toBeLessThanOrEqual(3600);
  });

  it("turns on Turnstile with the secret from the environment, never written here", () => {
    const captcha = section("auth.captcha");
    expect(captcha.enabled).toBe("true");
    expect(captcha.provider).toBe('"turnstile"');
    expect(captcha.secret).toMatch(/^"env\([A-Z_]+\)"$/);
  });
});
