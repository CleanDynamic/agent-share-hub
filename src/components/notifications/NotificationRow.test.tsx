// RC-P19 — one notification row, rendered.
//
// The claims: a build notification says who, the stored message, the build's
// title and when, and is one link to where it leads; a kind nobody knows says
// its stored message, names nobody, and is not a link.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { NotificationRow } from "@/components/notifications/NotificationRow";
import type { Notification } from "@/lib/notifications";

const BASE: Notification = {
  id: "n-1",
  recipient_id: "me",
  actor_id: "actor-1",
  notification_type: "comment",
  kind: "comment",
  body: "commented on your build",
  target_type: "build_comment",
  target_id: "comment-1",
  metadata: { build_id: "build-1" },
  is_read: false,
  read_at: null,
  created_at: "2026-09-29T10:00:00.000Z",
  actor: { id: "actor-1", username: "maya", display_name: "Maya Okafor", avatar_url: null },
  target: null,
  build: { id: "build-1", slug: "invoice-reader", title: "Invoice reader" },
};

function renderRow(notification: Notification, onOpen = vi.fn()) {
  render(
    <MemoryRouter>
      <NotificationRow notification={notification} onOpen={onOpen} />
    </MemoryRouter>,
  );
  return { row: screen.getByTestId("notification"), onOpen };
}

describe("NotificationRow", () => {
  it("says who, what, which build and when, as one link to the build's comments", () => {
    const { row } = renderRow(BASE);
    expect(screen.getByTestId("notification-message").textContent).toBe("Maya Okafor commented on your build");
    expect(screen.getByTestId("notification-build").textContent).toBe("Invoice reader");
    expect(row.querySelector("time")?.getAttribute("datetime")).toBe("2026-09-29T10:00:00.000Z");
    expect(row.tagName).toBe("A");
    expect(row.getAttribute("href")).toBe("/b2/invoice-reader#comments");
    expect(row.getAttribute("data-unread")).toBe("true");
  });

  it("shows a kind nobody knows as its stored message, naming nobody, and links nowhere", () => {
    const { row } = renderRow({
      ...BASE,
      kind: "made_up_kind",
      notification_type: "made_up_kind",
      body: "Something happened.",
      target_type: null,
      target_id: null,
      metadata: null,
      build: null,
    });
    expect(screen.getByTestId("notification-message").textContent).toBe("Something happened.");
    expect(row.tagName).toBe("DIV");
    expect(row.getAttribute("href")).toBeNull();
  });
});
