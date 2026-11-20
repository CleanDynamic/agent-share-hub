import { r } from "@/lib/theme/radius";

export function BeaverLogo({ theme, size = 32 }: { theme: "dusk" | "noon"; size?: number }) {
  const base = `/brand/beaver-${theme === "dusk" ? "dark" : "light"}`;
  return <img src={`${base}-64.png`} srcSet={`${base}-64.png 1x, ${base}-128.png 2x`} width={size} height={size} alt="" style={{ display: "block", flexShrink: 0, borderRadius: size === 16 ? r.chip : r.control }} />;
}