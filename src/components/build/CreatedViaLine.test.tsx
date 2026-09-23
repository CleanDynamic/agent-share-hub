// The provenance line's copy (EX-P14).
//
// The sentence is the whole component, so the sentence is the whole test: which
// tool is named, when the count replaces the tool, and — the two that matter
// most — that a build with nothing recorded renders NOTHING, and that what
// renders is a paragraph of muted prose rather than a badge.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreatedViaLine } from "./CreatedViaLine";
import { countWord, createdViaSentence } from "./createdViaCopy";
import type { CreatedVia } from "@/lib/build/provenance";

const ID = "11111111-0000-4000-8000-00000000000";

/** n imports, ids that differ. */
function via(count: number, client?: string | null): CreatedVia {
  return {
    source: "connector",
    client: client ?? null,
    reader_id: "claude",
    imports: Array.from({ length: count }, (_, index) => `${ID}${index}`),
  };
}

describe("one conversation names the tool it came from", () => {
  it.each([
    ["claude", "Drafted from a Claude conversation, reviewed by the creator."],
    ["claude-code", "Drafted from a Claude Code conversation, reviewed by the creator."],
    ["chatgpt", "Drafted from a ChatGPT conversation, reviewed by the creator."],
    ["cursor", "Drafted from a Cursor conversation, reviewed by the creator."],
  ])("%s", (client, expected) => {
    expect(createdViaSentence(via(1, client))).toBe(expected);
  });

  /**
   * The two clients that name no tool a reader would recognise, plus the two
   * ways the column can carry nothing. All four say the same true, unspecific
   * thing rather than inventing a product name.
   */
  it.each(["web", "unknown", null, "some-seventh-client"])(
    "%s is an unnamed AI conversation",
    (client) => {
      expect(createdViaSentence(via(1, client))).toBe(
        "Drafted from an AI conversation, reviewed by the creator.",
      );
    },
  );
});

describe("more than one conversation counts instead of naming", () => {
  it.each([
    [2, "two"],
    [3, "three"],
    [4, "four"],
    [5, "five"],
    [6, "six"],
    [7, "seven"],
    [8, "eight"],
    [9, "nine"],
    [10, "ten"],
  ])("%i reads as %s", (count, word) => {
    expect(createdViaSentence(via(count, "claude-code"))).toBe(
      `Drafted from ${word} AI conversations, reviewed by the creator.`,
    );
  });

  it("is 'several' past ten", () => {
    expect(createdViaSentence(via(11, "claude"))).toBe(
      "Drafted from several AI conversations, reviewed by the creator.",
    );
    expect(countWord(40)).toBe("several");
  });

  /** The tool is dropped on purpose: two imports can come from two tools. */
  it("does not name a client once there is more than one", () => {
    expect(createdViaSentence(via(2, "cursor"))).not.toContain("Cursor");
  });
});

describe("nothing recorded renders nothing", () => {
  it.each([null, undefined])("%s is no sentence", (value) => {
    expect(createdViaSentence(value)).toBeNull();
  });

  it("an empty imports list is no sentence — it supports no claim", () => {
    expect(createdViaSentence({ source: "mixed", imports: [] })).toBeNull();
  });

  it("renders no element at all", () => {
    const { container } = render(<CreatedViaLine createdVia={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("it is a quiet line, not a badge", () => {
  it("is a paragraph in the muted token at body size", () => {
    render(<CreatedViaLine createdVia={via(1, "claude-code")} />);

    const line = screen.getByTestId("created-via");
    expect(line.tagName).toBe("P");
    expect(line).toHaveStyle({ color: "var(--text2)" });
    expect(line.style.fontSize).toBe("16px");
  });

  /**
   * No fill, no border, no radius: the three things that would turn a sentence
   * into a chip. And nothing from the breakage hue, which would read to every
   * passing visitor as a build with something wrong with it.
   */
  it("carries no container and no warning colour", () => {
    render(<CreatedViaLine createdVia={via(3)} />);

    const line = screen.getByTestId("created-via");
    expect(line.style.background).toBe("");
    expect(line.style.border).toBe("");
    expect(line.style.borderRadius).toBe("");
    expect(line.getAttribute("style")).not.toContain("breakage");
  });
});
