/* UI-P63 — the sandbox switches.

   Both are off. The new composer and the new build page are built beside the
   old ones, behind these, and neither is reachable by a visitor until UI-P76
   turns them on. With a switch off the old screen runs exactly as before.

   SANDBOX_COMPOSER_ENABLED — `ComposeRoute` renders `SandboxPage` in place of
   `ComposePage` (UI-P63 to UI-P66, UI-P68 to UI-P72). UI-P76 turns it on.

   BUILD_PAGE_STEPS_ENABLED — the build page draws the steps in place of
   Anatomy, Run it yourself, the part viewer and the timeline (UI-P73).
   UI-P76 turns it on.

   ROLLBACK is to set the value back to `false`. Nothing the old screens use
   is removed. */

export const SANDBOX_COMPOSER_ENABLED = true as const;

export const BUILD_PAGE_STEPS_ENABLED = true as const;
