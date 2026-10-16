/* PT-03 — /dev/kit/pages/post-thread?theme=noon|dusk.

   One thread drawn closed, open and in page mode, each at 628px (a desktop
   column) and 362px (a phone's). The theme is the page's, set by `?theme=`, so
   Noon and Dusk are the two links at the top and not two panels: the tokens
   follow <html data-theme>. The pictures are plain t.tile blocks (nothing is
   signed), which is also how a picture looks before its bytes arrive. No board
   image is compared. */

import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PostThread, type PostThreadMode } from "@/components/post/PostThread";
import type { GalleryMedia } from "@/lib/build";
import { splitThread, type PostMediaAttrs, type ThreadBlock, type ThreadDoc, type ThreadInline, type ThreadMark } from "@/lib/build/thread";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { DesignPageProps } from "./KitPages";

const text = (value: string, marks?: ThreadMark[]): ThreadInline => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
});

const item = (...content: ThreadInline[]) => ({ type: "listItem" as const, content: [{ type: "paragraph" as const, content }] });

const picture = (mediaId: string, w: number, h: number, width: number, alt: string, caption = ""): { type: "postMedia"; attrs: PostMediaAttrs } => ({
  type: "postMedia",
  attrs: { mediaId, width, w, h, alt, caption },
});

const BLOCKS: ThreadBlock[] = [
  // Post 1
  { type: "heading", attrs: { level: 1 }, content: [text("From a brand brief to a live site in four chats")] },
  {
    type: "paragraph",
    content: [
      text("Crumb is a neighbourhood bakery. I wanted a homepage that sounds like the shop: "),
      text("warm, plain, no clichés", [{ type: "bold" }]),
      text(". Every prompt is in the build below, so you can "),
      text("run it for your own shop", [{ type: "italic" }]),
      text("."),
    ],
  },
  {
    type: "bulletList",
    content: [
      item(text("4 sessions across ChatGPT, Claude, Gemini and Claude Code")),
      item(text("5 prompts and one setup file, "), text("CLAUDE.md", [{ type: "underline" }])),
      item(text("Live on Vercel the same afternoon")),
    ],
  },
  picture("m1", 1600, 1000, 100, "The finished Crumb homepage, with the shop front and the day's loaves", "The homepage on launch day"),
  { type: "postBreak" },
  // Post 2
  { type: "heading", attrs: { level: 2 }, content: [text("How it came together")] },
  {
    type: "orderedList",
    content: [
      item(text("Write the brand brief in plain words")),
      item(text("Turn it into a voice guide")),
      item(text("Draft each page against the guide")),
      item(text("Check it on a phone, then ship")),
    ],
  },
  { type: "postMediaRow", content: [picture("m2", 1000, 1000, 100, "The shop sign, square"), picture("m3", 1200, 1600, 100, "A loaf on the counter, portrait")] },
  { type: "postBreak" },
  // Post 3
  { type: "heading", attrs: { level: 2 }, content: [text("It works on a phone")] },
  {
    type: "paragraph",
    content: [text("Most of the shop's visitors arrive from a map link on a phone, so the menu comes first and the opening hours sit under it.")],
  },
  picture("m4", 1170, 2532, 40, "The homepage on a phone, scrolled to the menu"),
  { type: "postBreak" },
  // Post 4
  { type: "heading", attrs: { level: 2 }, content: [text("What I would change")] },
  { type: "bulletList", content: [item(text("Ask for the opening hours in the first prompt")), item(text("Keep the voice guide in the repo from day one"))] },
  picture("m5", 1920, 1080, 100, "A screen recording of the order form"),
];

const DOC: ThreadDoc = { type: "doc", content: BLOCKS };

const row = (id: string, kind: "image" | "video", width: number, height: number): GalleryMedia => ({
  id,
  node_id: null,
  bucket: "build-media",
  path: `dev/${id}`,
  kind,
  width,
  height,
  poster_path: null,
  duration: null,
  post_position: null,
  post_text: null,
});

const MEDIA_BY_ID: ReadonlyMap<string, GalleryMedia> = new Map(
  [row("m1", "image", 1600, 1000), row("m2", "image", 1000, 1000), row("m3", "image", 1200, 1600), row("m4", "image", 1170, 2532), row("m5", "video", 1920, 1080)].map((media) => [media.id, media]),
);

const NO_SRC: ReadonlyMap<string, string> = new Map();
const POSTS = splitThread(DOC);

const WIDTHS = [
  { px: 628, phone: false },
  { px: 362, phone: true },
] as const;

/** The three modes. Closed and open are the live toggle; page is fixed. */
function Thread({ start, px, phone }: { start: PostThreadMode; px: number; phone: boolean }) {
  const [mode, setMode] = useState<PostThreadMode>(start);
  return (
    <div style={{ width: px, flex: "none", maxWidth: "100%" }}>
      <PostThread
        posts={POSTS}
        mediaById={MEDIA_BY_ID}
        srcByPath={NO_SRC}
        mode={mode}
        onOpen={() => setMode("open")}
        onClose={() => setMode("closed")}
        // The Gallery asks for the cap; the build page does not.
        capTall={start !== "page"}
        phone={phone}
      />
    </div>
  );
}

const note = { fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.5, color: t.text2, margin: 0 } as const;

export default function PostThreadDemo(_props: DesignPageProps) {
  const [params] = useSearchParams();
  const dusk = params.get("theme") === "dusk";
  const link = (theme: "noon" | "dusk", label: string) => {
    const current = (theme === "dusk") === dusk;
    return (
      <a
        href={`?theme=${theme}`}
        aria-current={current ? "page" : undefined}
        style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: current ? 500 : 400, color: current ? t.text : t.text2, padding: "12px 8px" }}
      >
        {label}
      </a>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, padding: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ ...note, color: t.text }}>The post thread</p>
        <nav aria-label="Theme" style={{ display: "flex", gap: 8 }}>
          {link("noon", "Noon")}
          {link("dusk", "Dusk")}
        </nav>
      </div>
      {(
        [
          ["closed", "Closed"],
          ["open", "Open"],
          ["page", "Page"],
        ] as const
      ).map(([mode, label]) => (
        <section key={mode} aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={note}>{label}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
            {WIDTHS.map(({ px, phone }) => (
              <div key={px} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={note}>{px}px</p>
                <div style={{ padding: 16, background: t.surface, border: `1px solid ${t.hairline}`, borderRadius: 10, maxWidth: "100%", boxSizing: "border-box" }}>
                  <Thread start={mode} px={px} phone={phone} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
