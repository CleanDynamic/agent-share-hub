// The provenance line: how this build arrived.
//
// EX-P14. One quiet sentence under the provenance block at the top of a build
// page, saying that a conversation was extracted by a connector and that a
// person reviewed it before any of it was written. The sentence itself is
// composed in ./createdViaCopy; this is the element it lands in.
//
// IT IS A SENTENCE, NOT A BADGE. No chip, no pill, no container, no icon and no
// colour of its own — `--text2`, the token every other piece of metadata on
// this page already uses, at the body size the page already reads at. The
// theme's warning and category hues are not available to it and would be wrong
// if they were: a build that arrived through a connector is not a build with a
// problem, and a mark that looked like one would say so to every reader at a
// glance. A badge also invites a badge for the opposite case, and there is no
// sentence worth writing under a build that someone typed out by hand.
//
// AND IT IS ONLY A SENTENCE. Nothing about this line reaches ranking,
// completeness or the gallery gate — see src/lib/build/provenance.ts, which
// says the same thing from the other end.
//
// IT CREDITS THE CREATOR, NOT THE TOOL. "reviewed by the creator" is the half
// of the sentence that matters and it is why the line can be written at all:
// the connector parks a proposal and nothing reaches a build until a person
// ticks it through on the upload page. A line that named the tool and stopped
// would describe a machine writing to a gallery, which is not what happened.

import type { CSSProperties } from "react";
import type { CreatedVia } from "@/lib/build/provenance";
import { t } from "@/lib/theme/tokens";
import { body as bodyType, measure } from "@/lib/theme/type";
import { createdViaSentence } from "./createdViaCopy";

/** Visual properties only. The line is a new element and reshapes nothing. */
const lineStyle: CSSProperties = {
  ...bodyType,
  ...measure,
  margin: 0,
  color: t.text2,
};

export function CreatedViaLine({ createdVia }: { createdVia: CreatedVia | null | undefined }) {
  const sentence = createdViaSentence(createdVia);
  if (!sentence) return null;

  return (
    <p data-visual-slot="build-created-via" data-testid="created-via" style={lineStyle}>
      {sentence}
    </p>
  );
}

export default CreatedViaLine;
