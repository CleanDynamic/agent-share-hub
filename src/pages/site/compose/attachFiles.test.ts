import { describe, expect, it, vi } from "vitest";

import { attachFiles } from "./attachFiles";

const file = (name: string) => new File(["x"], name);

describe("attachFiles", () => {
  it("links each new file to the prompt, in the order given", async () => {
    const order: string[] = [];
    const add = vi.fn(async (f: File) => {
      order.push(`add ${f.name}`);
      return { id: `id-${f.name}` };
    });
    const link = vi.fn((_step: string, use: { node_id: string }) => void order.push(`link ${use.node_id}`));
    await attachFiles("p1", [file("a.md"), file("b.md")], add, link);
    expect(order).toEqual(["add a.md", "link id-a.md", "add b.md", "link id-b.md"]);
    expect(link).toHaveBeenCalledWith("p1", { kind: "file", node_id: "id-a.md" });
  });

  it("skips a refused file and carries on with the rest", async () => {
    const add = vi.fn(async (f: File) => (f.name === ".env" ? null : { id: f.name }));
    const link = vi.fn();
    await attachFiles("p1", [file("a.md"), file(".env"), file("c.md")], add, link);
    expect(link.mock.calls.map((call) => call[1].node_id)).toEqual(["a.md", "c.md"]);
  });
});
