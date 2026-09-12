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

import { GalleryCard, GalleryCardSkeleton } from "@/components/gallery/GalleryCard";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import type { GalleryBuild, GalleryMedia } from "@/lib/build";

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


/* ────────────────────────────────────────────────────────────────────────────
   BG-P09 — the card, every variant, both layouts.

   THE REAL COMPONENT, LIKE EVERYTHING ELSE ON THIS PAGE. These are fixtures for
   the DATA, not a re-implementation of the card: each one is a GalleryBuild
   shaped the way the gallery's own query returns it, handed to the same
   GalleryCard the gallery and the feed render.

   THE PICTURES ARE DATA URIs, and that is the one liberty. A real card's images
   arrive as signed, width-transformed URLs from a private bucket, which a dev
   page cannot produce and should not try to — so each sample carries an inline
   SVG at the exact pixel dimensions the fixture claims. The point of the section
   is the SHAPE a picture is framed at, which comes from the stored width and
   height rather than from the bytes, so an SVG at 5000×1000 exercises the 2.0
   cap exactly as a photograph would. No network, no transform to get wrong.

   WHY "four unfolded" IS A CLICK RATHER THAN A PROP. Unfold state is internal to
   the card by design — BG-P18's list has no business knowing what is inside one
   — so the fourth sample is a four-entry card with its control showing, and
   unfolding it is one click. A `defaultUnfolded` prop would have been a second
   public member of the card's API existing only for this page.
   ──────────────────────────────────────────────────────────────────────────── */

/** An inline SVG at exactly these pixels, so a fixture's shape is its shape. */
function swatch(width: number, height: number, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#8A8FA0"/>
    <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="#EDEFF3" stroke-width="2"/>
    <text x="50%" y="50%" fill="#1B2026" font-family="monospace" font-size="${Math.max(
      14,
      Math.round(Math.min(width, height) / 8),
    )}" text-anchor="middle" dominant-baseline="middle">${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

let sampleSeq = 0;

/** One media row of the post, plus its swatch, registered in the signed map. */
function sampleMedia(
  srcByPath: Map<string, string>,
  over: Partial<GalleryMedia> & { width: number; height: number },
): GalleryMedia {
  const n = (sampleSeq += 1);
  const path = `kit/${n}.svg`;
  const row: GalleryMedia = {
    id: `kit-m${n}`,
    node_id: null,
    bucket: "build-media",
    path,
    kind: "image",
    poster_path: null,
    duration: null,
    post_position: null,
    post_text: null,
    ...over,
  };
  srcByPath.set(
    row.poster_path ?? row.path,
    swatch(over.width, over.height, `${over.width}×${over.height}`),
  );
  return row;
}

function sampleBuild(over: Partial<GalleryBuild> = {}): GalleryBuild {
  return {
    id: `kit-${(sampleSeq += 1)}`,
    creator_id: "kit",
    slug: "a-sample-build",
    title: "Inbox triage agent that files its own receipts",
    outcome: "Turns a week of manual triage into ten minutes, and says what it did.",
    shape: "agent",
    status: "published",
    made_for: ["founders", "ops"],
    made_with: [],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 80,
    reproduction_count: 41,
    last_confirmed_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    last_confirmed_model: "sonnet-4-5",
    published_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    parent_build_id: null,
    rebuild_count: 3,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    nodes: [],
    media: [],
    bounties: [],
    ...over,
  } as GalleryBuild;
}

