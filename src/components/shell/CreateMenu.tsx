import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowDownToLine, Link, MessageSquare, Plus } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/brand/Button";
import { Icon } from "@/components/brand/Icon";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** The header's one primary: "New build", 32 high, with the plus. It opens the create menu (New build, Import, New post, Connect a tool). */
export function NewBuildTrigger(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button variant="primary" size={32} aria-haspopup="menu" {...props} style={{ gap: 6, ...props.style }}>
      <Icon lucide={Plus} glyph="plus" size={16} />
      New build
    </Button>
  );
}

export function CreateMenu({ onChoose, defaultOpen = false }: { onChoose: (kind: "build" | "import" | "post" | "connect") => void; defaultOpen?: boolean }) {
  return <DropdownMenu.Root defaultOpen={defaultOpen}>
    <DropdownMenu.Trigger asChild><NewBuildTrigger /></DropdownMenu.Trigger>
    <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={4} style={{ width: 220, padding: "4px 0", background: t.window, color: t.text, border: `1px solid ${t.windowBorder}`, borderRadius: r.window, boxShadow: t.windowShadow, zIndex: 50 }}>
      {([{ kind: "build", label: "New build", icon: Plus }, { kind: "import", label: "Import", icon: ArrowDownToLine }, { kind: "post", label: "New post", icon: MessageSquare }, { kind: "connect", label: "Connect a tool", icon: Link }] as const).map(({ kind, label, icon: MenuIcon }) => <DropdownMenu.Item key={kind} asChild onSelect={() => onChoose(kind)}><Button variant="ghost" size={32} style={{ width: "100%", justifyContent: "flex-start", fontFamily: FIGTREE, fontWeight: 400, padding: "0 12px", borderRadius: r.chip }} onFocus={(event) => { event.currentTarget.style.background = tokenAlpha("text", 0.019); }} onBlur={(event) => { event.currentTarget.style.background = "transparent"; }}><MenuIcon size={16} />{label}</Button></DropdownMenu.Item>)}
    </DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
