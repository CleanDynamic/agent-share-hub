/* CA-10 (CA-09 F10): whether an element is on screen, for polling only while the panel that shows a list is.

   Returns a callback ref and the answer. No element (a sheet that is shut, a panel not drawn) is "not on screen".
   Where the browser has no IntersectionObserver (jsdom), an element that is mounted counts as on screen. */

import { useCallback, useEffect, useState } from "react";

export function useOnScreen<T extends Element>(): [(element: T | null) => void, boolean] {
  const [element, setElement] = useState<T | null>(null);
  const [onScreen, setOnScreen] = useState(false);
  const ref = useCallback((next: T | null) => setElement(next), []);

  useEffect(() => {
    if (!element) {
      setOnScreen(false);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) setOnScreen(last.isIntersecting);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, onScreen];
}
