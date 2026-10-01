// The theme control for the site frame's surfaces (UI-P18): Noon · Dusk · System.
//
// A `Segmented` bound to `ThemeContext`. It is the one theme control the footer,
// the sign-in page and the phone's account sheet share, so a choice made on any
// of them is the same choice (persisted under `bg-theme`, with System following
// the OS). `ThemeToggle` stays for `FlatShell`.
//
// `value` and `onChange` are for the dev compare page, which draws it without
// touching the stored preference.

import { Segmented, type SegmentedFontSize, type SegmentedSize } from "@/components/brand/Segmented";
import { useTheme, type ThemeChoice } from "@/contexts/ThemeContext";

const ITEMS = [
  { value: "noon", label: "Noon" },
  { value: "dusk", label: "Dusk" },
  { value: "system", label: "System" },
] as const;

export interface ThemeSegmentedProps {
  size?: SegmentedSize;
  fontSize?: SegmentedFontSize;
  value?: ThemeChoice;
  onChange?: (choice: ThemeChoice) => void;
}

export function ThemeSegmented({ size = 32, fontSize = 11, value, onChange }: ThemeSegmentedProps) {
  const { theme, setTheme } = useTheme();
  return (
    <Segmented<ThemeChoice>
      items={ITEMS}
      value={value ?? theme}
      onChange={onChange ?? setTheme}
      size={size}
      fontSize={fontSize}
      label="Theme"
    />
  );
}

export default ThemeSegmented;
