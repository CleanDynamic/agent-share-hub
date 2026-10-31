// SV-26 P2: the sonner toaster, mounted at idle (App.tsx) so sonner is not in the first download. sonner keeps every toast
// it was asked for, but a toaster only hears of the ones raised after it mounts; this one shows, once, those raised
// before it arrived (a toast from a page that opened first), so none is lost.

import { useEffect } from "react";
import { toast } from "sonner";

import { Toaster } from "./sonner";

export function IdleSonner() {
  useEffect(() => {
    // The toaster's own effect (a child's) has subscribed by now: raising a kept toast again by its id shows it.
    for (const kept of toast.getToasts()) {
      if ("dismiss" in kept) continue;
      const { title, ...rest } = kept;
      toast(title as string, rest);
    }
  }, []);
  return <Toaster />;
}
