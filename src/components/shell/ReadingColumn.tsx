/* The reading column: a page of words under the shared page header, in the page grid's middle track (columns 4 to 9 of 12,
   the feed template's centre) on a desktop and the whole width on a phone. 24 under the header, 48 between its groups. */

import type { ReactNode } from "react";

import { pageColumns } from "./pageGrid";
import { useIsPhone } from "./useMinWidth";

export function ReadingColumn({ children }: { children: ReactNode }) {
  const phone = useIsPhone();
  const column = <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 48, paddingBottom: 64 }}>{children}</div>;
  if (phone) return <div style={{ marginTop: 24 }}>{column}</div>;
  return (
    <div style={{ ...pageColumns("feed"), marginTop: 24 }}>
      <div />
      {column}
    </div>
  );
}

export default ReadingColumn;
