import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

import { CATEGORIES } from "@/lib/theme/category";
import { fieldMessageStyle } from "@/lib/theme/controls";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { cardTitle, eyebrow } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   /dev/kit — every control, every state, one page.

   WHAT THIS IS FOR. BG-P30's audit and every prompt after it needs to look at a
   control without first hunting the product for a screen that happens to render
   one in the state it cares about. This is that screen: one page carrying the
   whole kit, so a regression in a disabled select or an invalid field is
   visible in one scroll instead of being found by a user.

   IT IS NOT LINKED FROM ANYWHERE, and it is guarded by `import.meta.env.DEV` at
   the route rather than here, so the route and this module's chunk are both
   eliminated from a production build rather than merely being unreachable in
   one. See the note in App.tsx.

   IT RENDERS OUTSIDE THE LAYOUT, deliberately. The rails still carry the legacy
   dark paint, and the point of this page is to see the kit against the theme's
   own ground with nothing else competing. It also makes the DOM sweeps this
   page exists to support — the radius sweep, the nested-blur count — measure
   the kit rather than the shell around it.

   EVERY CONTROL HERE IS THE REAL ONE. Nothing on this page is a mock or a
   re-implementation: if it renders correctly here and wrongly in the product,
   the difference is the consumer, not the kit.
   ──────────────────────────────────────────────────────────────────────────── */

const BUTTON_VARIANTS = ["default", "secondary", "outline", "ghost", "link", "destructive"] as const;
const BUTTON_SIZES = ["sm", "default", "lg"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
      <h2 style={{ ...eyebrow, color: t.text2, margin: 0 }}>{title}</h2>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: SPACE.sm,
          padding: SPACE.md,
          background: t.glass,
          borderRadius: "var(--r-card)",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: t.line,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, minWidth: 180 }}>
      <span style={{ ...eyebrow, color: t.text2 }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: SPACE.xs }}>{children}</div>
    </div>
  );
}

