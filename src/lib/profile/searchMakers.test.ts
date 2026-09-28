// RC-P07 — makers a search matches: three at most, the reader's text matched
// literally, and no query text in an error (CONTRACT §9).

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const calls: { table?: string; select?: string; or?: string; order?: string; limit?: number } = {};
  const result: { data: unknown; error: unknown } = { data: [], error: null };
  const chain = {
    select: (columns: string) => {
      calls.select = columns;
      return chain;
    },
    or: (filter: string) => {
      calls.or = filter;
      return chain;
    },
    order: (column: string) => {
      calls.order = column;
      return chain;
    },
    limit: (count: number) => {
      calls.limit = count;
      return Promise.resolve(result);
    },
  };
  return { calls, result, chain };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      mocks.calls.table = table;
      return mocks.chain;
    },
  },
}));

import { searchMakers } from "./searchMakers";

beforeEach(() => {
  for (const key of Object.keys(mocks.calls)) delete (mocks.calls as Record<string, unknown>)[key];
  mocks.result.data = [];
  mocks.result.error = null;
});

describe("searchMakers", () => {
  it("asks profiles for four columns, by username, and at most 3", async () => {
    mocks.result.data = [{ id: "p1", username: "maya", display_name: "Maya Okafor", avatar_url: null }];

    const hits = await searchMakers("maya");

    expect(mocks.calls.table).toBe("profiles");
    expect(mocks.calls.select).toBe("id, username, display_name, avatar_url");
    expect(mocks.calls.or).toBe('username.ilike."%maya%",display_name.ilike."%maya%"');
    expect(mocks.calls.order).toBe("username");
    expect(mocks.calls.limit).toBe(3);
    expect(hits).toEqual(mocks.result.data);
  });

  it("escapes %, _ and \\ so the reader's text is matched literally", async () => {
    await searchMakers("50%_a\\b");

    /* LIKE sees %50\%\_a\\b% — the reader's %, _ and \ escaped — and PostgREST,
       which takes one backslash per character inside a quoted value, is sent
       each of those backslashes doubled. */
    const value = '"%50\\\\%\\\\_a\\\\\\\\b%"';
    expect(mocks.calls.or).toBe(`username.ilike.${value},display_name.ilike.${value}`);
  });

  it("keeps a comma or a bracket inside the quoted value", async () => {
    await searchMakers('a,b) "c"');
    expect(mocks.calls.or).toBe(
      'username.ilike."%a,b) \\"c\\"%",display_name.ilike."%a,b) \\"c\\"%"',
    );
  });

  it("throws an error with no query text in it", async () => {
    mocks.result.error = { code: "42501", message: 'denied for "private name"' };

    let thrown: Error | null = null;
    try {
      await searchMakers("private name");
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown!.message).toBe("searchMakers failed: code 42501");
    expect(thrown!.message).not.toContain("private name");
  });
});
