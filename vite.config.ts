import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";
import { execSync } from "node:child_process";

/* UX-01 P2: the commit this build was made from, written into index.html as <meta name="build-commit">, so what is live can be
   checked against what was merged. Without git (a host that builds from an archive) it reads "unknown". */
const buildCommit = (): string => {
  if (process.env.VITE_BUILD_COMMIT) return process.env.VITE_BUILD_COMMIT;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "unknown";
  } catch {
    return "unknown";
  }
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  process.env.VITE_BUILD_COMMIT = buildCommit();
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      process.env.ANALYZE === "1" &&
        visualizer({ filename: process.env.ANALYZE_RAW === "1" ? "/tmp/claude-0/s/stats.json" : "design/audits/size/stats.html", gzipSize: true, template: process.env.ANALYZE_RAW === "1" ? "raw-data" : "treemap" }),
    ].filter(Boolean),
    build: {
      rolldownOptions: {
        output: {
          /* SV-26 P4: the libraries sit in chunks of their own that hold no app code, so a Publish that changes only app code
             leaves their file names (content hashes) as they were and a returning reader keeps them cached. */
          codeSplitting: {
            groups: [
              { name: "lib-react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 50 },
              { name: "lib-router", test: /node_modules[\\/](react-router|react-router-dom|@remix-run)[\\/]/, priority: 40 },
              { name: "lib-query", test: /node_modules[\\/]@tanstack[\\/]/, priority: 30 },
              { name: "lib-supabase", test: /node_modules[\\/](@supabase|iceberg-js)[\\/]/, priority: 20 },
              { name: "lib-dnd", test: /node_modules[\\/]@dnd-kit[\\/]/, priority: 10 },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
