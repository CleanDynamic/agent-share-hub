// G2: every one of the nine loading placeholders keeps an h1: hidden, marked as a placeholder, named for the page's kind.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { BuildViewSkeleton } from "@/pages/site/build/BuildViewSkeleton";
import { ComposeSkeleton } from "@/pages/site/compose/ComposeSkeleton";
import { PostLoadingView } from "@/pages/site/openbuilds/PostFrame";
import { ProfileViewSkeleton } from "@/pages/site/profile/ProfileView";
import { RebuildViewSkeleton } from "@/pages/site/rebuild/RebuildView";

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

const titles = (container: HTMLElement) => Array.from(container.querySelectorAll("h1")).map((h) => ({ text: h.textContent, placeholder: h.hasAttribute("data-h1-placeholder"), inStatus: Boolean(h.closest('[role="status"]')) }));

describe("G2: the loading placeholders keep an h1", () => {
  it.each([
    ["Build", <BuildViewSkeleton key="b" />],
    ["Build", <ComposeSkeleton key="c" />],
    ["Post", <PostLoadingView key="p" />],
    ["Profile", <ProfileViewSkeleton key="pr" />],
    ["Compare", <RebuildViewSkeleton key="cmp" title="Compare" label="Loading the two builds" />],
    ["Lineage", <RebuildViewSkeleton key="l" title="Lineage" label="Loading the family" />],
  ])("%s", (kind, node) => {
    const { container } = wrap(node);
    expect(titles(container)).toEqual([{ text: kind, placeholder: true, inStatus: false }]);
  });

  it("a ghost of the composer's skeleton, fading over the real page, has none", () => {
    const { container } = wrap(<ComposeSkeleton ghost />);
    expect(container.querySelectorAll("h1")).toHaveLength(0);
  });
});
