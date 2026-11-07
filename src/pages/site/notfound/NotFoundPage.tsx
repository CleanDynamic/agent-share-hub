/* UX-12 P5: the container for the `*` route. It tells the error log about the address (the call is Lovable's original, unchanged:
   same source, same context), sets the head (noindex), marks the page ready at once (there is no data) and draws the view.

   `NotFoundHere` is the same view for a page that draws its own "not found" state (a missing project, draft or post): it says what
   it could not find, and does not report. The site is a single-page app, so the server still answers 200 for an unknown address. */

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { reportError } from "@/lib/errors/report";
import { useGo } from "@/lib/routing/go";
import { usePageReady } from "@/lib/routing/pageReady";

import { NotFoundView } from "./NotFoundView";

function useHome(): () => void {
  const go = useGo();
  const navigate = useNavigate();
  return () => (go ? go("/") : navigate("/"));
}

/** For another page's own not-found state. */
export function NotFoundHere({ sentence }: { sentence: string }) {
  const { pathname } = useLocation();
  const onHome = useHome();
  return <NotFoundView path={pathname} onHome={onHome} sentence={sentence} />;
}

const NotFoundPage = () => {
  const location = useLocation();
  const onHome = useHome();
  usePageReady("notfound", true);

  useEffect(() => {
    reportError(location.pathname, { source: "console", context: "404 Error: User attempted to access non-existent route:" });
  }, [location.pathname]);

  return (
    <>
      <SeoHead title="Page not found" description="This page isn't here." path={location.pathname} noIndex />
      <NotFoundView path={location.pathname} onHome={onHome} />
    </>
  );
};

export default NotFoundPage;
