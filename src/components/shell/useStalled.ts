/* D4: no skeleton shows for ever. A read that has not answered after STALL_MS is treated as failed, so the page swaps its
   skeleton for its own error state (one line saying what failed, and Retry) in the same place.

   `stalled` turns true once `waiting` has stayed true for STALL_MS, and false the moment `waiting` turns false. `restart`
   is for Retry: it gives the read another STALL_MS from now, so the skeleton comes back while the retried read is out. A
   failed read reaches the error state by itself, sooner; this is only the case of a read that never answers. */

import { useCallback, useEffect, useState } from "react";

/** How long a skeleton may wait for its read before the page says it did not load. */
export const STALL_MS = 10_000;

export function useStalled(waiting: boolean, ms: number = STALL_MS): { stalled: boolean; restart: () => void } {
  const [round, setRound] = useState(0);
  const [late, setLate] = useState(false);
  useEffect(() => {
    setLate(false);
    if (!waiting) return;
    const id = window.setTimeout(() => setLate(true), ms);
    return () => window.clearTimeout(id);
  }, [waiting, ms, round]);
  const restart = useCallback(() => setRound((n) => n + 1), []);
  return { stalled: waiting && late, restart };
}

export default useStalled;
