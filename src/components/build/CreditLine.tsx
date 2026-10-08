// The build page's credit line: "by <maker>", and at its end, for a signed-in
// reader who is not the maker, a quiet "Report" (RC-P17b).
//
// REPORT IS NOT A FIFTH HEADER ACTION ⟦hicks-law › Budgets: 4 beside the
// primary⟧. It is a tertiary text control at the end of the line that says who
// made the build — findable by a reader who went looking for it, and quiet
// enough that nobody else meets it on the way to the build.

import { Link } from "react-router-dom";
import { useIsPhone } from "@/components/shell/useMinWidth";
import type { BuildMaker } from "@/lib/build";
import { buttonStyle, ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body, label as labelType } from "@/lib/theme/type";

export interface CreditLineProps {
  maker: BuildMaker | null | undefined;
  /** Shown only when given: a signed-in reader who is not the maker. */
  onReport?: () => void;
}

export function CreditLine({ maker, onReport }: CreditLineProps) {
  const name = maker?.displayName?.trim() || (maker?.username ? `@${maker.username}` : null);
  if (!name && !onReport) return null;

  return (
    <p
      data-testid="build-credit-line"
      style={{ ...body, color: t.text2, margin: 0, display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: SPACE.xs }}
    >
      {name ? (
        <span>
          by{" "}
          {maker?.username ? <MakerName to={`/profile/${encodeURIComponent(maker.username)}`}>{name}</MakerName> : name}
        </span>
      ) : null}
      {onReport ? <ReportControl onPress={onReport} /> : null}
    </p>
  );
}

function MakerName({ to, children }: { to: string; children: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      {...handlers}
      style={{ color: t.text, textDecoration: "none", borderRadius: r.chip, ...ring(state.focusVisible) }}
    >
      {children}
    </Link>
  );
}

function ReportControl({ onPress }: { onPress: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  /* UI-P58: a 44px target on a phone; above it the table's 36. */
  const phone = useIsPhone();
  return (
    <button
      type="button"
      data-testid="report-build"
      onClick={onPress}
      {...handlers}
      style={{ ...buttonStyle("ghost", state), ...labelType, minHeight: phone ? 44 : 36, padding: `0 ${SPACE.xs}px` }}
    >
      Report
    </button>
  );
}

export default CreditLine;
