// UX-07 P7: the reactions a space can switch on: absent by default, present only for the kinds every one of the topic's spaces
// switched on, and the rating group a real radio group (one tab stop, the arrow keys).

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PostCard } from "@/components/post/PostCard";
import type { PostCardData } from "@/components/post/postCardModel";
import { NO_REACTIONS, enabledReactions, foldReactions } from "@/lib/openbuilds/postPage";

import { ReactionRow, ratingWords } from "./ReactionRow";

afterEach(cleanup);

const CARD: PostCardData = {
  id: "t1",
  to: "/openbuilds/topics/t1",
  author: { id: "maya", name: "Maya Chen", handle: "maya", avatarUrl: null },
  age: "2h",
  spaces: [],
  reward: null,
  heading: "Which model for a code review step?",
  text: "",
  attachments: [],
  stillOpen: false,
  tags: [],
  closes: null,
  replies: null,
  pinned: false,
  hidden: null,
  engagementBuild: null,
};

describe("UX-07 P7: which kinds are on", () => {
  it("is none for a topic in no space, and only what every space switched on", () => {
    expect(enabledReactions([])).toEqual([]);
    expect(enabledReactions([{ reactions: [] }])).toEqual([]);
    expect(enabledReactions([{ reactions: ["dislike", "rating"] }])).toEqual(["dislike", "rating"]);
    expect(enabledReactions([{ reactions: ["dislike", "rating"] }, { reactions: ["rating"] }])).toEqual(["rating"]);
    expect(enabledReactions([{ reactions: ["dislike"] }, { reactions: ["rating"] }])).toEqual([]);
  });

  it("folds the rows per post, with the reader's own", () => {
    const folded = foldReactions(
      [
        { post_id: "t1", user_id: "me", kind: "rating", value: 4 },
        { post_id: "t1", user_id: "u2", kind: "rating", value: 5 },
        { post_id: "t1", user_id: "u3", kind: "dislike", value: null },
      ],
      "me",
    );
    expect(folded.get("t1")).toEqual({ dislikes: 1, disliked: false, ratings: 2, average: 4.5, mine: 4 });
    expect(ratingWords(4.2, 9)).toBe("4.2 from 9");
  });
});

describe("UX-07 P7: the row", () => {
  const row = (kinds: ("dislike" | "rating")[], reactions = NO_REACTIONS, handlers = { onDislike: vi.fn(), onRate: vi.fn() }) => (
    <ReactionRow kinds={kinds} reactions={reactions} what="topic" {...handlers} />
  );

  it("is absent by default, on a card and in the row itself", () => {
    const { container } = render(<MemoryRouter><PostCard card={CARD} /></MemoryRouter>);
    expect(container.querySelector('[data-testid="reaction-row"]')).toBeNull();
    cleanup();
    const empty = render(row([]));
    expect(empty.container.innerHTML).toBe("");
  });

  it("draws only the enabled kinds", () => {
    render(<MemoryRouter><PostCard card={CARD} reactions={row(["rating"])} /></MemoryRouter>);
    const drawn = screen.getByTestId("reaction-row");
    expect(within(drawn).getByRole("radiogroup", { name: "Rate this topic" })).toBeTruthy();
    expect(within(drawn).queryByRole("button", { name: /^Dislike/ })).toBeNull();
    cleanup();
    render(row(["dislike"]));
    expect(screen.getByRole("button", { name: "Dislike" })).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("gives Dislike aria-pressed and a count after it, hidden at zero", () => {
    const onDislike = vi.fn();
    render(row(["dislike"], NO_REACTIONS, { onDislike, onRate: vi.fn() }));
    const button = screen.getByRole("button", { name: "Dislike" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(onDislike).toHaveBeenCalledWith(true);
    cleanup();
    render(row(["dislike"], { ...NO_REACTIONS, dislikes: 3, disliked: true }));
    expect(screen.getByRole("button", { name: "Dislike 3" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows `4.2 from 9` once anyone has rated, and nothing before", () => {
    render(row(["rating"]));
    expect(screen.queryByTestId("rating-summary")).toBeNull();
    cleanup();
    render(row(["rating"], { ...NO_REACTIONS, ratings: 9, average: 4.2, mine: 4 }));
    expect(screen.getByTestId("rating-summary").textContent).toBe("4.2 from 9");
  });
});

describe("UX-07 P7: the rating group's keyboard", () => {
  it("is one tab stop, and the arrow keys, Home and End move and choose", () => {
    const onRate = vi.fn();
    render(<ReactionRow kinds={["rating"]} reactions={{ ...NO_REACTIONS, ratings: 1, average: 3, mine: 3 }} what="reply" onDislike={vi.fn()} onRate={onRate} />);
    const group = screen.getByRole("radiogroup", { name: "Rate this reply" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(radios.map((radio) => radio.getAttribute("tabindex"))).toEqual(["-1", "-1", "0", "-1", "-1"]);
    expect(radios[2].getAttribute("aria-checked")).toBe("true");
    expect(radios[2].getAttribute("aria-label")).toBe("3 of 5");

    fireEvent.keyDown(radios[2], { key: "ArrowRight" });
    expect(onRate).toHaveBeenLastCalledWith(4);
    expect(document.activeElement).toBe(radios[3]);
    fireEvent.keyDown(radios[2], { key: "ArrowLeft" });
    expect(onRate).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(radios[2], { key: "Home" });
    expect(onRate).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(radios[2], { key: "End" });
    expect(onRate).toHaveBeenLastCalledWith(5);
    fireEvent.keyDown(radios[4], { key: "ArrowRight" });
    expect(onRate).toHaveBeenLastCalledWith(1);
  });

  it("puts the one tab stop on the first rating when the reader has none", () => {
    render(<ReactionRow kinds={["rating"]} reactions={NO_REACTIONS} what="topic" onDislike={vi.fn()} onRate={vi.fn()} />);
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1", "-1"]);
  });
});
