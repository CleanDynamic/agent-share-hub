// UX-03 P7: a draft with no title is shown by its first prompt. Display only: the stored title stays untitled, so publishing
// still asks for one.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { draftsViewProps } from "@/dev/fixtures/drafts";
import type { DraftListItem } from "@/lib/build/drafts";
import { NO_TITLE, publishBuild, UNTITLED_TITLE } from "@/lib/build/publish";

import { DraftsView } from "./DraftsView";
import { draftRowTitle } from "./draftsModel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});

const draft = (over: Partial<DraftListItem>): DraftListItem => ({ id: "d1", title: UNTITLED_TITLE, sessionCount: 1, updatedAt: "2026-11-03T10:00:00Z", firstPrompt: null, ...over });

describe("UX-03 P7: drafts are named by their first prompt", () => {
  it("shows an untitled draft's first prompt, on one line, in place of the title", () => {
    expect(draftRowTitle(draft({ firstPrompt: "Write the poster copy\nfor the bakery" }))).toBe("Write the poster copy for the bakery");
    expect(draftRowTitle(draft({ title: "", firstPrompt: "Write the menu" }))).toBe("Write the menu");
    // A title of its own wins, and a draft with no prompt keeps Untitled build.
    expect(draftRowTitle(draft({ title: "Fox poster", firstPrompt: "Write the poster copy" }))).toBe("Fox poster");
    expect(draftRowTitle(draft({ firstPrompt: null }))).toBe("Untitled build");
  });

  it("draws the row on the Drafts page with the prompt's text", () => {
    const one = draft({ firstPrompt: "Write the poster copy" });
    render(
      <MemoryRouter>
        <DraftsView {...draftsViewProps()} drafts={[one]} onRetryDrafts={vi.fn()} onRetrySessions={vi.fn()} onAddToNew={vi.fn()} onAddToDraft={vi.fn()} onConnect={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("draft-title").textContent).toBe("Write the poster copy");
  });

  it("never writes the prompt to the title: the draft is still untitled, and publishing it still asks for a title", async () => {
    const one = draft({ firstPrompt: "Write the poster copy" });
    draftRowTitle(one);
    expect(one.title).toBe(UNTITLED_TITLE);
    await expect(publishBuild({ id: one.id, status: "draft", published_at: null, title: one.title } as Parameters<typeof publishBuild>[0])).rejects.toThrow(NO_TITLE);
  });
});
