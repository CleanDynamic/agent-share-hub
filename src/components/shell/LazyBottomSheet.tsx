// SV-26 P2: the frame's bottom sheets (the header's search and account sheets) draw nothing until they first open, so
// the sheet and the dialog library under it load then, or at idle once the first page is ready, whichever comes first.
// Opened after idle, the code is already here and the sheet opens at once, exactly as `BottomSheet` does.

import { lazy, Suspense } from "react";

import { useEverOpened, useLoadAtIdle } from "@/lib/routing/lazyHost";

import type { BottomSheetProps } from "./BottomSheet";

const loadBottomSheet = () => import("./BottomSheet");
const Sheet = lazy(() => loadBottomSheet().then((m) => ({ default: m.BottomSheet })));

export function LazyBottomSheet(props: BottomSheetProps) {
  useLoadAtIdle(loadBottomSheet);
  const ever = useEverOpened(props.open);
  return ever ? (
    <Suspense fallback={null}>
      <Sheet {...props} />
    </Suspense>
  ) : null;
}
