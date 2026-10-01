/* UI-P01 — the theme the dev compare pages are asked for in the URL.

   `?theme=noon|dusk` sets `<html data-theme>` for as long as the page is
   mounted. It does NOT go through `setTheme`, so the visitor's stored
   preference (`bg-theme` in localStorage) is never written: opening a compare
   page in Dusk must not leave the next real session in Dusk.

   WHY A MUTATION OBSERVER AND NOT JUST AN EFFECT. ThemeProvider sits above the
   router and its layout effect also writes the attribute; a child's effect runs
   first on mount, so a plain write here can be overwritten by the provider's
   own first write. This hook writes after the provider has, and writes again
   if anything changes the attribute, then puts back the provider's theme on
   unmount so leaving the page leaves nothing behind. */

import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTheme, type ResolvedTheme } from "@/contexts/ThemeContext";

export type DesignViewport = "desktop" | "mobile";

const isTheme = (value: string | null): value is ResolvedTheme => value === "noon" || value === "dusk";

/** The theme the URL asks for. No `?theme=` (or a bad one) means Noon, the reference's first room. */
export function useDesignTheme(): ResolvedTheme {
  const [params] = useSearchParams();
  const requested = params.get("theme");
  const theme: ResolvedTheme = isTheme(requested) ? requested : "noon";
  const { resolved } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      if (root.dataset.theme !== theme) root.dataset.theme = theme;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      observer.disconnect();
      root.dataset.theme = resolved;
    };
    // `resolved` is read only on unmount; a change of it must not re-run the write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return theme;
}

/** `?viewport=desktop|mobile`. Desktop is the default. */
export function useDesignViewport(): DesignViewport {
  const [params] = useSearchParams();
  return params.get("viewport") === "mobile" ? "mobile" : "desktop";
}
