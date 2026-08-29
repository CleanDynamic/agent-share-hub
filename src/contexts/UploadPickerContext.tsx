import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UploadTypePicker, type UploadContentType } from "@/components/upload/UploadTypePicker";
import { useIsMobile } from "@/hooks/use-mobile";

type PickerMode = "all" | "bounty";

interface UploadPickerContextValue {
  openUploadTypePicker: (mode?: PickerMode) => void;
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
//
// NS-P54: bounty joins blueprint. The product decision NS-P25 said nobody had
// made was made across NS-P45–NS-P53 — a bounty IS a gap node on a build now,
// marked unsolved in the composer and priced at publish — so the Bounty card
// in the picker opens the composer rather than the legacy bounty editor. The
// card's label and promise are unchanged; only where it lands moved.
//
// meta-bounty is NOT repointed here. It is NS-P49's surface, it has no
// reachable creation path today (`/upload?type=meta-bounty` re-opens this
// picker), and the one library helper behind it is frozen rather than
// rewired — see src/lib/bounty-legacy/flags.ts.
const ROUTE_FOR_TYPE: Record<UploadContentType, string> = {
  blueprint: "/compose/new",
  blog: "/upload/blog",
  bounty: "/compose/new",
  "meta-bounty": "/upload?type=meta-bounty",
};

export function UploadPickerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>("all");
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const openUploadTypePicker = useCallback((m: PickerMode = "all") => {
    setMode(m);
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
      setMode("all");
      setIsOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <UploadPickerContext.Provider value={{ openUploadTypePicker, closeUploadTypePicker }}>
      {children}
      <UploadTypePicker
        isOpen={isOpen}
        onClose={handleClose}
        variant={isMobile ? "mobile" : "desktop"}
        onSelect={handleSelect}
        mode={mode}
      />
    </UploadPickerContext.Provider>
  );
}
