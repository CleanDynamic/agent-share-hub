import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast, useSonner } from "sonner";

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
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
            description: "group-[.toast]:text-muted-foreground",
            actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          },
        }}
        {...props}
      />
      <ToastSpeaker />
    </>
  );
};

export { Toaster, toast };
