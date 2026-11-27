// 29e: the phone's two app-wide listeners, installed once: the press state on pointerdown (phonePress.ts) and a focused field
// kept above the keyboard (phoneKeyboard.ts). Both do nothing at 768 and up. Renders nothing.

import { useEffect } from "react";

import { installPhoneKeyboard } from "@/lib/theme/phoneKeyboard";
import { installPhonePress } from "@/lib/theme/phonePress";

export function PhoneInteractions() {
  useEffect(() => {
    const stopPress = installPhonePress();
    const stopKeyboard = installPhoneKeyboard();
    return () => {
      stopPress();
      stopKeyboard();
    };
  }, []);
  return null;
}

export default PhoneInteractions;
