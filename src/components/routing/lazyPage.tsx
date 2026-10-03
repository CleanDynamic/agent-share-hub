// UI-P40 — a route page in its own chunk, carrying its own Suspense boundary.
//
//   const About = lazyPage(() => import("./pages/About"));
//
// The legacy routes in App.tsx render their page bare, with no Suspense
// between them and the shell's <Outlet />. Wrapping the lazy component here
// keeps every <Route> line and the shell untouched. The fallback holds the
// page's height on the ground colour, so the swap to the page does not shift.

import { Suspense, lazy, type ComponentProps, type ComponentType } from "react";

export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  const Page = lazy(load);
  function LazyPage(props: ComponentProps<T>) {
    return (
      <Suspense fallback={<div style={{ minHeight: "60vh", background: "var(--bg)" }} />}>
        <Page {...props} />
      </Suspense>
    );
  }
  return LazyPage;
}
