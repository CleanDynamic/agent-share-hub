/* UX-05: the pieces the feed and the space page share: the page head (heading, a line, the one primary on the right; on a
   phone the primary under them at full width, 44 high), the load-error line and the empty line. Kept out of the frame module
   so the route table's Placeholder carries none of them. */

import { PageState } from "@/components/pagestate/PageState";
import type { ReadLike } from "@/components/pagestate/pageStateModel";
import { WAY_OUT, type Thing } from "@/components/pagestate/stateCopy";
import type { CSSProperties, ReactNode } from "react";

import { PAGE_TITLE, PageHeader } from "@/components/shell/PageHeader";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { PostControl } from "@/components/post/postControls";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

const LINE: CSSProperties = { margin: "2px 0 0", fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text2 };
const META: CSSProperties = { margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 12, lineHeight: "16px", color: t.label };

/** The feed's head copy, drawn by the page and by its loading view alike. */
export const FEED_HEAD = { title: "OpenBuilds", line: "Post anything, reply with anything. Spaces are made and run by the people in them." } as const;

/** The head: the page's `h1`, a line under it, optional meta, and the actions at the right (full width under them on a phone).
    Desktop: PageHeader, with the breadcrumb above the title on a page with a parent (a space). */
export function PageHead({ title, line, meta, actions, primary, breadcrumb }: { title: string; line?: string; meta?: ReactNode; actions?: ReactNode; primary?: ReactNode; breadcrumb?: ReactNode }) {
  const phone = useIsPhone();
  if (!phone) {
    return (
      <div style={{ paddingBottom: 24 }}>
        <PageHeader
          title={title}
          breadcrumb={breadcrumb}
          actions={
            actions || primary ? (
              <>
                {actions}
                {primary}
              </>
            ) : undefined
          }
        />
        {line ? <p style={LINE}>{line}</p> : null}
        {meta ? <p style={META}>{meta}</p> : null}
      </div>
    );
  }
  return (
    <header style={{ display: "flex", flexDirection: phone ? "column" : "row", alignItems: phone ? "stretch" : "flex-start", justifyContent: "space-between", gap: phone ? 16 : 24, padding: "0 4px 24px" }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={PAGE_TITLE}>{title}</h1>
        {line ? <p style={LINE}>{line}</p> : null}
        {meta ? <p style={META}>{meta}</p> : null}
      </div>
      {actions || primary ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexDirection: phone ? "column" : "row", alignSelf: phone ? "stretch" : "flex-start" }}>
          {actions}
          {primary}
        </div>
      ) : null}
    </header>
  );
}

/**
 * G4, G7, G8: a Space or a Post that did not load, or is not at this address. The page head with the page's kind as its title
 * (the space's name or the topic's heading is what did not load), and PageState: "Couldn't load this space. Try again." or
 * "Nothing at this address.", the kind's line, and OpenBuilds as the way out (D5).
 */
export function OpenBuildsState({ title, read, thing, region, kind, missing }: { title: string; read: ReadLike; thing: Thing; region: string; kind: "space" | "post"; missing?: (data: unknown[]) => boolean }) {
  return (
    <div>
      <PageHead title={title} />
      <PageState read={read} thing={thing} region={region} skeleton={null} style={{ padding: "16px 20px" }} notFound={missing ? { when: missing, kind, way: WAY_OUT.openBuilds } : undefined}>
        {() => null}
      </PageState>
    </div>
  );
}
