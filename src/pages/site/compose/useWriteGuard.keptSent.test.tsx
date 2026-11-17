// G22: once the writes kept on this device from an earlier load have all gone, the editor is told, so it reads the build
// again: a read made while they were being settled may have answered with the row as it was before them.
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ onChange: null as null | ((state: { held: number; orphans: number }) => void) }));
vi.mock("@/lib/build/writeGuard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/writeGuard")>()),
  installWriteGuard: (_client: unknown, options: { onChange: (state: { held: number; orphans: number }) => void }) => {
    guard.onChange = options.onChange;
    return { guard: {}, uninstall: () => undefined };
  },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { useWriteGuard } from "./useWriteGuard";

function Editor({ onKeptSent }: { onKeptSent: () => void }) {
  useWriteGuard("b1", { onKeptSent });
  return null;
}

describe("useWriteGuard: the kept writes have gone", () => {
  it("says so once, when the count of kept writes comes down to none", () => {
    const onKeptSent = vi.fn();
    render(<Editor onKeptSent={onKeptSent} />);
    guard.onChange?.({ held: 2, orphans: 2 });
    guard.onChange?.({ held: 1, orphans: 1 });
    expect(onKeptSent).not.toHaveBeenCalled();
    guard.onChange?.({ held: 0, orphans: 0 });
    expect(onKeptSent).toHaveBeenCalledTimes(1);
    guard.onChange?.({ held: 1, orphans: 0 });
    guard.onChange?.({ held: 0, orphans: 0 });
    expect(onKeptSent).toHaveBeenCalledTimes(1);
  });
});
