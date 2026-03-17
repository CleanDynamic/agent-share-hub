import { useState, useEffect } from "react";

export function useIsTablet() {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsTablet(w >= 768 && w < 1024);
    };
    check();
    const mql1 = window.matchMedia("(min-width: 768px)");
    const mql2 = window.matchMedia("(min-width: 1024px)");
    const onChange = () => check();
    mql1.addEventListener("change", onChange);
    mql2.addEventListener("change", onChange);
    return () => {
      mql1.removeEventListener("change", onChange);
      mql2.removeEventListener("change", onChange);
    };
  }, []);

  return isTablet;
}
