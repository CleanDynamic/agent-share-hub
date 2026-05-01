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

export const ACCENT_SWATCHES: { name: string; value: string }[] = [
  { name: "Orange", value: "#E8571A" },
  { name: "Teal", value: "#2EC4B6" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Purple", value: "#7C3AED" },
  { name: "Pink", value: "#EC4899" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Neutral", value: "rgba(255,255,255,0.40)" },
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
                      borderRadius: 999,
                      background: s.value,
                      border: active
                        ? "2px solid rgba(255,255,255,0.95)"
                        : "2px solid rgba(255,255,255,0.1)",
                      cursor: "pointer",
                      transition: "transform 0.1s",
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
