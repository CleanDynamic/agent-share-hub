import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom ships Blob without arrayBuffer/text, which the platform has had for
// years. NS-P20 sniffs a dropped file's first four bytes to tell an archive
// from text, so without these the intake tests exercise a path no browser runs.
for (const [name, read] of [
  ["arrayBuffer", (buffer: ArrayBuffer) => buffer],
  ["text", (buffer: ArrayBuffer) => new TextDecoder().decode(buffer)],
] as const) {
  if (typeof (Blob.prototype as unknown as Record<string, unknown>)[name] !== "function") {
    Object.defineProperty(Blob.prototype, name, {
      configurable: true,
      writable: true,
      value(this: Blob) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(read(reader.result as ArrayBuffer));
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(this);
        });
      },
    });
  }
}

// UI-P98: the site switch is on, so a bare render (no router, no `/dev` URL) would now be refined. The unit tests
// written for the current look keep that look in a bare render; a test asks for the refined one the way a dev page
// does, with `?look=refined` on a `/dev/*` route. UI-P99 retires this along with the current look.
vi.mock("@/lib/theme/look", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/theme/look")>();
  const { useContext } = await import("react");
  const { UNSAFE_LocationContext } = await import("react-router-dom");
  return {
    ...actual,
    useLook: () => {
      const location = useContext(UNSAFE_LocationContext)?.location;
      return actual.resolveLook(location?.pathname ?? "", location?.search ?? "", false);
    },
  };
});
