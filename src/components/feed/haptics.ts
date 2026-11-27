/* Prompt 29a: the pull to refresh's two haptics, in the iOS and Android apps only (Capacitor's Haptics plugin, when the app has
   it). On the web nothing happens: there is no vibration on a pull in Safari, and Chrome's would feel foreign. */

interface HapticsPlugin {
  impact?: (options: { style: "LIGHT" | "MEDIUM" | "HEAVY" }) => Promise<void> | void;
  notification?: (options: { type: "SUCCESS" | "WARNING" | "ERROR" }) => Promise<void> | void;
}

function plugin(): HapticsPlugin | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Haptics?: HapticsPlugin } } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.Haptics ?? null;
}

/** One light tap: the pull has crossed the arm point. */
export function hapticLight(): void {
  try {
    void plugin()?.impact?.({ style: "LIGHT" });
  } catch {
    /* a haptic is never worth an error */
  }
}

/** Success: the beaver's head breaks the surface. */
export function hapticSuccess(): void {
  try {
    void plugin()?.notification?.({ type: "SUCCESS" });
  } catch {
    /* a haptic is never worth an error */
  }
}
