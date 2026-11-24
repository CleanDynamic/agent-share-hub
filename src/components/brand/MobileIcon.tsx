// A phone icon (prompt 18): `<MobileIcon name="home" size={24} />`. The markup is a constant in this repo, never user input,
// so it goes in a `<g>` as is. The icon is hidden from assistive technology: the button or link around it carries the name.

import { memo } from "react";

import { MOBILE_ICONS, type MobileIconName } from "./mobileIcons";

export interface MobileIconProps {
  name: MobileIconName;
  /** 24 in the top bar, the dock and sheet headers; 20 on post actions and sheet rows; 16 inside pills, fields and tiles. */
  size?: 16 | 20 | 24 | number;
  strokeWidth?: number;
}

export const MobileIcon = memo(function MobileIcon({ name, size = 24, strokeWidth = 2 }: MobileIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      style={{ display: "block", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: MOBILE_ICONS[name] }}
    />
  );
});

export default MobileIcon;
