// F1: dropping a file this does not read says which types it does, and adds nothing.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/build/nodeTypes", () => ({ getNodeTypes: () => Promise.resolve([]) }));

import { couldBeBuildFile, useBuildFileDrop } from "./useBuildFileDrop";

const transferOf = (types: string[]) => ({ items: types.map((type) => ({ kind: "file", type })) }) as unknown as DataTransfer;

describe("F1 · an unsupported file", () => {
  it("refuses a.docx with a message naming the allowed types, and adds no file", async () => {
    const { result } = renderHook(() => useBuildFileDrop());
    await act(async () => {
      await result.current.acceptFile(new File(["x"], "a.docx"));
    });
    const state = result.current.state;
    expect(state.name).toBe("failed");
    if (state.name !== "failed") return;
    expect(state.errors[0].message).toBe("a.docx is not one of .md, .json, .txt.");
    expect(state.errors[0].code).toBe("WRONG_FILE_KIND");
  });

  it("shows no highlight only when every dragged item has a type that cannot be accepted", () => {
    expect(couldBeBuildFile(transferOf(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]))).toBe(false);
    expect(couldBeBuildFile(transferOf(["image/png", "application/pdf"]))).toBe(false);
    expect(couldBeBuildFile(transferOf([""]))).toBe(true);
    expect(couldBeBuildFile(transferOf(["text/markdown"]))).toBe(true);
    expect(couldBeBuildFile(transferOf(["image/png", ""]))).toBe(true);
    expect(couldBeBuildFile(null)).toBe(true);
  });
});
