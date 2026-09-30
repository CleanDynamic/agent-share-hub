import { Navigate, useParams } from "react-router-dom";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P22 — one address for a maker.

   /creator/:username was the old creator page: a second address for the same
   person /profile/:handle now shows, which is a choice that costs a reader
   time and saves none ⟦hicks-law › Remedies 1 Remove⟧. The old address stays
   reachable — a bookmark or a shared link keeps working — and lands on the
   profile of the same maker, the handle carried as it was written.

   `replace`, so Back returns to wherever the reader came from rather than to
   an address that only ever forwards.
   ──────────────────────────────────────────────────────────────────────────── */

export function CreatorRedirect() {
  const { username } = useParams<{ username?: string }>();
  const handle = (username ?? "").trim();

  if (!handle) return <Navigate to="/profile" replace />;
  return <Navigate to={`/profile/${encodeURIComponent(handle)}`} replace />;
}

export default CreatorRedirect;
