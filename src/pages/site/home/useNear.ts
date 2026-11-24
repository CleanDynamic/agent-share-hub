import { useEffect, useRef } from "react";

/** Calls `onNear` once, when the element comes within a screen of view. */
export function useNear<E extends Element>(id: string, onNear?: (ids: string[]) => void) {
  const ref = useRef<E>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !onNear || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          onNear([id]);
        }
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, onNear]);
  return ref;
}

