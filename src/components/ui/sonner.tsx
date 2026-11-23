import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, useSonner } from "sonner";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/* G16: sonner puts every toast in one polite region. Errors must be said assertively, and nothing twice, so its region is set
   to not live and this says each new toast once: an error through the assertive line, the rest through the polite one. The
   toasts are drawn as before, take no focus, and stay reachable with alt+T; an action is sonner's own button. */
const HIDDEN: CSSProperties = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };

const words = (value: unknown): string => (typeof value === "string" || typeof value === "number" ? String(value) : "");

function ToastSpeaker() {
  const { toasts } = useSonner();
  const said = useRef(new Set<string | number>());
  const [polite, setPolite] = useState<{ n: number; text: string }>({ n: 0, text: "" });
  const [assertive, setAssertive] = useState<{ n: number; text: string }>({ n: 0, text: "" });

  useEffect(() => {
    for (const item of toasts) {
      if (said.current.has(item.id)) continue;
      said.current.add(item.id);
      const text = [words(item.title), words(item.description)].filter(Boolean).join(". ");
      if (!text) continue;
      const set = item.type === "error" ? setAssertive : setPolite;
      set((last) => ({ n: last.n + 1, text }));
    }
  }, [toasts]);

  // The toaster's own region would say each toast a second time, politely.
  useEffect(() => {
    for (const region of Array.from(document.querySelectorAll('section[aria-label^="Notifications"]'))) region.setAttribute("aria-live", "off");
  });

  return (
    <>
      <div data-testid="toast-polite" role="status" aria-live="polite" style={HIDDEN}>
        {/* A new node each time, so the same words twice are said twice. */}
        <span key={polite.n}>{polite.text}</span>
      </div>
      <div data-testid="toast-assertive" role="alert" aria-live="assertive" style={HIDDEN}>
        <span key={assertive.n}>{assertive.text}</span>
      </div>
    </>
  );
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        toastOptions={{
          /* Synth 06: Overlay fill, radius 12, 12px 16px, 15 Text; the action is a small secondary button. */
          style: { background: t.window, color: t.text, border: 0, borderRadius: 12, padding: "12px 16px", fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", boxShadow: "var(--elev-overlay)" },
          actionButtonStyle: { background: t.control, color: t.text, height: 32, padding: "0 14px", borderRadius: 16, fontSize: 13, fontWeight: 600 },
          cancelButtonStyle: { background: "transparent", color: t.text2, height: 32, padding: "0 14px", borderRadius: 16, fontSize: 13, fontWeight: 600 },
          classNames: {
            toast: "group toast",
            description: "group-[.toast]:text-[color:var(--text2)]",
          },
        }}
        {...props}
      />
      <ToastSpeaker />
    </>
  );
};

export { Toaster, toast };
