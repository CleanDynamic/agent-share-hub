// SV-03 P6: the loading shape of the page the address names, from the route table; an empty slot of the old height otherwise.

import { useLocation } from "react-router-dom";

import { matchRoute } from "./routeTable";

export function RoutePlaceholder() {
  const { pathname } = useLocation();
  const match = matchRoute(pathname);
  if (!match) return <div style={{ minHeight: "60vh", background: "var(--bg)" }} />;
  const { Placeholder } = match.entry;
  return <Placeholder />;
}
