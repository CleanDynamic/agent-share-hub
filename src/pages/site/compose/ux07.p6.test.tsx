// UX-07 P6: the maker's opt-out. In the Classification sheet's Build details, beside the other details: the switch Others can start
// topics from this build (on by default) and its note. It writes builds.allow_as_post_source through the build layer, and never
// blocks publishing.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const read = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: () => read() }) }) }) }) },
}));

import { sandboxViewProps } from "@/dev/fixtures/sandbox";
import { CHECKLIST_COPY } from "@/lib/build/publishChecklist";
import type { Build } from "@/lib/build/types";

import { SandboxCard, TOPIC_SOURCE_LABEL, TOPIC_SOURCE_NOTE, type SandboxCardProps } from "./SandboxCard";
import { useComposeDetails } from "./useComposeDetails";
import type { ComposeNodes } from "./useComposeNodes";

beforeEach(() => {
  read.mockReset();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const card = () => screen.getByTestId("sandbox-card");
const row = (name: string) => within(card()).getByRole("button", { name: new RegExp(`^${name}`) });

function mount(over: Partial<SandboxCardProps>) {
  const props: SandboxCardProps = { ...sandboxViewProps("bakery"), title: "Bakery homepage", description: "", onTitle: vi.fn(), onDescription: vi.fn(), onFiles: vi.fn(), open: true, onOpenChange: vi.fn(), field: null, phone: false, ...over };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SandboxCard {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("UX-07 P6: the switch in the Card", () => {
  it("sits in Build details, on by default, with its note, and Save writes it", async () => {
    const onTopicSourceSwitch = vi.fn();
    mount({ onTopicSourceSwitch });
    fireEvent.click(row("Build details"));
    expect(screen.queryByText("Open a bounty")).toBeNull();
    fireEvent.click(row("Topics"));
    const toggle = screen.getByRole("switch", { name: TOPIC_SOURCE_LABEL });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("topic-source-note").textContent).toBe(TOPIC_SOURCE_NOTE);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onTopicSourceSwitch).toHaveBeenCalledWith(false));
  });

  it("is not offered where the page gives no way to write it", () => {
    mount({});
    fireEvent.click(row("Build details"));
    expect(within(card()).queryByRole("button", { name: /^Topics/ })).toBeNull();
  });
});

describe("UX-07 P6: the column", () => {
  const nodes = { tree: [], run: (step: () => Promise<void>) => step(), current: () => [], record: () => undefined, settled: () => Promise.resolve() } as unknown as ComposeNodes;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;

  it("reads builds.allow_as_post_source, and writes it through the page's header edit (updateBuild)", async () => {
    read.mockResolvedValue({ data: { allow_as_post_source: true }, error: null });
    const edit = vi.fn();
    const build = { id: "b1", cost_monthly: null, cost_setup: null, time_to_first_result: null } as unknown as Build;
    const { result } = renderHook(() => useComposeDetails({ build, hydrate: true, nodes, ensureBuild: () => Promise.resolve("b1"), edit }), { wrapper });
    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(result.current.details.allowAsTopicSource).toBe(true);
    act(() => result.current.setAllowAsTopicSource(false));
    expect(edit).toHaveBeenCalledWith({ allow_as_post_source: false });
    expect(result.current.details.allowAsTopicSource).toBe(false);
  });

  it("reads as off when the maker switched it off", async () => {
    read.mockResolvedValue({ data: { allow_as_post_source: false }, error: null });
    const build = { id: "b2", cost_monthly: null, cost_setup: null, time_to_first_result: null } as unknown as Build;
    const { result } = renderHook(() => useComposeDetails({ build, hydrate: true, nodes, ensureBuild: () => Promise.resolve("b2"), edit: vi.fn() }), { wrapper });
    await waitFor(() => expect(result.current.details.allowAsTopicSource).toBe(false));
  });

  it("is no checklist item, so it never blocks publishing", () => {
    expect(JSON.stringify(CHECKLIST_COPY).toLowerCase()).not.toContain("topic");
  });
});
