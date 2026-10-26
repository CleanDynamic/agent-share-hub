// SV-03 P4: the classification comes with the list, not from a read after it.

import { describe, expect, it, vi } from "vitest";

const selects: string[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, name) => {
        if (name === "then") return (resolve: (value: unknown) => void) => resolve({ data: [], error: null, count: 0 });
        return () => chain;
      },
    },
  );
  return {
    supabase: {
      from: () => ({
        select: (columns: string) => {
          selects.push(columns);
          return chain;
        },
      }),
    },
  };
});

import { listGallery, toGalleryBuild, type GalleryRow } from "./gallery";

describe("listGallery", () => {
  it("selects the classification column in its one request", async () => {
    await listGallery({});
    expect(selects[0]).toMatch(/, classification, ?|, classification$/);
  });
});

describe("toGalleryBuild", () => {
  const base = { id: "b1", build_nodes: [], build_media: [], bounties: [] } as unknown as GalleryRow;

  it("reads a classification that came with the row, and keeps no raw column on the card", () => {
    const built = toGalleryBuild({ ...base, classification: { version: 1, declared: { field: [{ id: "ai-ml" }] } } } as unknown as GalleryRow);
    expect(built.classifiedAs).toBeTruthy();
    expect("classification" in built).toBe(false);
  });

  it("leaves it off for an empty classification and for a read that did not ask", () => {
    expect(toGalleryBuild({ ...base, classification: {} } as unknown as GalleryRow).classifiedAs).toBeUndefined();
    expect(toGalleryBuild(base).classifiedAs).toBeUndefined();
  });
});
