// CA-09: serves the built site the way a CDN would: gzip, netlify.toml's cache headers (/assets immutable for a
// year, everything else revalidated) and the SPA fallback. `vite preview` sends JavaScript uncompressed, which would
// make the phone profile's Fast 3G numbers about 3.5× worse than the published site's.
// Usage: node docs/audits/ca-09/scripts/static.mjs /var/tmp/ca09-dist 4173
import http from "node:http";
import http2 from "node:http2";
import { readFileSync, existsSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const root = process.argv[2] ?? "/var/tmp/ca09-dist";
const port = Number(process.argv[3] ?? 4173);
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".ico": "image/x-icon", ".webp": "image/webp", ".txt": "text/plain", ".xml": "application/xml" };
const cache = new Map();

// HTTP/2 over TLS when CA09_TLS_DIR is set, as the published site is served; HTTP/1.1 otherwise.
const TLS = process.env.CA09_TLS_DIR;
const handler = (req, res) => {
    const url = new URL(req.url, "http://x");
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(root, "index.html");
    const ext = path.extname(file);
    const type = TYPES[ext] ?? "application/octet-stream";
    const compressible = /text|javascript|json|svg|xml/.test(type);
    const gzip = compressible && /gzip/.test(req.headers["accept-encoding"] ?? "");
    const key = `${file}:${gzip}`;
    if (!cache.has(key)) {
      const raw = readFileSync(file);
      cache.set(key, gzip ? gzipSync(raw, { level: 6 }) : raw);
    }
    const body = cache.get(key);
    const headers = {
      "content-type": type,
      "content-length": body.length,
      "cache-control": url.pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate",
      "x-content-type-options": "nosniff",
    };
    if (gzip) headers["content-encoding"] = "gzip";
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : body);
};
(TLS
  ? http2.createSecureServer({ key: readFileSync(path.join(TLS, "key.pem")), cert: readFileSync(path.join(TLS, "cert.pem")), allowHTTP1: true }, handler)
  : http.createServer(handler)
).listen(port, "127.0.0.1", () => console.log(`static ${root} on ${TLS ? "https (h2)" : "http"}://127.0.0.1:${port}`));
