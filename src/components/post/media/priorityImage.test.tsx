import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { imageLoading, PriorityImageScope, useImageLoading } from "./priorityImage";

function Pic({ src }: { src: string }) {
  const attrs = useImageLoading(src);
  return <img src={src} alt={src} {...attrs} />;
}

describe("UX-01 P6: the priority image", () => {
  it("the first picture in a scope is high priority and not lazy; the rest are lazy and async", () => {
    const { getByAltText } = render(
      <PriorityImageScope>
        <Pic src="https://s/a.png" />
        <Pic src="https://s/b.png" />
        <Pic src="https://s/a.png" />
      </PriorityImageScope>,
    );
    const first = getByAltText("https://s/b.png");
    expect(first.getAttribute("loading")).toBe("lazy");
    expect(first.getAttribute("decoding")).toBe("async");
    expect(first.getAttribute("fetchpriority")).toBeNull();
  });
  it("is idempotent per address and lazy outside any scope", () => {
    const scope = { claimed: null as string | null };
    expect(imageLoading(scope, "x")).toEqual({ fetchPriority: "high", decoding: "async" });
    expect(imageLoading(scope, "x")).toEqual({ fetchPriority: "high", decoding: "async" });
    expect(imageLoading(scope, "y")).toEqual({ loading: "lazy", decoding: "async" });
    expect(imageLoading(null, "x")).toEqual({ loading: "lazy", decoding: "async" });
  });
  it("the claimed picture has fetchpriority high and no loading attribute", () => {
    const { container } = render(
      <PriorityImageScope>
        <Pic src="https://s/a.png" />
        <Pic src="https://s/b.png" />
      </PriorityImageScope>,
    );
    const [a, b] = [...container.querySelectorAll("img")];
    expect(a.getAttribute("fetchpriority")).toBe("high");
    expect(a.hasAttribute("loading")).toBe(false);
    expect(b.getAttribute("loading")).toBe("lazy");
  });
});
