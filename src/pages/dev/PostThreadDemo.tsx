/* PT-03, CA-07 — /dev/kit/pages/post-thread?theme=noon|dusk.

   Every state of a post's pictures, each at 628px (a desktop column) and 362px (a phone's), for looking at and for the
   screenshots of CA-07 P9. The theme is the page's, set by `?theme=`, so Noon and Dusk are the two links at the top and
   not two panels: the tokens follow <html data-theme>. The pictures are the plain drawings in public/dev/ca07, served as
   they are, so nothing is signed and nothing is fetched from the database.

   Readers: one picture (normal, tall, wide), two, three, four, a video, a GIF, a description, a content warning, a
   linked step, a whole post, and a post saved before CA-07 (pictures between the lines, a row of three, captions),
   which reads as a grid without being saved again. Then a Gallery card. The composer: a thread of three posts holding
   1, 3 and 4 pictures; uploading and failed; the same old post opened in the editor; and the phone's strip. */

import { useMemo, useState, type ReactNode } from "react";
import { MemoryRouter, useSearchParams } from "react-router-dom";

import { FeedPost } from "@/components/gallery/FeedPost";
import { MediaViewerProvider } from "@/components/post/media/MediaViewer";
import { PostThread } from "@/components/post/PostThread";
import { PostRefsProvider } from "@/components/post/RefLinks";
import type { GalleryBuild, GalleryMedia } from "@/lib/build";
import type { RefEntry } from "@/lib/build/postRefs";
import { splitThread, type ThreadBlock, type ThreadDoc, type ThreadInline, type ThreadPostMedia } from "@/lib/build/thread";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { PostTab } from "@/pages/site/compose/PostTab";
import type { ComposeThread } from "@/pages/site/compose/useComposeThread";

import type { DesignPageProps } from "./KitPages";

/* ── the pictures ── */

const row = (id: string, file: string, width: number, height: number, over: Partial<GalleryMedia> = {}): GalleryMedia => ({
  id,
  node_id: null,
  bucket: "build-media",
  path: `dev/ca07/${file}`,
  kind: "image",
  width,
  height,
  poster_path: null,
  duration: null,
  post_position: null,
  post_text: null,
  ...over,
});

const ROWS: GalleryMedia[] = [
  row("wide", "wide.svg", 1600, 900),
  row("tall", "tall.svg", 1170, 2532),
  row("pano", "panorama.svg", 3200, 1000),
  row("square", "square.svg", 1000, 1000),
  row("portrait", "portrait.svg", 1200, 1600),
  // A GIF is known by its path; the drawing stands in for its frames.
  row("loop", "loop.gif", 800, 600),
  row("clip", "clip.mp4", 1920, 1080, { kind: "video", poster_path: "dev/ca07/poster.svg", duration: 12 }),
];
const MEDIA = new Map(ROWS.map((one) => [one.id, one]));
const SRC: ReadonlyMap<string, string> = new Map([
  ...ROWS.map((one) => [one.path, `/${one.path.replace("loop.gif", "loop.svg")}`] as const),
  ["dev/ca07/poster.svg", "/dev/ca07/poster.svg"],
]);

const pic = (id: string, over: Partial<ThreadPostMedia["attrs"]> = {}): ThreadPostMedia => {
  const media = MEDIA.get(id);
  return { type: "postMedia", attrs: { mediaId: id, width: 100, w: media?.width ?? null, h: media?.height ?? null, alt: "", crop: null, aspect: null, zoom: null, warn: [], caption: "", ...over } };
};
const grid = (step: string | null, ...pictures: ThreadPostMedia[]): ThreadBlock => ({ type: "postMediaGrid", attrs: { step }, content: pictures });
const words = (value: string): ThreadInline => ({ type: "text", text: value });
const para = (value: string): ThreadBlock => ({ type: "paragraph", content: [words(value)] });
const doc = (...content: ThreadBlock[]): ThreadDoc => ({ type: "doc", content });
const brk: ThreadBlock = { type: "postBreak" };

/* ── a step to link to ── */

const STEP: RefEntry = {
  to: "node:build-agent",
  number: "4.2",
  title: "Build agent",
  kind: "Agent",
  depth: 1,
  colour: null,
  name: "build agent",
  eyebrow: "Agent 4.2 · Session 2",
  body: "Build what the lead hands you, with the tests passing.",
  heading: "Build agent",
  id: "build-agent",
};
const LOOKUP: ReadonlyMap<string, RefEntry> = new Map([[STEP.to, STEP]]);
const GROUPS = [{ key: "s2", label: "Session 2 · Claude Code", entries: [STEP] }];
const REFS = { lookup: LOOKUP, onGo: () => undefined };