/** Every sample, built once so the swatches and the map cannot disagree. */
function cardSamples() {
  const srcByPath = new Map<string, string>();
  const m = (over: Partial<GalleryMedia> & { width: number; height: number }) =>
    sampleMedia(srcByPath, over);

  /** A post of N pictures at these shapes, positioned in order. */
  const postOf = (
    shapes: Array<Partial<GalleryMedia> & { width: number; height: number }>,
  ) => shapes.map((shape, i) => ({ ...m(shape), post_position: i }));

  const samples: Array<{ label: string; build: GalleryBuild }> = [
    {
      label: "one entry",
      build: sampleBuild({ media: postOf([{ width: 1600, height: 1000 }]) }),
    },
    {
      label: "four entries · collapsed",
      build: sampleBuild({
        title: "Four screenshots, one run",
        media: postOf([
          { width: 1600, height: 1000 },
          { width: 1200, height: 1200 },
          { width: 900, height: 1200 },
          { width: 2000, height: 900 },
        ]),
      }),
    },
    {
      label: "four entries · click Show thread (mixed shapes + video)",
      build: sampleBuild({
        title: "Mixed shapes, and one of them moves",
        media: postOf([
          { width: 1600, height: 1000, post_text: "The queue before." },
          { width: 1200, height: 1600, post_text: "And after, on live mail." },
          {
            width: 1920,
            height: 1080,
            kind: "video",
            poster_path: "kit/video-poster.svg",
            duration: 42,
          },
          { width: 2400, height: 1000, post_text: "The receipts it filed." },
        ]),
      }),
    },
    {
      label: "an entry with no text",
      build: sampleBuild({
        outcome: null,
        title: "A picture that speaks for itself",
        media: postOf([{ width: 1500, height: 1000 }]),
      }),
    },
    {
      label: "no picture",
      build: sampleBuild({
        title: "A study with nothing to show but its numbers",
        shape: "study",
        media: [],
      }),
    },
    {
      label: "5:1 panorama → cropped to the 2.0 cap",
      build: sampleBuild({
        title: "A panorama, framed",
        media: postOf([{ width: 5000, height: 1000 }]),
      }),
    },
    {
      label: "1:3 portrait → cropped to the 0.75 cap",
      build: sampleBuild({
        title: "A tall one, framed",
        media: postOf([{ width: 1000, height: 3000 }]),
      }),
    },
    {
      label: "open bounty",
      build: sampleBuild({
        title: "Works, except for the retry prompt",
        media: postOf([{ width: 1600, height: 1000 }]),
        bounties: [{ id: "kit-bo", reward_gbp: 150, status: "open" }],
      } as Partial<GalleryBuild>),
    },
    {
      label: "never reproduced · stale · rebuilt",
      build: sampleBuild({
        title: "Nobody has run this one yet",
        reproduction_count: 0,
        last_confirmed_at: null,
        last_confirmed_model: null,
        media: postOf([{ width: 1600, height: 1000 }]),
      }),
    },
  ];

  // The video's poster needs a swatch of its own: a card renders a video from
  // its poster, never from the video.
  srcByPath.set("kit/video-poster.svg", swatch(1920, 1080, "poster 1920×1080"));

  return { samples, srcByPath: srcByPath as MediaSrcMap };
}

const CARD_SAMPLES = cardSamples();

/** One sample, at one width, labelled. */
function CardSample({
  label,
  children,
  width,
}: {
  label: string;
  children: React.ReactNode;
  width: number;
}) {
  return (
    // `min()` rather than a flat width: the feed column is 560 where there is
    // room for 560, and the page must not scroll sideways at 390 to show it.
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, width: `min(${width}px, 100%)` }}>
      <span style={{ ...eyebrow, color: t.text2 }}>{label}</span>
      {children}
    </div>
  );
}

/**
 * The Card section.
 *
 * TWO COLUMN WIDTHS, because the two layouts are two column widths: a gallery
 * cell is ~300px and the feed's centre column is ~560px, and a card that only
 * ever looked right at one of them would be a card with a bug this page exists
 * to find.
 */
function CardSection() {
  const { samples, srcByPath } = CARD_SAMPLES;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
      <h2 style={{ ...eyebrow, color: t.text2, margin: 0 }}>Card — grid layout (272px cell)</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))",
          gap: SPACE.sm,
          alignItems: "start",
        }}
      >
        {samples.map(({ label, build }) => (
          <div key={`grid-${build.id}`} style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
            <span style={{ ...eyebrow, color: t.text2 }}>{label}</span>
            <GalleryCard build={build} srcByPath={srcByPath} credit={null} />
          </div>
        ))}
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
          <span style={{ ...eyebrow, color: t.text2 }}>skeleton</span>
          <GalleryCardSkeleton />
        </div>
      </div>

      <h2 style={{ ...eyebrow, color: t.text2, margin: 0 }}>Card — feed layout (560px column)</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.md, alignItems: "flex-start" }}>
        {samples.map(({ label, build }) => (
          <CardSample key={`feed-${build.id}`} label={label} width={560}>
            <GalleryCard
              build={build}
              srcByPath={srcByPath}
              credit={
                build.title === "Four screenshots, one run"
                  ? "Rebuilt from Inbox triage agent by @amara"
                  : null
              }
              layout="feed"
            />
          </CardSample>
        ))}
        <CardSample label="skeleton" width={560}>
          <GalleryCardSkeleton layout="feed" />
        </CardSample>
      </div>
    </section>
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
        <Tabs defaultValue="one">
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

      <CardSection />

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
