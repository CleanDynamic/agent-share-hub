/* G20: the editor's first load, when it is not the editor: the build did not load, or it is not at this address. Both
   through PageState, under the page's title ("Build": what the title names is what did not load, as on the other pages),
   with Try again for a failure and "Start a new build" as the way out of a missing build (D5). Loading is the editor's
   own skeleton (ComposeSkeleton / ComposeArrival), not this. A first load refused because the session ended shows the
   editor's signed-out banner above it (G21), and PageState holds the state until the member is signed in again (G18). */

import type { CSSProperties } from "react";

import { PageState } from "@/components/pagestate/PageState";
import { useSessionPhase } from "@/components/pagestate/useSessionPhase";
import { readOf } from "@/components/pagestate/pageStateModel";
import { WAY_OUT } from "@/lib/copy/copy";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { SignedOutStrip } from "./saveStrips";

export function EditorLoadState({ status, onRetry, loadError, style }: { status: "error" | "notFound"; onRetry: () => void; loadError?: unknown; style?: CSSProperties }) {
  // G21: a first load the server refused because the session ended: the editor's banner says so here too (G18 holds the state).
  const ended = useSessionPhase() === "ended";
  const read = status === "error" ? readOf("error", undefined, onRetry, loadError ?? { message: "the build did not load" }) : readOf("ready", null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520, ...style }}>
      {ended ? <SignedOutStrip /> : null}
      <h1 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 22, fontWeight: 500, lineHeight: "28px", letterSpacing: "-0.015em", color: t.text }}>Build</h1>
      <PageState
        read={read}
        thing="this build"
        region="The composer"
        skeleton={null}
        log="[Compose] build read failed"
        notFound={{ when: () => status === "notFound", kind: "editor", way: WAY_OUT.newBuild }}
      >
        {() => null}
      </PageState>
    </div>
  );
}
