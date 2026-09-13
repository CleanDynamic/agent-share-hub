import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

/**
 * The accent a creator can pin to one of their collections.
 *
 * EIGHT HEXES BECOME EIGHT TOKEN REFERENCES. The old values were fixed colours
 * chosen against a dark room — a fixed pink dot is a different object on the
 * Exhibition ground than it is on Dusk, and none of them moved when the theme
 * did. A `var()` reference does, because it is resolved by the browser against
 * whatever `<html data-theme>` currently says.
 *
 * THE VALUE IS WHAT GETS STORED, so this is also a small migration: a
 * collection saved from today holds `var(--cat-data)` where one saved last week
 * holds a fixed hex. Both render — a hex is still a colour — so no row needs
 * rewriting and nothing has to be backfilled; older collections simply keep the
 * fixed dot they were given until their owner picks again.
 *
 * See the divergence note in this prompt's handoff: these are the nine part
 * hues spent on something that is not a part category, which the theme
 * otherwise forbids. The alternative was a tenth palette of decorative colours
 * struck and measured for eight dots, and a dot is the one element small enough
 * and meaningless enough to make that the worse trade. It is a 10px circle
 * beside a name the owner chose; it carries no state and nothing reads it.
 */
export const ACCENT_SWATCHES: { name: string; value: string }[] = [
  { name: "Instruction", value: "var(--cat-instruction)" },
  { name: "Evidence", value: "var(--cat-evidence)" },
  { name: "Artefact", value: "var(--cat-artefact)" },
  { name: "Agents", value: "var(--cat-agents)" },
  { name: "Media", value: "var(--cat-media)" },
  { name: "Data", value: "var(--cat-data)" },
  { name: "Configuration", value: "var(--cat-configuration)" },
  { name: "Neutral", value: "var(--text2)" },
];

export interface CollectionFormValues {
  name: string;
  description: string;
  accentColor: string;
  isPrivate: boolean;
}

interface CollectionFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: Partial<CollectionFormValues>;
  saving?: boolean;
  onSubmit: (values: CollectionFormValues) => void;
  onClose: () => void;
}

export function CollectionFormModal({
  open,
  mode,
  initial,
  saving,
  onSubmit,
  onClose,
}: CollectionFormModalProps) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [accentColor, setAccentColor] = React.useState(
    initial?.accentColor ?? ACCENT_SWATCHES[0].value
  );
  const [isPrivate, setIsPrivate] = React.useState(initial?.isPrivate ?? true);

  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setAccentColor(initial?.accentColor ?? ACCENT_SWATCHES[0].value);
      setIsPrivate(initial?.isPrivate ?? true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmit = name.trim().length > 0 && name.trim().length <= 60 && !saving;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New collection" : "Edit collection"}
          </DialogTitle>
          <DialogDescription>
            Group blueprints, blogs, stages, and blocks into a curated set.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder="e.g. Foucault essays"
              maxLength={60}
              autoFocus
            />
            <div className="text-[11px] text-muted-foreground text-right">
              {name.length}/60
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="collection-desc">Description</Label>
            <Textarea
              id="collection-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              placeholder="Optional"
              rows={2}
              maxLength={200}
            />
            <div className="text-[11px] text-muted-foreground text-right">
              {description.length}/200
            </div>
          </div>

          <div className="space-y-2">
            <Label>Accent color</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_SWATCHES.map((s) => {
                const active = accentColor === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setAccentColor(s.value)}
                    title={s.name}
                    aria-label={s.name}
                    style={{
                      width: 26,
                      height: 26,
                      /* Circular: the one thing `--r-full` is for. */
                      borderRadius: r.full,
                      background: s.value,
                      /* Selection is a ring in the page's own ink, so the
                         chosen swatch reads as chosen in both rooms — a white
                         ring vanished on Exhibition. */
                      border: `2px solid ${active ? t.text : t.line}`,
                      cursor: "pointer",
                      transition: "transform 160ms cubic-bezier(.2,.6,.35,1)",
                      transform: active ? "scale(1.05)" : "scale(1)",
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
            <div>
              <div className="text-sm font-medium">
                {isPrivate ? "Private" : "Public"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {isPrivate
                  ? "Only you can see this collection."
                  : "Anyone can view this collection."}
              </div>
            </div>
            <Switch checked={!isPrivate} onCheckedChange={(v) => setIsPrivate(!v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                description: description.trim(),
                accentColor,
                isPrivate,
              })
            }
          >
            {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
