import { Plus } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/brand/Button";
import { Icon } from "@/components/brand/Icon";

/** The header's one primary: "New build", 32 high, with the plus. It opens the create menu (New build, Import, New post, Connect a tool). */
export function NewBuildTrigger(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button variant="primary" size={32} aria-haspopup="menu" {...props} style={{ gap: 6, ...props.style }}>
      <Icon lucide={Plus} glyph="plus" size={16} />
      New build
    </Button>
  );
}
