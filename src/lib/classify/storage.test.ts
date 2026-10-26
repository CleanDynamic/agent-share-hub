import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateBuild = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/lib/build/builds", () => ({ updateBuild: (...args: unknown[]) => updateBuild(...args) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) }) },
}));

import { emptyClassification } from "./facets";
import { getClassification, resetClassificationColumns, writeClassification } from "./storage";

const c = () => ({ ...emptyClassification(), declared: { ...emptyClassification().declared, field: [{ id: "law" }] } });

beforeEach(() => {
  resetClassificationColumns();
  updateBuild.mockReset();
  maybeSingle.mockReset();
});
afterEach(() => resetClassificationColumns());

describe("getClassification", () => {
  it("reads the stored classification and says the columns are live", async () => {
    maybeSingle.mockResolvedValue({ data: { classification: { declared: { age: "all-ages" } }, facets: ["age:all-ages", 4] }, error: null });
    const got = await getClassification("b1");
    expect(got.live).toBe(true);
    expect(got.classification.declared.age).toBe("all-ages");
    expect(got.facets).toEqual(["age:all-ages"]);
  });

  it("says not live when the column is missing, and does not ask again", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "42703", message: "column builds.classification does not exist" } });
    expect((await getClassification("b1")).live).toBe(false);
    expect((await getClassification("b1")).live).toBe(false);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("says not live for any other failure, without remembering it", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "500", message: "boom" } });
    expect((await getClassification("b1")).live).toBe(false);
    maybeSingle.mockResolvedValue({ data: { classification: {}, facets: [] }, error: null });
    expect((await getClassification("b1")).live).toBe(true);
  });
});

describe("writeClassification", () => {
  it("writes the classification with facets worked out from it", async () => {
    updateBuild.mockResolvedValue({});
    const result = await writeClassification("b1", c());
    expect(result).toEqual({ written: true, missing: false });
    expect(updateBuild).toHaveBeenCalledWith("b1", expect.objectContaining({ facets: ["field:law"] }));
  });

  it("writes the shape on its own first, so it lands before the migration", async () => {
    updateBuild.mockImplementation(async (_id: string, patch: Record<string, unknown>) => {
      if ("classification" in patch) throw { code: "PGRST204", message: "Could not find the 'classification' column" };
      return {};
    });
    const result = await writeClassification("b1", c(), { shape: "app" });
    expect(updateBuild).toHaveBeenNthCalledWith(1, "b1", { shape: "app" });
    expect(result).toEqual({ written: false, missing: true });
    // remembered: no second attempt at the columns
    await writeClassification("b1", c());
    expect(updateBuild).toHaveBeenCalledTimes(2);
  });

  it("throws any failure that is not a missing column", async () => {
    updateBuild.mockRejectedValue({ code: "23514", message: "check violated" });
    await expect(writeClassification("b1", c())).rejects.toBeTruthy();
  });
});

describe("SV-05 P7 · what counts as a missing column", () => {
  it("is the error's code only: Postgres 42703 or PostgREST PGRST204", async () => {
    const { isMissingColumn } = await import("./storage");
    expect(isMissingColumn({ code: "42703", message: "column builds.classification does not exist" })).toBe(true);
    expect(isMissingColumn({ code: "PGRST204", message: "Could not find the 'facets' column" })).toBe(true);
    expect(isMissingColumn({ message: "x", cause: { code: "42703" } })).toBe(true);
  });

  it("never reads the message: another error that mentions classification is not a missing column", async () => {
    const { isMissingColumn } = await import("./storage");
    expect(isMissingColumn({ code: "23514", message: "new row for relation builds violates check constraint classification_shape" })).toBe(false);
    expect(isMissingColumn({ message: "facets could not be saved" })).toBe(false);
    expect(isMissingColumn(new Error("classification"))).toBe(false);
    expect(isMissingColumn(null)).toBe(false);
  });
});
