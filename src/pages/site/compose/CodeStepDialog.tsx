/* A code step's file, opened from its title in the build list: a read-only `CodeFileBlock` of the whole file in a Radix
   dialog (a `BottomSheet` below 768). Copy in the block copies the full file. The highlighter loads when this opens,
   never before (`CodeFileBlock` imports it on mount). NOTHING HERE RUNS CODE. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { IconButton } from "@/components/brand/IconButton";
import { CodeFileBlock } from "@/components/code/CodeFileBlock";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";

import { isCodeLanguage } from "./codeModel";
import { dialogTitle, windowStyle } from "./refinedStyles";

export interface CodeStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The step's title as the list shows it. */
  title: string;
  filename: string | null;
  language: string | null;
  source: string;
}

export function CodeStepDialog({ open, onOpenChange, title, filename, language, source }: CodeStepDialogProps) {
  const phone = useIsPhone();
  const block = (
    <CodeFileBlock data-testid="code-step-block" filename={filename ?? language ?? "code"} source={source} language={language && isCodeLanguage(language) ? language : "other"} phone={phone} />
  );

  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
        {open ? block : null}
      </BottomSheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          aria-describedby={undefined}
          data-testid="code-step-dialog"
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...windowStyle(720) }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 16 }}>
            <Dialog.Title style={{ ...dialogTitle, margin: 0, flexGrow: 1, minWidth: 0, overflowWrap: "anywhere" }}>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} glyph="x" boxed={false} size={26} label="Close" />
            </Dialog.Close>
          </div>
          {block}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default CodeStepDialog;
