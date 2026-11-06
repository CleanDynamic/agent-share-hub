// UX-07 P5: UX-04's notifications about topics and replies, in the existing notification row, unchanged. Each leads to the topic,
// at the reply where there is one (`#reply-<id>`).

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { activityFixture } from "@/dev/fixtures/activity";
import { notificationHref, type Notification } from "@/lib/notifications";
import { ActivityView } from "@/pages/site/activity/ActivityView";
import { activityRowOf } from "@/pages/site/activity/activityModel";

afterEach(cleanup);

const row = (kind: string, body: string, target: { id: string; root: string }, build: Notification["build"] = null): Notification => ({
  id: `n-${kind}`,
  recipient_id: "me",
  actor_id: "actor-1",
  notification_type: kind,
  kind,
  body,
  target_type: "post",
  target_id: target.id,
  metadata: build ? { build_id: build.id } : {},
  is_read: false,
  read_at: null,
  created_at: "2026-11-04T10:00:00.000Z",
  actor: { id: "actor-1", username: "maya", display_name: "Maya Okafor", avatar_url: null },
  target: { id: target.id, type: "post", title: "Which model for a code review step?", slug: null, extra: { root_id: target.root } },
  build,
});

const KINDS: [string, Notification, string, string][] = [
  ["a reply", row("post_reply", "replied to your topic", { id: "r1", root: "t1" }), "Maya Okafor replied to your topic", "/openbuilds/topics/t1#reply-r1"],
  ["a reply in a topic", row("post_thread", "replied in your topic", { id: "r2", root: "t1" }), "Maya Okafor replied in your topic", "/openbuilds/topics/t1#reply-r2"],
  ["a mention", row("post_mention", "mentioned you", { id: "t1", root: "t1" }), "Maya Okafor mentioned you", "/openbuilds/topics/t1"],
  ["a like", row("post_like", "liked your reply", { id: "r1", root: "t1" }), "Maya Okafor liked your reply", "/openbuilds/topics/t1#reply-r1"],
  ["a pin", row("post_pinned", "pinned your reply", { id: "r1", root: "t1" }), "Maya Okafor pinned your reply", "/openbuilds/topics/t1#reply-r1"],
  ["a topic from your build", row("post_started", "started a topic from your build", { id: "t3", root: "t3" }, { id: "b1", slug: "resume-screener", title: "Resume screener" }), "Maya Okafor started a topic from your build", "/openbuilds/topics/t3"],
];

describe("UX-07 P5: the kinds about topics and replies", () => {

  it("leads nowhere while the topic is unknown (hidden, or not yet resolved)", () => {
    expect(notificationHref({ ...KINDS[0][1], target: null })).toBeNull();
  });
});

describe("UX-07 P5: the Activity page's row (SV-20), unchanged", () => {
  it.each(KINDS)("draws %s as who, the fixed words and the topic, leading to the topic", (_, notification, sentence, href) => {
    const row = activityRowOf(notification, null);
    expect(row.who).toBe(sentence.replace("Maya Okafor", "@maya"));
    expect(row.title).toBe(notification.kind === "post_started" ? "Resume screener" : "Which model for a code review step?");
    expect(row.href).toBe(href);
    const fixture = activityFixture();
    render(
      <MemoryRouter>
        <ActivityView fit="content" {...fixture} list={{ ...fixture.list, groups: [{ day: "Today", rows: [row] }] }} />
      </MemoryRouter>,
    );
    const drawn = screen.getByTestId("activity-row");
    expect(drawn.getAttribute("href")).toBe(href);
    expect(drawn.textContent).toContain(row.who);
    cleanup();
  });
});
