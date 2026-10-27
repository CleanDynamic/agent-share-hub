/* SV-11: the Classification view of Builds, its own chunk. Not built yet: SV-13 draws it from the same builds the Table shows. */

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { BuildsOtherViewProps } from "./buildsOther";

export default function BuildsClassificationView(_props: BuildsOtherViewProps) {
  return (
    <p data-testid="builds-classification" style={{ margin: 0, paddingBlock: 16, fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text2 }}>
      Not built yet
    </p>
  );
}