/* ── the reader's states ── */

const OLD_POST = doc(
  para("Saved before CA-07: a picture between the lines, a row of three and two captions."),
  pic("wide", { caption: "The homepage on launch day" }) as unknown as ThreadBlock,
  para("The captions stay in the saved data and are not drawn."),
  { type: "postMediaRow", content: [pic("square"), pic("portrait", { caption: "A loaf on the counter" }), pic("pano")] },
);

const STATES: { id: string; label: string; doc: ThreadDoc }[] = [
  { id: "one", label: "One picture", doc: doc(para("One picture, shown whole."), grid(null, pic("wide"))) },
  { id: "tall", label: "One tall picture: held at 3:4, cut from the top", doc: doc(para("A phone screenshot."), grid(null, pic("tall"))) },
  { id: "wide", label: "One wide picture: held at 2:1, cut from the middle", doc: doc(para("A panorama."), grid(null, pic("pano"))) },
  { id: "two", label: "Two", doc: doc(para("Two side by side."), grid(null, pic("wide"), pic("portrait"))) },
  { id: "three", label: "Three", doc: doc(para("One tall and two stacked."), grid(null, pic("portrait"), pic("wide"), pic("square"))) },
  { id: "four", label: "Four", doc: doc(para("Two by two."), grid(null, pic("wide"), pic("portrait"), pic("square"), pic("pano"))) },
  { id: "video", label: "Video", doc: doc(para("A screen recording."), grid(null, pic("clip"))) },
  { id: "gif", label: "GIF", doc: doc(para("A loop."), grid(null, pic("loop"))) },
  { id: "alt", label: "Alt text", doc: doc(para("With a description."), grid(null, pic("square", { alt: "The shop front at dawn, the sign lit and the door open." }), pic("wide", { alt: "The menu board." }))) },
  { id: "warning", label: "Content warning", doc: doc(para("Flagged by the maker."), grid(null, pic("portrait", { warn: ["sensitive"] }), pic("wide"))) },
  { id: "step", label: "Linked step", doc: doc(para("From one of the build's steps."), grid(STEP.to, pic("wide"), pic("square"))) },
  {
    id: "full",
    label: "A full post",
    doc: doc(
      { type: "heading", attrs: { level: 1 }, content: [words("From a brand brief to a live site in four chats")] },
      para("Crumb is a neighbourhood bakery. Every prompt is in the build below, so you can run it for your own shop."),
      { type: "bulletList", content: [{ type: "listItem", content: [para("4 sessions") as never] }, { type: "listItem", content: [para("Live the same afternoon") as never] }] },
      grid(STEP.to, pic("wide", { alt: "The finished homepage." }), pic("portrait", { crop: { x: 0, y: 0.125, w: 1, h: 0.75 }, aspect: "original", zoom: 1.33 }), pic("square"), pic("clip")),
    ),
  },
  { id: "old", label: "Saved before CA-07, read as a grid", doc: OLD_POST },
];

const WIDTHS = [
  { px: 628, phone: false },
  { px: 362, phone: true },
] as const;

const note = { fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.5, color: t.text2, margin: 0 } as const;
const panel = { padding: 16, background: t.surface, border: `1px solid ${t.hairline}`, borderRadius: 10, maxWidth: "100%", boxSizing: "border-box" } as const;

function Widths({ id, render }: { id: string; render: (phone: boolean) => ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
      {WIDTHS.map(({ px, phone }) => (
        <div key={px} data-demo={`${id}-${px}`} style={{ ...panel, width: px + 32, flex: "none" }}>
          {render(phone)}
        </div>
      ))}
    </div>
  );
}