export default function Kit() {
  const [checked, setChecked] = useState(true);
  const [switched, setSwitched] = useState(true);
  const [radio, setRadio] = useState("one");
  const [selectedChips, setSelectedChips] = useState<string[]>(["instruction"]);

  const toggleChip = (category: string) =>
    setSelectedChips((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );

  return (
    <main
      data-kit-root=""
      style={{
        minHeight: "100vh",
        background: t.bg,
        color: t.text,
        padding: SPACE.lg,
        display: "flex",
        flexDirection: "column",
        gap: SPACE.lg,
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
        <h1 style={{ ...cardTitle, color: t.text, margin: 0 }}>Control kit</h1>
        <p style={{ color: t.text2, margin: 0, maxWidth: "68ch" }}>
          Every control in <code>src/components/ui/</code> in every state. Flipping the theme below must change
          nothing but colour — if a shape, a size or a position moves, that is the bug this page exists to catch.
        </p>
        {/* The toggle's root is a flex row, so in this column it would stretch
            to the full page width. Corrected HERE rather than in the component:
            how wide the control sits is the container's business, and the rails
            that mount it next will want their own answer. */}
        <div style={{ alignSelf: "flex-start" }}>
          <ThemeToggle />
        </div>
      </header>

      <Section title="Buttons">
        {BUTTON_VARIANTS.map((variant) => (
          <Row key={variant} label={variant}>
            {BUTTON_SIZES.map((size) => (
              <Button key={size} variant={variant} size={size}>
                {size}
              </Button>
            ))}
            <Button variant={variant} disabled>
              disabled
            </Button>
          </Row>
        ))}
        <Row label="icon">
          <Button size="icon" aria-label="Icon button">
            ★
          </Button>
          <Button size="icon" variant="outline" aria-label="Icon button, outline">
            ★
          </Button>
        </Row>
      </Section>

      <Section title="Fields">
        <Row label="input">
          <Input placeholder="Placeholder" aria-label="Empty input" />
        </Row>
        <Row label="with a value">
          <Input defaultValue="A value" aria-label="Filled input" />
        </Row>
        <Row label="invalid">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Input defaultValue="not-an-email" aria-invalid aria-label="Invalid input" />
            <span style={fieldMessageStyle}>That is not an email address.</span>
          </div>
        </Row>
        <Row label="disabled">
          <Input defaultValue="Disabled" disabled aria-label="Disabled input" />
        </Row>
        <Row label="search">
          <Input type="search" placeholder="Search" aria-label="Search input" />
        </Row>
        <Row label="textarea">
          <Textarea placeholder="A longer answer" aria-label="Textarea" />
        </Row>
        <Row label="select">
          <Select>
            <SelectTrigger aria-label="Select">
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent>
              {/* SelectLabel reads a context SelectGroup provides; Radix throws
                  without it, which is how this page earned its first bug. */}
              <SelectGroup>
                <SelectLabel>Categories</SelectLabel>
                {CATEGORIES.slice(0, 4).map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Row>
        <Row label="select, disabled">
          <Select disabled>
            <SelectTrigger aria-label="Disabled select">
              <SelectValue placeholder="Unavailable" />
            </SelectTrigger>
            <SelectContent />
          </Select>
        </Row>
      </Section>

      <Section title="Chips and badges">
        <Row label="variants">
          <Badge>default</Badge>
          <Badge variant="secondary">secondary</Badge>
          <Badge variant="outline">outline</Badge>
          <Badge variant="destructive">destructive</Badge>
        </Row>
        <Row label="the nine categories">
          {CATEGORIES.map((category) => (
            <Badge key={category} category={category}>
              {category}
            </Badge>
          ))}
        </Row>
        <Row label="unknown category falls back">
          <Badge category="not-a-category">fallback</Badge>
        </Row>
        <Row label="selectable — click or Tab and press Enter">
          {CATEGORIES.slice(0, 5).map((category) => (
            <Badge
              key={category}
              category={category}
              selectable
              selected={selectedChips.includes(category)}
              onClick={() => toggleChip(category)}
            >
              {category}
            </Badge>
          ))}
        </Row>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="one" style={{ width: "100%" }}>
          <TabsList>
            <TabsTrigger value="one">First</TabsTrigger>
            <TabsTrigger value="two">Second</TabsTrigger>
            <TabsTrigger value="three" disabled>
              Disabled
            </TabsTrigger>
          </TabsList>
          <TabsContent value="one" style={{ color: t.text2 }}>
            The active tab is an --action underline, not a filled pill.
          </TabsContent>
          <TabsContent value="two" style={{ color: t.text2 }}>
            Second panel.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Switch, checkbox, radio">
        <Row label="switch">
          <Switch checked={switched} onCheckedChange={setSwitched} aria-label="Switch" />
          <Switch checked={false} aria-label="Switch, off" readOnly />
          <Switch disabled aria-label="Switch, disabled" />
        </Row>
        <Row label="checkbox">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} aria-label="Checkbox" />
          <Checkbox checked={false} aria-label="Checkbox, off" readOnly />
          <Checkbox disabled aria-label="Checkbox, disabled" />
        </Row>
        <Row label="radio">
          <RadioGroup value={radio} onValueChange={setRadio} style={{ display: "flex", gap: SPACE.xs }}>
            <RadioGroupItem value="one" aria-label="Radio one" />
            <RadioGroupItem value="two" aria-label="Radio two" />
            <RadioGroupItem value="three" disabled aria-label="Radio, disabled" />
          </RadioGroup>
        </Row>
      </Section>

      <Section title="Overlays">
        <Row label="dropdown">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                Rebuild
                <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>Share</DropdownMenuItem>
              <DropdownMenuItem disabled>Unavailable</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Row>
        <Row label="popover">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <p style={{ margin: 0, color: t.text2 }}>
                The panel is glass. Nothing inside it is, which is the rule the old shell broke.
              </p>
            </PopoverContent>
          </Popover>
        </Row>
        <Row label="tooltip">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>Opaque, because this one does not portal.</TooltipContent>
          </Tooltip>
        </Row>
        <Row label="dialog">
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>A dialog</DialogTitle>
                <DialogDescription>
                  elevation.overlay, plus the scrim that travels with that level.
                </DialogDescription>
              </DialogHeader>
              <div style={{ display: "flex", gap: SPACE.xs }}>
                <Button variant="outline">Cancel</Button>
                <Button>Confirm</Button>
              </div>
            </DialogContent>
          </Dialog>
        </Row>
        <Row label="sheet">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>A sheet</SheetTitle>
                <SheetDescription>Rounded on the inner corners only.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </Row>
      </Section>

      <Section title="Loading">
        <Row label="skeleton">
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, width: 240 }}>
            <Skeleton style={{ height: 120 }} />
            <Skeleton style={{ height: 16, width: "70%" }} />
            <Skeleton style={{ height: 16, width: "40%" }} />
          </div>
        </Row>
        <Row label="spinner">
          <Spinner />
          <Spinner size={24} />
          <Spinner size={32} />
        </Row>
      </Section>
    </main>
  );
}
