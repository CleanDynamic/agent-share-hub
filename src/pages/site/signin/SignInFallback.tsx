/* UX-01 P9: what the sign-in route shows while its chunk loads, in place of an empty page: the form's outline in LoadingBlocks,
   the same size as the card (420 by 437 on a desktop; 336 by 453 on a phone, 27 in from each edge), centred in the page. The
   card replaces it at once: no crossfade, no blur, no reveal. LoadingBlocks is used as it is. */

import { LoadingBlocks } from "@/pages/site/compose/LoadingBlocks";
import { useIsPhone } from "@/components/shell/useMinWidth";

/** The card's box, measured from `signin-card` on /login. */
export const SIGNIN_CARD = { desktop: { width: 420, height: 437 }, phone: { height: 453, inset: 27 } } as const;

export function SignInFallback() {
  const phone = useIsPhone();
  return (
    <div
      data-testid="signin-fallback"
      style={{
        minHeight: "100dvh",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: phone ? `16px ${SIGNIN_CARD.phone.inset}px 22px` : "23px 17px",
      }}
    >
      <div
        data-testid="signin-fallback-card"
        style={{ width: phone ? "100%" : SIGNIN_CARD.desktop.width, height: phone ? SIGNIN_CARD.phone.height : SIGNIN_CARD.desktop.height, boxSizing: "border-box", position: "relative", overflow: "hidden" }}
      >
        <LoadingBlocks width="fill" height="fill" />
      </div>
    </div>
  );
}
