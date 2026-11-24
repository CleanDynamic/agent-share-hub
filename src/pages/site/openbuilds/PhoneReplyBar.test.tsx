// Prompt 21: the phone's reply bar: Attach work, the field at 16px, Reply disabled until there is something to send.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { dockAwayFor } from "@/components/shell/phoneTopBar";

import { PhoneReplyBar, attachmentLabel, type PhoneReplyBarProps } from "./PhoneReplyBar";

vi.mock("@/lib/openbuilds", async (original) => ({ ...(await original<typeof import("@/lib/openbuilds")>()), listAttachableWork: vi.fn(async () => []) }));

const props = (over: Partial<PhoneReplyBarProps> = {}): PhoneReplyBarProps => ({
  id: "reply-box",
  fieldId: "f",
  placeholder: "Reply with words, work, or both",
  body: "",
  onBody: vi.fn(),
  area: { current: null },
  viewerId: "u1",
  signInTo: "/login",
  hasContent: false,
  uploading: false,
  onSend: vi.fn(),
  onPick: vi.fn(),
  onFile: vi.fn(),
  onTile: vi.fn(),
  tileOpen: false,
  about: null,
  onRemoveAbout: vi.fn(),
  attachment: null,
  tile: null,
  notice: null,
  ...over,
});

const mount = (over: Partial<PhoneReplyBarProps> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <PhoneReplyBar {...props(over)} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("PhoneReplyBar", () => {
  it("has a 44 round Attach work button and a 16px field, and Reply waits for something to send", () => {
    mount();
    const plus = screen.getByRole("button", { name: "Attach work" });
    expect([plus.style.width, plus.style.height]).toEqual(["44px", "44px"]);
    expect(screen.getByPlaceholderText("Reply with words, work, or both").style.fontSize).toBe("16px");
    expect((screen.getByRole("button", { name: "Reply" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends once there is text or an attachment", () => {
    const onSend = vi.fn();
    mount({ hasContent: true, onSend });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(onSend).toHaveBeenCalled();
  });

  it("shows the attachment as a card with a 44 remove button", () => {
    const onRemove = vi.fn();
    mount({ hasContent: true, attachment: { label: "Call notes", onRemove } });
    const remove = screen.getByRole("button", { name: "Remove the attachment" });
    expect(remove.style.height).toBe("44px");
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalled();
  });

  it("opens the Attach work sheet", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Attach work" }));
    expect(await screen.findByTestId("attach-sheet")).toBeTruthy();
  });

  it("signed out, Reply is the sign-in link", () => {
    mount({ viewerId: null });
    expect(screen.getByRole("link", { name: "Reply" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("button", { name: "Attach work" })).toBeNull();
  });
});

describe("attachmentLabel and the dock", () => {
  it("names an attachment in one line", () => {
    expect(attachmentLabel({ kind: "file", key: "k", name: "notes.txt", href: null })).toBe("notes.txt");
  });
  it("slides the dock away on a topic only", () => {
    expect(dockAwayFor("/openbuilds/topics/abc")).toBe(true);
    expect(dockAwayFor("/openbuilds/topics/abc/")).toBe(true);
    expect(dockAwayFor("/openbuilds")).toBe(false);
    expect(dockAwayFor("/openbuilds/spaces/x")).toBe(false);
  });
});
