/* SV-02: the dev page of a vision board whose page prompt has not landed.

   `design-compare.spec.ts` reads `data-design-ready` and skips a board that says "false". Each page prompt (SV-08 to
   SV-14, and SV-18) swaps its entry in `KitPages.tsx` for the page's view and the board starts being compared. */

export default function VisionNotBuilt() {
  return <div data-design-ready="false">Not built yet</div>;
}
