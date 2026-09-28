import { Navigate, useSearchParams } from "react-router-dom";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P05 — /search is the Gallery with a query (CONTRACT §14).

   The old search page searched legacy posts. Its address stays reachable — a
   bookmark or a shared link keeps working — and lands on the Gallery carrying
   the same words. The query is tidied the way the search itself will read it
   (RC-P07): trimmed, runs of whitespace collapsed to one space, and ignored
   below two characters, where it would match nearly everything. It is cut to
   80 characters, the most the search accepts.

   `replace`, so Back returns to wherever the reader came from rather than to
   an address that only ever forwards.
   ──────────────────────────────────────────────────────────────────────────── */

const MIN_QUERY = 2;
const MAX_QUERY = 80;

export function SearchRedirect() {
  const [params] = useSearchParams();
  const query = (params.get("q") ?? "").trim().replace(/\s+/g, " ");

  if (query.length < MIN_QUERY) return <Navigate to="/gallery" replace />;
  return <Navigate to={`/gallery?q=${encodeURIComponent(query.slice(0, MAX_QUERY))}`} replace />;
}

export default SearchRedirect;
