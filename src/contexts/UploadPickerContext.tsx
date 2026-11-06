import { Suspense, createContext, lazy, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { UploadContentType } from "@/components/upload/UploadTypePicker";
import { useEverOpened, useLoadAtIdle } from "@/lib/routing/lazyHost";
import { useIsMobile } from "@/hooks/use-mobile";

/** SV-26 P2: the picker's code loads the first time it opens, or at idle. */
const loadPicker = () => import("@/components/upload/UploadTypePicker");
const UploadTypePicker = lazy(() => loadPicker().then((m) => ({ default: m.UploadTypePicker })));

interface UploadPickerContextValue {
  openUploadTypePicker: () => void;
  closeUploadTypePicker: () => void;
}

const UploadPickerContext = createContext<UploadPickerContextValue | null>(null);

export function useUploadPicker() {
  const ctx = useContext(UploadPickerContext);
  if (!ctx) throw new Error("useUploadPicker must be used within UploadPickerProvider");
  return ctx;
}

// Blueprint is the one the build workspace replaces. Blog keeps its existing
// editor.
const ROUTE_FOR_TYPE: Record<UploadContentType, string> = {
  blueprint: "/compose/new",
  blog: "/upload/blog",
};

export function UploadPickerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const pickerMounted = useEverOpened(isOpen);
  useLoadAtIdle(loadPicker);

  const openUploadTypePicker = useCallback(() => {
    setIsOpen(true);
  }, []);
  const closeUploadTypePicker = useCallback(() => setIsOpen(false), []);

  const handleSelect = useCallback(
    (type: UploadContentType) => {
      setIsOpen(false);
      navigate(ROUTE_FOR_TYPE[type]);
    },
    [navigate],
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    // If user landed on /upload (no sub-route) and dismisses, send them home.
    if (location.pathname === "/upload" && !location.search) {
      navigate("/", { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  // Cmd/Ctrl + N shortcut — skip when typing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "n") return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      e.preventDefault();
      setIsOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <UploadPickerContext.Provider value={{ openUploadTypePicker, closeUploadTypePicker }}>
      {children}
      {pickerMounted && (
        <Suspense fallback={null}>
          <UploadTypePicker
            isOpen={isOpen}
            onClose={handleClose}
            variant={isMobile ? "mobile" : "desktop"}
            onSelect={handleSelect}
          />
        </Suspense>
      )}
    </UploadPickerContext.Provider>
  );
}
