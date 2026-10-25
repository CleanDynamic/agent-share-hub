import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    // The edge functions import zod as npm:zod@..., which Deno reads and Node does not (SV-01).
    alias: [
      { find: /^npm:zod@[\d.]+$/, replacement: "zod" },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
