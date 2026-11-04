// UX-05 Part 4: the attach picker. Its size switch, its search, its groups and the rows in them.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listAttachableWork = vi.fn();

vi.mock("@/lib/openbuilds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openbuilds")>()),
  listAttachableWork: (options: unknown) => listAttachableWork(options),
  labelAttachable: async (works: { label?: string; title: string; buildTitle: string; origin: string }[]) =>
    works.map((work) => ({ ...work, label: work.origin === "others" ? `@kit · ${work.title}` : work.title, context: work.buildTitle, handle: work.origin === "others" ? "kit" : null })),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { AttachPicker } from "./AttachPicker";

const work = (origin: string, title: string, extra: Record<string, unknown> = {}) => ({
  size: "build",
  origin,
  buildId: `b-${title}`,
  buildTitle: "Resume screener",
  nodeId: null,
  partKey: null,
  sessionKey: null,
  title,
  makerId: origin === "others" ? "kit" : "me",
  ...extra,
});

function draw(onPick = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AttachPicker userId="me" onPick={onPick} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Attach work" }));
  return onPick;
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  listAttachableWork.mockReset().mockResolvedValue([work("draft", "Scorer draft"), work("published", "Resume screener"), work("earlier_post", "Interview bot"), work("others", "Cover letter checker")]);
});

describe("AttachPicker", () => {
  it("offers Build, Part, Session and Step, and a search field that says e.g. screener", async () => {
    draw();
    const sizes = await screen.findByRole("group", { name: "Size of work" });
    expect(within(sizes).getAllByRole("button").map((button) => button.textContent)).toEqual(["Build", "Part", "Session", "Step"]);
    expect(screen.getByPlaceholderText("e.g. screener")).toBeInTheDocument();
  });

  it("groups the work: Your drafts, Your published builds, Your posts and replies, Other people's, in that order", async () => {
    draw();
    await screen.findByRole("region", { name: "Your drafts" });
    const heads = screen.getAllByRole("heading", { level: 4 }).map((head) => head.textContent);
    expect(heads).toEqual(["Your drafts", "Your published builds", "Your posts and replies", "Other people's"]);
    const others = screen.getByRole("region", { name: "Other people's" });
    expect(within(others).getByRole("button", { name: /@kit · Cover letter checker/ })).toBeInTheDocument();
  });

  it("asks for work that may go on a root post, so a build whose maker opted out never reaches Other people's", async () => {
    // The read filters on allow_as_post_source (UX-04's test pins that query); the picker shows only what it returns.
    listAttachableWork.mockResolvedValue([work("draft", "Scorer draft")]);
    draw();
    await screen.findByRole("region", { name: "Your drafts" });
    expect(screen.queryByRole("region", { name: "Other people's" })).toBeNull();
    expect(listAttachableWork).toHaveBeenCalledWith({ userId: "me", size: "build", query: undefined });
    expect(listAttachableWork.mock.calls.every(([options]) => (options as { forReply?: boolean }).forReply === undefined)).toBe(true);
  });

  it("rows are 36 high: the name at the left and its context at the right", async () => {
    draw();
    const row = await screen.findByRole("button", { name: /Scorer draft/ });
    expect(row.style.height).toBe("36px");
    expect(row.textContent).toBe("Scorer draftResume screener");
  });

  it("reads again at another size and for what is typed", async () => {
    draw();
    await screen.findByRole("region", { name: "Your drafts" });
    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    await waitFor(() => expect(listAttachableWork).toHaveBeenLastCalledWith({ userId: "me", size: "step", query: undefined }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search work" }), { target: { value: "screener" } });
    await waitFor(() => expect(listAttachableWork).toHaveBeenLastCalledWith({ userId: "me", size: "step", query: "screener" }));
  });

  it("picking a row hands it over and closes the picker", async () => {
    const onPick = draw();
    fireEvent.click(within(await screen.findByRole("region", { name: "Your published builds" })).getByRole("button"));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ origin: "published", buildId: "b-Resume screener" }));
    await waitFor(() => expect(screen.queryByRole("group", { name: "Size of work" })).toBeNull());
  });

  it("says so when there is nothing at that size", async () => {
    listAttachableWork.mockResolvedValue([]);
    draw();
    expect(await screen.findByText("Nothing to attach at this size.")).toBeInTheDocument();
  });
});

// UX-06 Part 2: the picker in a reply box. Someone else's work is listed but cannot be attached (the database refuses it in a
// reply); its row offers Mention instead, which puts their @handle in the box.
describe("AttachPicker in a reply", () => {
  function drawReply(onPick = vi.fn(), onMention = vi.fn()) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AttachPicker userId="me" onPick={onPick} reply={{ onMention }} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Attach work" }));
    return { onPick, onMention };
  }

  it("lists other people's work as rows that cannot be chosen", async () => {
    const { onPick } = drawReply();
    const others = await screen.findByRole("region", { name: "Other people's" });
    const row = within(others).getByText("@kit · Cover letter checker").closest('[aria-disabled="true"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(within(row).getByText("@kit · Cover letter checker")).toHaveStyle({ color: "var(--text-disabled)" });
    fireEvent.click(within(row).getByText("@kit · Cover letter checker"));
    expect(onPick).not.toHaveBeenCalled();
  });

  it("puts the maker's @handle in the box from Mention instead", async () => {
    const { onPick, onMention } = drawReply();
    const others = await screen.findByRole("region", { name: "Other people's" });
    fireEvent.click(within(others).getByRole("button", { name: "Mention @kit instead" }));
    expect(onMention).toHaveBeenCalledWith("kit");
    expect(onPick).not.toHaveBeenCalled();
  });

  it("asks for other people's work too, so it can be listed", async () => {
    drawReply();
    await screen.findByRole("region", { name: "Other people's" });
    expect(listAttachableWork).toHaveBeenCalledWith(expect.objectContaining({ forReply: false }));
  });

  it("still attaches the reader's own work", async () => {
    const { onPick } = drawReply();
    const drafts = await screen.findByRole("region", { name: "Your drafts" });
    fireEvent.click(within(drafts).getByRole("button", { name: /Scorer draft/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ title: "Scorer draft" }));
  });
});
