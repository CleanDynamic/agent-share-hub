// SV-04 P4: a page inside the frame that draws its own chrome (the legacy composer workspace) asks the frame to step
// back: no skip link, header, breadcrumb, footer or dock, and no surface, with the page left where it is in the tree so
// nothing under it remounts. AppShell holds the answer; `useHideFrameChrome(true)` sets it for as long as the caller is
// mounted, before the first paint.

import { createContext, useContext, useLayoutEffect } from "react";

export const FrameChromeContext = createContext<(hidden: boolean) => void>(() => undefined);

export function useHideFrameChrome(hidden: boolean): void {
  const setHidden = useContext(FrameChromeContext);
  useLayoutEffect(() => {
    if (!hidden) return;
    setHidden(true);
    return () => setHidden(false);
  }, [hidden, setHidden]);
}

/* Synth draft: by default the page area is ONE panel (Panel fill, radius 12). A page laid out as several columns draws a
   panel per column itself, and asks the frame to step back from its own: `useColumnPanels(true)` sets it for as long as
   the caller is mounted, before the first paint. `SiteFrameView` holds the answer and provides the setter. */

export const FrameColumnsContext = createContext<(columns: boolean) => void>(() => undefined);

export function useColumnPanels(columns: boolean): void {
  const setColumns = useContext(FrameColumnsContext);
  useLayoutEffect(() => {
    if (!columns) return;
    setColumns(true);
    return () => setColumns(false);
  }, [columns, setColumns]);
}
