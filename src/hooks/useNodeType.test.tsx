import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getNodeTypes = vi.fn();
vi.mock("@/lib/build/nodeTypes", () => ({ getNodeTypes: () => getNodeTypes(), nodeTypesKey: ["build", "getNodeTypes"] }));

import type { NodeType } from "@/lib/build/types";

import { useNodeType } from "./useNodeType";

const type = (key: string, is_active = true) => ({ key, is_active }) as unknown as NodeType;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => getNodeTypes.mockReset().mockResolvedValue([type("team"), type("repo", false)]));

describe("useNodeType", () => {
  it("reads the type from the list the record already holds, in the first render, with no request", () => {
    const { result } = renderHook(() => [useNodeType([type("team")], "team"), useNodeType([type("team")], "repo")], { wrapper });
    expect(result.current[0]?.key).toBe("team");
    expect(result.current[1]).toBeNull();
    expect(getNodeTypes).not.toHaveBeenCalled();
  });

  it("without a record (a new build) asks for the registry once, whatever the number of types read", async () => {
    const { result } = renderHook(() => [useNodeType([], "team"), useNodeType([], "repo"), useNodeType([], "dataset")], { wrapper });
    await waitFor(() => expect(result.current[0]?.key).toBe("team"));
    expect(result.current[1]?.is_active).toBe(false);
    expect(result.current[2]).toBeNull();
    expect(getNodeTypes).toHaveBeenCalledTimes(1);
  });
});
