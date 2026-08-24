// Acceptance cover for "Set as hero" (NS-P12).
//
// The control writes ONE column, builds.hero_node_id, and everything else
// about the hero is read from it: the build page resolves whatever it points
// at, and BuildHeader is not touched by this prompt at all (see
// BuildPage.test.tsx for the other half of that).
//
// What matters here is which nodes can be pointed at. A node with no media on
// it is not a hero — pointing at one would leave the header with nothing to
// render and the creator with no way to tell why.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Build, BuildPatch } from "@/lib/build";
import { ComposeTopBar } from "./ComposeTopBar";

// The publish control beside this one reads the build's explanation layers
// (NS-P23), so the bar now needs a QueryClient and one stubbed read. Neither
// has anything to do with the hero.
vi.mock("@/lib/build", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build")>()),
  getLayers: () => Promise.resolve([]),
}));

function makeBuild(heroNodeId: string | null): Build {
  return {
    id: "build-1",
    slug: "a-build",
    title: "A build",
    shape: "other",
    hero_node_id: heroNodeId,
  } as unknown as Build;
}

function renderBar({
  heroNodeId = null,
  selectedNodeId = null,
  heroEligible = false,
}: {
  heroNodeId?: string | null;
  selectedNodeId?: string | null;
  heroEligible?: boolean;
}) {
  const onPatch = vi.fn<(patch: BuildPatch) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
    <MemoryRouter>
      <TooltipProvider>
        <ComposeTopBar
          build={makeBuild(heroNodeId)}
          isSaving={false}
          lastSavedAt={null}
          saveError={null}
          onPatch={onPatch}
          selectedNodeId={selectedNodeId}
          heroEligible={heroEligible}
          tree={[]}
          nodeTypes={[]}
          completeness={null}
          onPublish={() => Promise.reject(new Error("not under test"))}
          isPublishing={false}
          publishError={null}
        />
      </TooltipProvider>
    </MemoryRouter>
    </QueryClientProvider>
  );
  return { onPatch };
}

describe("the hero control", () => {
  it("is offered but not usable with nothing selected", () => {
    renderBar({});
    const button = screen.getByRole("button", { name: "Set as hero" });
    expect(button).toBeDisabled();
  });

  it("stays disabled for a node that resolves to no media", () => {
    renderBar({ selectedNodeId: "node-1", heroEligible: false });
    expect(screen.getByRole("button", { name: "Set as hero" })).toBeDisabled();
  });

  it("writes hero_node_id for a node that carries media", () => {
    const { onPatch } = renderBar({ selectedNodeId: "node-1", heroEligible: true });
    const button = screen.getByRole("button", { name: "Set as hero" });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onPatch).toHaveBeenCalledWith({ hero_node_id: "node-1" });
  });

  it("reads as the hero once it is one, and clears back to none", () => {
    const { onPatch } = renderBar({
      heroNodeId: "node-1",
      selectedNodeId: "node-1",
      // Eligibility is irrelevant to a node that is already the hero: it can
      // always be cleared, even if its media has since been removed.
      heroEligible: false,
    });

    const button = screen.getByRole("button", { name: "Hero" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(button);
    expect(onPatch).toHaveBeenCalledWith({ hero_node_id: null });
  });
});
