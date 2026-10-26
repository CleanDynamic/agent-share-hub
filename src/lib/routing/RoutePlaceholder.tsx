// SV-03 P6: the loading shape of the page the address names, from the route table; an empty slot of the old height otherwise.
// SV-04: or of the page a change is on its way to, when it is named (`pathname`).

import { useLocation } from "react-router-dom";

import { matchRoute } from "./routeTable";

export function RoutePlaceholder({ pathname }: { pathname?: string }) {
  const location = useLocation();
  const match = matchRoute(pathname ?? location.pathname);
  if (!match) return <div style={{ minHeight: "60vh", background: "var(--bg)" }} />;
  const { Placeholder } = match.entry;
  return <Placeholder />;
}
