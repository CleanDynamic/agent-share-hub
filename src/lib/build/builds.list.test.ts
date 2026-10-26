// SV-03 P2: a list of builds is read with the light columns. `post_doc` and `making` are the large ones, and a list
// never draws them; opening one build still reads BUILD_COLUMNS.

import { beforeEach, describe, expect, it, vi } from "vitest";

const selects: string[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const query: Record<string, unknown> = {};
  for (const method of ["eq", "order", "range"]) query[method] = () => query;
  query.limit = () => Promise.resolve({ data: [], error: null });
  return {
    supabase: {
      from: () => ({
        select: (columns: string) => {
          selects.push(columns);
          return query;
        },
      }),
    },
  };
});

import { BUILD_COLUMNS, BUILD_LIST_COLUMNS, listBuildsByCreator, listDraftBuildsByCreator } from "./builds";

beforeEach(() => {
  selects.length = 0;
});

const columns = (list: string) => list.split(",").map((column) => column.trim());

describe("BUILD_LIST_COLUMNS", () => {
  it("is BUILD_COLUMNS without the post and the making, and nothing else removed", () => {
    expect(columns(BUILD_LIST_COLUMNS)).toEqual(columns(BUILD_COLUMNS).filter((column) => column !== "post_doc" && column !== "making"));
    expect(columns(BUILD_COLUMNS)).toEqual(expect.arrayContaining(["post_doc", "making"]));
    expect(columns(BUILD_LIST_COLUMNS)).not.toContain("post_doc");
    expect(columns(BUILD_LIST_COLUMNS)).not.toContain("making");
  });

  it("is what a maker's builds and a maker's drafts are read with", async () => {
    await listBuildsByCreator("u1");
    await listDraftBuildsByCreator("u1");
    expect(selects).toEqual([BUILD_LIST_COLUMNS, BUILD_LIST_COLUMNS]);
  });
});
