// Mobile prompt 26 Part D: the Messages list on a phone: pills, a search pill, rows with the unread square, the round New message button.

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessagesThreadList } from "@/components/messages/MessagesThreadList";

afterEach(() => vi.unstubAllGlobals());

const thread = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: "direct" as const,
  title: `Person ${id}`,
  avatarUrls: [],
  lastMessage: { kind: "text" as const, preview: "Hello there", isFromCurrentUser: false, timestamp: "2m" },
  unreadCount: 0,
  isPinned: false,
  ...over,
});

function mount(threads = [thread("a", { unreadCount: 2 }), thread("b")], onCompose = vi.fn()) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: !query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined }));
  render(
    <MemoryRouter>
      <MessagesThreadList threads={threads} activeTab="primary" onTabChange={vi.fn()} query="" onQueryChange={vi.fn()} activeThreadId={null} onThreadClick={vi.fn()} onCompose={onCompose} counts={{ primary: 2, requests: 0 }} />
    </MemoryRouter>,
  );
  return onCompose;
}

describe("MessagesThreadList on a phone", () => {
  it("is its own screen: pills, a search pill, rows with an unread square, and a round New message button", () => {
    const onCompose = mount();
    expect(screen.getByTestId("messages-list-phone")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Messages" }).className).toBe("sr-only");
    expect(screen.getByRole("button", { name: "Primary" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Search conversations" })).toBeTruthy();
    expect(screen.getAllByTestId("thread-row")).toHaveLength(2);
    expect(screen.getAllByTestId("thread-unread")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Compose new message" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "New message" }));
    expect(onCompose).toHaveBeenCalledTimes(1);
  });

  it("says No conversations yet when there are none", () => {
    mount([]);
    expect(screen.getByText("No conversations yet")).toBeTruthy();
  });
});
