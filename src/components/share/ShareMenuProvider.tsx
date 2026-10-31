import {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ShareContentMeta } from "./ShareMenu";
import { useEverOpened, useLoadAtIdle } from "@/lib/routing/lazyHost";

/** SV-26 P2: the menu loads the first time a reader shares, or at idle. */
const loadHost = () => import("./ShareMenuHost");
const ShareMenuHost = lazy(loadHost);

export type ShareableType = "blueprint" | "stage" | "block" | "blog" | "bounty";

export interface OpenShareMenuArgs {
  contentType: ShareableType;
  contentId: string;
  contentMeta: ShareContentMeta;
  /** Element to anchor menu to. For right-click, pass a virtual element with getBoundingClientRect. */
  anchorEl: HTMLElement | { getBoundingClientRect: () => DOMRect };
}

interface ShareMenuContextValue {
  openShareMenu: (args: OpenShareMenuArgs) => void;
  closeShareMenu: () => void;
  isOpen: boolean;
}

const ShareMenuContext = createContext<ShareMenuContextValue | undefined>(
  undefined
);

export function useShareMenu(): ShareMenuContextValue {
  const ctx = useContext(ShareMenuContext);
  if (!ctx) throw new Error("useShareMenu must be used within ShareMenuProvider");
  return ctx;
}

/** Build a virtual anchor element from screen coordinates (for right-click). */
export function virtualAnchorFromPoint(x: number, y: number) {
  return {
    getBoundingClientRect: () =>
      ({
        x,
        y,
        top: y,
        left: x,
        right: x,
        bottom: y,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  };
}

export function ShareMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<
    HTMLElement | { getBoundingClientRect: () => DOMRect } | null
  >(null);
  const [contentType, setContentType] = useState<ShareableType>("blueprint");
  const [contentId, setContentId] = useState<string>("");
  const [contentMeta, setContentMeta] = useState<ShareContentMeta>({ title: "" });
  const hostMounted = useEverOpened(isOpen);
  useLoadAtIdle(loadHost);

  // Keep latest open args for the keyboard shortcut.
  const lastArgsRef = useRef<OpenShareMenuArgs | null>(null);

  const closeShareMenu = useCallback(() => {
    setIsOpen(false);
    setAnchorEl(null);
  }, []);

  const openShareMenu = useCallback((args: OpenShareMenuArgs) => {
    lastArgsRef.current = args;
    setContentType(args.contentType);
    setContentId(args.contentId);
    setContentMeta(args.contentMeta);
    setAnchorEl(args.anchorEl);
    setIsOpen(true);
  }, []);

  // Cmd/Ctrl + Shift + S re-opens for the last item (best-effort).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "s") {
        const last = lastArgsRef.current;
        if (last) {
          e.preventDefault();
          openShareMenu(last);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openShareMenu]);

  const value = useMemo<ShareMenuContextValue>(
    () => ({ openShareMenu, closeShareMenu, isOpen }),
    [openShareMenu, closeShareMenu, isOpen]
  );

  return (
    <ShareMenuContext.Provider value={value}>
      {children}
      {hostMounted && (
        <Suspense fallback={null}>
          <ShareMenuHost
            isOpen={isOpen}
            onClose={closeShareMenu}
            anchorEl={anchorEl}
            contentType={contentType}
            contentId={contentId}
            contentMeta={contentMeta}
          />
        </Suspense>
      )}
    </ShareMenuContext.Provider>
  );
}
