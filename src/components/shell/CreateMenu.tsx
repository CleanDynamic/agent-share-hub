import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowDownToLine, ChevronDown, Link, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/brand/Button";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export function CreateMenu({ onChoose, defaultOpen = false }: { onChoose: (kind: "build" | "import" | "post" | "connect") => void; defaultOpen?: boolean }) {
  return <DropdownMenu.Root defaultOpen={defaultOpen}>
    <DropdownMenu.Trigger asChild><Button variant="ghost" size={32} aria-label="Create new…" title="Create new…" style={{ padding: "0 8px", outlineColor: t.brandAccent }}><Plus size={16} /><ChevronDown size={8} /></Button></DropdownMenu.Trigger>
    <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={4} style={{ width: 220, padding: "4px 0", background: t.window, color: t.text, border: `1px solid ${t.windowBorder}`, borderRadius: r.window, boxShadow: t.windowShadow, zIndex: 50 }}>
      {([{ kind: "build", label: "New build", icon: Plus }, { kind: "import", label: "Import", icon: ArrowDownToLine }, { kind: "post", label: "New post", icon: MessageSquare }, { kind: "connect", label: "Connect a tool", icon: Link }] as const).map(({ kind, label, icon: Icon }) => <DropdownMenu.Item key={kind} asChild onSelect={() => onChoose(kind)}><Button variant="ghost" size={32} style={{ width: "100%", justifyContent: "flex-start", fontFamily: FIGTREE, fontWeight: 400, padding: "0 12px", borderRadius: r.chip, outlineColor: t.brandAccent }} onFocus={(event) => { event.currentTarget.style.background = tokenAlpha("text", 0.019); }} onBlur={(event) => { event.currentTarget.style.background = "transparent"; }}><Icon size={16} />{label}</Button></DropdownMenu.Item>)}
    </DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu.Root>;
}