function Section({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section aria-label={label} data-demo-section={id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={note}>{label}</p>
      {children}
    </section>
  );
}

/* ── the composer ── */

function demoThread(initial: ThreadDoc): ComposeThread {
  let current = initial;
  return {
    status: "ready",
    version: 1,
    readDoc: () => current,
    onDoc: (next) => {
      current = next;
    },
    buildId: undefined,
    ensureBuild: async () => "00000000-0000-4000-8000-000000000001",
    posts: splitThread(initial).length,
    save: "idle",
    hold: null,
    flush: async () => undefined,
    retry: () => undefined,
    retryLoad: () => undefined,
  } as unknown as ComposeThread;
}

const COMPOSER_THREE = doc(
  para("We planned the page in one sitting."),
  grid(null, pic("wide")),
  brk,
  para("Then the agents took over: the build agent wrote it."),
  grid(STEP.to, pic("portrait"), pic("wide"), pic("square")),
  brk,
  para("And it works on a phone."),
  grid(null, pic("wide"), pic("portrait"), pic("square", { alt: "The menu." }), pic("pano")),
);
const UPLOADING = doc(
  para("Uploading, and one that did not upload."),
  grid(null, pic("wide"), { type: "postMedia", attrs: { ...pic("square").attrs, mediaId: "", uploadId: "demo-uploading" } as never }, { type: "postMedia", attrs: { ...pic("portrait").attrs, mediaId: "", uploadId: "demo-failed", failed: true } as never }),
);
const STRIP = doc(para("On a phone, the pictures are a strip while you write."), grid(null, pic("wide"), pic("portrait"), pic("square"), pic("pano")));
const DEV_MEDIA = { rows: ROWS, src: SRC, progress: new Map([["demo-uploading", 62]]) };
const MAKER = { id: "demo", name: "Sam Rivera", handle: "sam", avatar: null };

function Composer({ initial, phone }: { initial: ThreadDoc; phone: boolean }) {
  const thread = useMemo(() => demoThread(initial), [initial]);
  return <PostTab thread={thread} phone={phone} draft={{ build: null, title: "Crumb", maker: MAKER }} references={{ groups: GROUPS, lookup: LOOKUP }} devMedia={DEV_MEDIA} />;
}

/* ── the Gallery card ── */

const CARD: GalleryBuild = {
  id: "demo-card",
  slug: "crumb",
  title: "A bakery order page",
  creator_id: "demo",
  made_with: [],
  post_doc: doc(para("A neighbourhood bakery's order page, in one sitting and then agents."), grid(null, pic("wide"), pic("portrait", { warn: ["sensitive"] }), pic("square", { alt: "The menu." }))),
  media: ROWS,
  nodes: [],
  created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  published_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
} as unknown as GalleryBuild;

/* ── the page ── */

export default function PostThreadDemo(_props: DesignPageProps) {
  const [params] = useSearchParams();
  const dusk = params.get("theme") === "dusk";
  const only = params.get("only");
  const [, rerender] = useState(0);
  const link = (theme: "noon" | "dusk", label: string) => {
    const current = (theme === "dusk") === dusk;
    return (
      <a
        href={`?theme=${theme}`}
        aria-current={current ? "page" : undefined}
        onClick={() => rerender((n) => n + 1)}
        style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: current ? 500 : 400, color: current ? t.text : t.text2, padding: "12px 8px" }}
      >
        {label}
      </a>
    );
  };
  const shown = (id: string) => !only || only === id;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, padding: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ ...note, color: t.text }}>A post's pictures</p>
        <nav aria-label="Theme" style={{ display: "flex", gap: 8 }}>
          {link("noon", "Noon")}
          {link("dusk", "Dusk")}
        </nav>
      </div>

      {STATES.filter((state) => shown(state.id)).map((state) => (
        <Section key={state.id} id={state.id} label={state.label}>
          <Widths
            id={state.id}
            render={(phone) => (
              <MediaViewerProvider>
                <PostRefsProvider value={REFS}>
                  <PostThread posts={splitThread(state.doc)} mediaById={MEDIA} srcByPath={SRC} mode="page" phone={phone} />
                </PostRefsProvider>
              </MediaViewerProvider>
            )}
          />
        </Section>
      ))}

      {shown("card") ? (
        <Section id="card" label="A Gallery card">
          <Widths
            id="card"
            render={(phone) => (
              <MemoryRouter>
                <FeedPost build={CARD} srcByPath={SRC} makerHandle="sam" makerName="Sam Rivera" makerAvatar={null} modelsUsed={[]} phone={phone} />
              </MemoryRouter>
            )}
          />
        </Section>
      ) : null}

      {shown("composer") ? (
        <Section id="composer" label="The composer: three posts holding 1, 3 and 4 pictures">
          <Widths id="composer" render={(phone) => <Composer initial={COMPOSER_THREE} phone={phone} />} />
        </Section>
      ) : null}
      {shown("uploading") ? (
        <Section id="uploading" label="Uploading, and a failed upload">
          <Widths id="uploading" render={(phone) => <Composer initial={UPLOADING} phone={phone} />} />
        </Section>
      ) : null}
      {shown("old-composer") ? (
        <Section id="old-composer" label="The post saved before CA-07, opened in the composer">
          <Widths id="old-composer" render={(phone) => <Composer initial={OLD_POST} phone={phone} />} />
        </Section>
      ) : null}
      {shown("strip") ? (
        <Section id="strip" label="The phone's strip, while writing">
          <div data-demo="strip-362" style={{ ...panel, width: 362 + 32 }}>
            <Composer initial={STRIP} phone />
          </div>
        </Section>
      ) : null}
    </div>
  );
}
