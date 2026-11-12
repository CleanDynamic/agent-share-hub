import { describe, expect, it } from "vitest";

import { PAGE_GUTTER, pageColumns } from "./pageGrid";

const three = "calc((100% - 352px) * 3 / 12 + 64px)";

describe("pageColumns", () => {
  it("draws the three templates on 12 columns with 32 gutters", () => {
    expect(PAGE_GUTTER).toBe(32);
    expect(pageColumns("feed")).toEqual({ display: "grid", gridTemplateColumns: `${three} minmax(0, 1fr) ${three}`, columnGap: 32 });
    expect(pageColumns("mainSide")).toEqual({ display: "grid", gridTemplateColumns: `minmax(0, 1fr) ${three}`, columnGap: 32 });
    expect(pageColumns("full")).toEqual({ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", columnGap: 32 });
  });

  it("puts the track starts at 0, 336 and 1008 of a 1312 content width (64, 400 and 1072 at 1440)", () => {
    const side = (1312 - 352) * 3 / 12 + 64;
    expect(side).toBe(304);
    expect(side + PAGE_GUTTER).toBe(336);
    expect(1312 - side).toBe(1008);
  });
});
