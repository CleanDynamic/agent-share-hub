// SV-28: windows the composer's own chunk used to carry, loaded the first time they open or at idle (SV-26's lazyWindow), so the
// composer stays within its 120 KB while SV-28 adds to the List.

import type { ComponentProps } from "react";

import { lazyWindow } from "./lazyWindow";
import type { OpenRequestDialog as OpenRequestDialogImpl } from "./OpenRequestDialog";
import type { PublishConfirm as PublishConfirmImpl } from "./PublishConfirm";
import type { RecentlyRemovedDialog as RecentlyRemovedDialogImpl } from "./RecentlyRemovedDialog";

export const OpenRequestWindow = lazyWindow<ComponentProps<typeof OpenRequestDialogImpl>>(() => import("./OpenRequestDialog").then((m) => ({ default: m.OpenRequestDialog })), (p) => p.open);
export const RecentlyRemovedWindow = lazyWindow<ComponentProps<typeof RecentlyRemovedDialogImpl>>(() => import("./RecentlyRemovedDialog").then((m) => ({ default: m.RecentlyRemovedDialog })), (p) => p.open);
export const PublishConfirmWindow = lazyWindow<ComponentProps<typeof PublishConfirmImpl>>(() => import("./PublishConfirm").then((m) => ({ default: m.PublishConfirm })), (p) => p.open);
