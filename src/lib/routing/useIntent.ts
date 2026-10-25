// SV-03 P6: fetch on intent. A link to a page in the route table starts that page when the pointer rests on it for 60 ms,
// when it takes focus, and when it is touched or pressed. Spread the result on the link: `<a {...useIntent(href)}>`.

import { QueryClientContext } from "@tanstack/react-query";
import { useContext, useEffect, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";

import { warmPath } from "./warm";

export const HOVER_DELAY_MS = 60;

async function storedUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export interface IntentHandlers {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onTouchStart: () => void;
  onPointerDown: () => void;
}

export function useIntent(href: string | undefined): IntentHandlers {
  // Outside a query client (a view drawn on its own) the link is only a link.
  const queryClient = useContext(QueryClientContext);
  const timer = useRef<number | null>(null);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const now = () => {
    clear();
    if (!href || !queryClient) return;
    // Who is asking comes from the stored session when the link is used, so a link does not need the auth context around it.
    void storedUserId().then((userId) => warmPath(href, queryClient, userId));
  };

  return {
    onPointerEnter: () => {
      if (!href || !queryClient) return;
      clear();
      timer.current = window.setTimeout(now, HOVER_DELAY_MS);
    },
    onPointerLeave: clear,
    onFocus: now,
    onTouchStart: now,
    onPointerDown: now,
  };
}
