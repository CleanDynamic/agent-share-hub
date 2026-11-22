import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/brand/Button";
import { normaliseQuery, SEARCH_MAX } from "@/lib/build/search";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";
import { isTypingTarget } from "./HeaderSearch";
import { SITE_NAV } from "./siteNav";

export function HeaderJumpSearch({ signedIn, width = 272, initialValue = "", onSubmit }: { signedIn: boolean; width?: number; initialValue?: string; onSubmit: (query: string) => boolean | void }) {
  const navigate = useNavigate();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => setValue(initialValue), [initialValue]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || isTypingTarget(event.target)) return;
      event.preventDefault(); input.current?.focus();
    };
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !host.current?.contains(event.target)) setOpen(false); };
    window.addEventListener("keydown", key); document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside); };
  }, []);
  const tidy = normaliseQuery(value);
  const destinations = [
    ...(signedIn ? [{ label: "Drafts", href: SITE_NAV.drafts }, { label: "Library", href: SITE_NAV.library }] : []),
    { label: "Builds", href: SITE_NAV.gallery }, { label: "OpenBuilds", href: SITE_NAV.openbuilds },
    ...(signedIn ? [{ label: "Activity", href: SITE_NAV.activity }, { label: "Messages", href: "/messages" }, { label: "Settings", href: SITE_NAV.settings }] : []),
  ].filter((item) => item.label.toLowerCase().includes(value.trim().toLowerCase()));
  const options = [...(tidy ? [{ label: tidy, href: `/builds?q=${encodeURIComponent(tidy)}`, search: true }] : []), ...destinations.map((item) => ({ ...item, search: false }))];
  const choose = (index: number) => {
    const item = options[index]; if (!item) return;
    if (item.search) onSubmit(item.label); else navigate(item.href);
    setOpen(false); input.current?.blur();
  };
  return (
    <div ref={host} style={{ position: "relative", flexShrink: 1, minWidth: 140 }}>
      <form role="search" aria-label="Search builds" onSubmit={(event) => { event.preventDefault(); if (active >= 0) choose(active); else if (tidy) { onSubmit(tidy); setOpen(false); input.current?.blur(); } }} style={{ margin: 0 }}>
        <label data-ui="header-jump-search" style={{ display: "flex", alignItems: "center", gap: 8, width: focused ? 460 : width, maxWidth: "calc(100vw - 160px)", height: 32, padding: "0 8px 0 12px", boxSizing: "border-box", borderRadius: r.control, background: t.wellOnPage, border: `1px solid ${focused ? t.brandAccent : t.controlBorder}`, fontSize: 13 }}>
          <input ref={input} role="combobox" type="search" aria-label="Search builds" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined} maxLength={SEARCH_MAX} placeholder="Search or jump to…" className="placeholder:text-[color:var(--text2)] !bg-transparent !border-0 focus-visible:!outline-none" value={value} onChange={(event) => { setValue(event.target.value); setOpen(true); setActive(-1); }} onFocus={() => { setFocused(true); setOpen(true); }} onBlur={() => setFocused(false)} onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive((previous) => Math.max(0, Math.min(options.length - 1, previous + (event.key === "ArrowDown" ? 1 : -1)))); }
            if (event.key === "Escape") { event.preventDefault(); if (open || value) { setValue(""); setOpen(false); setActive(-1); } else input.current?.blur(); }
          }} style={{ minWidth: 0, width: "100%", background: "transparent", outline: "none", border: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, color: t.text }} />
          <span aria-hidden="true" style={{ fontFamily: DM_MONO, fontSize: 13, color: t.text2, border: `1px solid ${t.controlBorder}`, borderRadius: r.chip, height: 20, padding: "0 4px" }}>/</span>
        </label>
      </form>
      {open && <div id={`${id}-list`} role="listbox" aria-label="Jump to" style={{ position: "absolute", top: 36, left: 0, width: 460, maxWidth: "calc(100vw - 160px)", padding: "4px 0", boxSizing: "border-box", background: t.window, border: `1px solid ${t.windowBorder}`, borderRadius: r.window, boxShadow: t.windowShadow, zIndex: 50 }}>
        {options.map((item, index) => <div key={item.href}>
          {(index === 0 || (options[index - 1]?.search && !item.search)) && <div role="presentation" style={{ padding: "8px 12px 4px", fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, color: t.text2 }}>{item.search ? "Search" : "Jump to"}</div>}
          <Button variant="ghost" size={32} role="option" id={`${id}-${index}`} aria-selected={active === index} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(index)} style={{ width: "100%", justifyContent: "flex-start", borderRadius: r.chip, padding: "0 12px", fontWeight: 400, background: active === index ? tokenAlpha("text", 0.019) : "transparent", outlineColor: t.brandAccent }}>
            {item.search ? <Search size={16} /> : <ArrowRight size={16} />}<span>{item.label}</span><span style={{ marginLeft: "auto", fontFamily: DM_MONO, fontSize: 13, color: t.text2 }}>{item.search ? "Search all builds" : item.href}</span>
          </Button>
        </div>)}
        {options.length === 0 && <div style={{ padding: "8px 12px", fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>No match. Type 2 or more characters to search builds.</div>}
      </div>}
    </div>
  );
}