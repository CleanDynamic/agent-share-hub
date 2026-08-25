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

// Blueprint is the one shape the build workspace replaces, so it points at
// /compose/new. Blog and bounty keep their old editors: neither is superseded
// by this rebuild, and folding a bounty into the gap node type is a product
// decision nobody has made.
const ROUTE_FOR_TYPE: Record<UploadContentType, string> = {
  blueprint: "/compose/new",
  blog: "/upload/blog",
  bounty: "/upload/bounty",
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
