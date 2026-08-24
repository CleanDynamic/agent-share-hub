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
  if (typeof (Blob.prototype as Record<string, unknown>)[name] !== "function") {
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
