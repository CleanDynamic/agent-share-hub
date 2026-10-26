// CA-27 P2: one rule for text that does not fit (src/lib/theme/truncate.ts), where it is spent, and the new words. The widths, the
// overflow and the ⋯ button's place are measured in the browser (e2e/audit/composer-ca27.spec.ts).

import { cleanup, render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { LONG_TITLE } from "@/dev/fixtures/ca27";
import { NO_SHRINK, PREVIEW, PREVIEW_LINES, TITLE_LINE, fullText } from "@/lib/theme/truncate";

import { LIST_COPY, clamp2 } from "./BuildList";
import { SessionHead } from "./SessionHead";
import { LIST_HINT, LIST_HINT_PHONE } from "./SandboxView";
import { WorkstreamHead } from "./WorkstreamHead";
import { PROMPT_TEXT, TILE_TITLE } from "./tileRecipes";
import { ellipsis } from "./refinedStyles";

afterEach(cleanup);

describe("the rule", () => {
  it("a title is one line and an ellipsis, a preview two lines and a clamp", () => {
    expect(TITLE_LINE).toMatchObject({ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 });
    expect(PREVIEW_LINES).toBe(2);
    expect(PREVIEW).toMatchObject({ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minWidth: 0 });
    expect(NO_SHRINK).toEqual({ flex: "none" });
  });

  it("puts the full text in the tooltip, and sets nothing for no text", () => {
    expect(fullText("A long title")).toEqual({ title: "A long title" });
    expect(fullText("")).toEqual({});
    expect(fullText(null)).toEqual({});
  });

  it("is the one rule: the composer's own ellipsis, tile title, clamp and prompt text are it", () => {
    expect(ellipsis).toBe(TITLE_LINE);
    expect(clamp2).toBe(PREVIEW);
    expect(TILE_TITLE).toMatchObject(TITLE_LINE);
    expect(PROMPT_TEXT).toMatchObject(PREVIEW);
  });
});

const session = { key: "typed-1", number: 1, tool: "Claude", detail: "", prompts: [], title: LONG_TITLE, date: "22 Oct" };

describe("the heads", () => {
  it("a session's title is one line with all of it in the tooltip; its number, app and date do not shrink", () => {
    render(
      <MemoryRouter>
        <SessionHead session={session} phone={false} tiles={3} collapsed={false} controls="t" onToggle={() => undefined} first last editable={false} />
      </MemoryRouter>,
    );
    const title = screen.getByTestId("session-title-text");
    expect(title.getAttribute("title")).toBe(LONG_TITLE);
    expect(title.textContent).toBe(LONG_TITLE);
    expect(title.style.whiteSpace).toBe("nowrap");
    expect(title.style.textOverflow).toBe("ellipsis");
    expect(screen.getByText("22 Oct").style.flexShrink).toBe("0");
    // SV-05 P1: the number sits in its own slot inside "Session 1 ·".
    const name = screen.getByTestId("session-number").parentElement?.parentElement as HTMLElement;
    expect(name.style.flex).toMatch(/none|0 0 auto/);
  });

  it("a part's name is one line with all of it in the tooltip", () => {
    render(<WorkstreamHead part={{ key: "ws-1", label: "Part 1", name: LONG_TITLE, nameColour: "var(--text)", sessions: 2, collapsed: false }} phone={false} first last controls="b" onToggle={() => undefined} joins="" startsAfterChoices={[]} />);
    const name = screen.getByTestId("workstream-name-text");
    expect(name.getAttribute("title")).toBe(LONG_TITLE);
    expect(name.style.textOverflow).toBe("ellipsis");
    expect(screen.getByTestId("workstream-label").style.flex).toMatch(/none|0 0 auto/);
  });
});

describe("the words", () => {
  it("Read all replaces Read all of it, in the hint as well", () => {
    expect(LIST_HINT).toBe("Click a tile to see its details · double-click to read all");
    expect(LIST_COPY.hint).toBe(LIST_HINT);
    expect(LIST_HINT_PHONE).toBe("Tap a tile to see its details");
    for (const file of ["src/pages/site/compose/BuildList.tsx", "src/pages/site/build/BuildSteps.tsx", "src/pages/site/compose/SandboxView.tsx"]) {
      const source = fs.readFileSync(path.resolve(__dirname, "../../../..", file), "utf8");
      expect(source, file).not.toMatch(/[Rr]ead all of it/);
    }
  });
});
