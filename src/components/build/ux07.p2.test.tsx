// UX-07 P2: Discussed in OpenBuilds on a build page, and the replies on a step.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stepRepliesOf } from "@/lib/openbuilds/connections";
import type { Post } from "@/lib/openbuilds/types";

import { BuildConnectionsProvider } from "./BuildConnections";
import { StepRepliesMark } from "./ConnectionMarks";
import { DISCUSSED_ROWS, DiscussedSection, START_TOPIC, discussedMeta, discussedRowMeta, discussedShown, type DiscussedRow } from "./DiscussedSection";

afterEach(cleanup);

const rows = (n: number): DiscussedRow[] => Array.from({ length: n }, (_, index) => ({ id: `t${index}`, heading: `Topic ${index + 1}`, to: `/openbuilds/topics/t${index}`, meta: "@maya · in Claude Code · 6 replies" }));
const mount = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

describe("UX-07 P2: the meta line", () => {
  it("names topics, replies and the topics the build started, each left out at zero", () => {
    expect(discussedMeta({ topics: 3, replies: 6, started: 2 })).toBe("3 topics · 6 replies · used to start 2 topics");
    expect(discussedMeta({ topics: 1, replies: 1, started: 1 })).toBe("1 topic · 1 reply · used to start 1 topic");
    expect(discussedMeta({ topics: 0, replies: 6, started: 0 })).toBe("6 replies");
    expect(discussedMeta({ topics: 3, replies: 0, started: 2 })).toBe("3 topics · used to start 2 topics");
    expect(discussedMeta({ topics: 0, replies: 0, started: 0 })).toBe("");
  });

  it("says who, where and how many replies on a row", () => {
    expect(discussedRowMeta("maya", ["Claude Code"], 6)).toBe("@maya · in Claude Code · 6 replies");
    expect(discussedRowMeta("maya", [], 0)).toBe("@maya");
  });
});

describe("UX-07 P2: the empty rule", () => {
  it("is not drawn with nothing to show, except to the maker who can start a topic", () => {
    const none = { topics: 0, replies: 0, started: 0 };
    expect(discussedShown(none, 0, false, true)).toBe(false);
    expect(discussedShown(none, 0, true, true)).toBe(true);
    expect(discussedShown(none, 0, true, false)).toBe(false);
    expect(discussedShown({ ...none, started: 1 }, 1, false, false)).toBe(true);

    const { container } = mount(<DiscussedSection counts={none} rows={[]} isMaker={false} onStart={() => undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the maker the control alone", () => {
    const onStart = vi.fn();
    mount(<DiscussedSection counts={{ topics: 0, replies: 0, started: 0 }} rows={[]} isMaker onStart={onStart} />);
    const section = screen.getByRole("region", { name: "Discussed in OpenBuilds" });
    expect(within(section).queryAllByRole("listitem")).toHaveLength(0);
    fireEvent.click(within(section).getByRole("button", { name: START_TOPIC }));
    expect(onStart).toHaveBeenCalled();
  });
});

describe("UX-07 P2: the rows", () => {
  it("draws five rows, then Show all opens the rest in place", () => {
    mount(<DiscussedSection counts={{ topics: 7, replies: 0, started: 0 }} rows={rows(7)} isMaker={false} />);
    const section = screen.getByRole("region", { name: "Discussed in OpenBuilds" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(DISCUSSED_ROWS);
    expect(within(section).getByRole("link", { name: "Topic 1" }).getAttribute("href")).toBe("/openbuilds/topics/t0");
    expect(within(section).getAllByText("@maya · in Claude Code · 6 replies")).toHaveLength(5);
    fireEvent.click(within(section).getByRole("button", { name: "Show all" }));
    expect(within(section).getAllByRole("listitem")).toHaveLength(7);
    expect(within(section).queryByRole("button", { name: "Show all" })).toBeNull();
    expect(within(section).queryByRole("button", { name: START_TOPIC })).toBeNull();
  });
});

describe("UX-07 P2: replies on a step", () => {
  const post = (id: string, rootId: string, parentId: string | null, aboutNodeId: string | null) => ({ id, rootId, parentId, aboutNodeId }) as Post;

  it("counts the replies about each step and picks the topic with the most", () => {
    const map = stepRepliesOf([post("a", "t1", "t1", "n4"), post("b", "t2", "t2", "n4"), post("c", "t2", "b", "n4"), post("t3", "t3", null, "n4"), post("d", "t1", "t1", null)]);
    expect(map.get("n4")).toEqual({ count: 3, rootId: "t2" });
    expect(map.has("n5")).toBe(false);
  });

  it("draws `2 replies` on the step's head, leading to that topic at the step", () => {
    mount(
      <BuildConnectionsProvider value={{ save: null, usedIn: new Map(), stepReplies: new Map([["n4", { count: 2, to: "/openbuilds/topics/t2?step=n4" }]]) }}>
        <StepRepliesMark id="n4" />
        <StepRepliesMark id="n5" />
      </BuildConnectionsProvider>,
    );
    const link = screen.getByRole("link", { name: "2 replies" });
    expect(link.getAttribute("href")).toBe("/openbuilds/topics/t2?step=n4");
    expect(screen.getAllByTestId("step-replies")).toHaveLength(1);
  });
});
