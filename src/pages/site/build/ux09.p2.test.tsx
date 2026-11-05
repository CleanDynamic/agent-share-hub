// UX-09 Part 2: a rebuild made in reply says so under its card: `Made in reply to @maya's topic`, `@maya's topic` a link to the
// reply. A rebuild with no reply has no line.

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { RebuildsBody } from "./RebuildsBody";

const card = (key: string, madeInReply?: { handle: string; to: string }) => ({ key, render: () => <span>{`Card ${key}`}</span>, madeInReply });

describe("UX-09 P2: Rebuilds made in reply say so", () => {
  it("draws the line after the card, with a link to the reply", () => {
    render(
      <MemoryRouter>
        <RebuildsBody rebuilds={{ cards: [card("r1", { handle: "maya", to: "/openbuilds/topics/t1#reply-x" }), card("r2")], loading: false, lineageTo: "/b2/x/lineage" }} />
      </MemoryRouter>,
    );
    const [first, second] = screen.getAllByTestId("build-rebuild-card");
    const line = within(first!).getByTestId("build-rebuild-made-in-reply");
    expect(line.textContent).toBe("Made in reply to @maya's topic");
    const link = within(line).getByRole("link", { name: "@maya's topic" });
    expect(link.getAttribute("href")).toBe("/openbuilds/topics/t1#reply-x");
    // After the card's own line.
    expect(first!.lastElementChild).toBe(line);
    expect(within(second!).queryByTestId("build-rebuild-made-in-reply")).toBeNull();
  });
});
