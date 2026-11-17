// Prompt 9, G16: the privacy text's storage table lists every key the site writes in the browser.
//
// The search: every source file (tests, audits, dev pages and harnesses aside) that writes localStorage, sessionStorage,
// IndexedDB (idb-keyval) or a cookie. Each such file is listed here with the key or key prefix it writes, and each key must
// appear in the "Cookies and browser storage" section. A new file that writes storage fails this test until it is listed
// here and in the privacy text.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import privacy from "./privacy";
import { textsOf } from "./types";

const ROOT = path.resolve(__dirname, "../../..");

/** Each file that writes browser storage, and the key or key prefix it writes, as the privacy table names it. */
const WRITERS: Record<string, string[]> = {
  "src/integrations/supabase/previewAuthStorage.ts": ["sb-…-auth-token"],
  "src/lib/auth/keepSignedIn.ts": ["sb-…-auth-token", "ob-keep-signed-in"],
  "src/lib/query/sessionSignal.ts": ["ob-signed-out-on-purpose"],
  "src/lib/auth/pendingVerification.ts": ["pending_verification_email"],
  "src/pages/site/signin/SignupPanel.tsx": ["signup_draft"],
  "src/components/pagestate/returnPlace.ts": ["ob-return-place"],
  "src/contexts/ThemeContext.tsx": ["bg-theme"],
  "src/lib/query/persist.ts": ["bg-kept-cache"],
  "src/lib/build/writeGuard.ts": ["bg:pending:"],
  "src/pages/site/compose/useUnsentPrompts.tsx": ["ux-unsent:", "ux-unsent-tab"],
  "src/lib/routing/ScrollKeeper.tsx": ["scroll:v1:"],
  "src/lib/build/buildsLayout.ts": ["builds:layout:v1"],
  "src/pages/site/builds/classificationModel.ts": ["builds:facets:v1"],
  "src/pages/site/compose/viewOptions.ts": ["bg-compose-view:"],
  "src/lib/build/layers.ts": ["openbuilds.layer-review.declined."],
  "src/pages/site/home/homeModel.ts": ["bg-home-seen"],
  "src/pages/site/openbuilds/openBuildsFeedModel.ts": ["openbuilds:seen:"],
  "src/components/progress/ResetNote.tsx": ["bg-xp-reset-note-seen"],
  "src/components/messages/ConversationHeader.tsx": ["pinned-context-collapsed:"],
  "src/components/ContentBlockViewer.tsx": ["openbuilds_page_ad_shown_"],
};

const WRITES = /(localStorage|sessionStorage)\.setItem\(|storage\.setItem\(|from "idb-keyval"|document\.cookie\s*=/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["__audit__", "dev", "test"].includes(entry.name)) out.push(...sourceFiles(rel));
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$|\.d\.ts$|Harness/.test(entry.name)) out.push(rel);
  }
  return out;
}

describe("the privacy text's storage table (G16)", () => {
  const section = privacy.sections.find((s) => s.id === "cookies-and-browser-storage");
  const said = section ? textsOf({ ...privacy, sections: [section] }).join("\n") : "";

  it("keeps its id and its place before Children", () => {
    const ids = privacy.sections.map((s) => s.id);
    expect(ids.indexOf("cookies-and-browser-storage")).toBe(ids.indexOf("children") - 1);
  });

  it("is told of every file that writes browser storage", () => {
    const found = sourceFiles("src").filter((file) => WRITES.test(fs.readFileSync(path.join(ROOT, file), "utf8")));
    expect(found.sort()).toEqual(Object.keys(WRITERS).sort());
  });

  it("names every key those files write", () => {
    for (const [file, keys] of Object.entries(WRITERS)) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      for (const key of keys) {
        expect(said, `${file}: ${key}`).toContain(key);
        const literal = key.replace(/…|:$|\.$|_$/g, "").replace(/-$/, "");
        if (!key.startsWith("sb-")) expect(source, `${file} no longer writes ${key}`).toContain(literal);
      }
    }
  });

  it("marks the one key that is not strictly necessary", () => {
    expect(said).toMatch(/openbuilds_page_ad_shown_…\)\. Not strictly necessary\./);
  });
});
