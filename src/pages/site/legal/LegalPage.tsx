/* UX-12 P2 and P3: the container shared by /privacy and /terms. It reads no data. It sets the page's head (noindex while the text is
   a draft), marks the page ready at once, and scrolls to the section named in the address after that. */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import type { LegalText } from "@/content/legal/types";
import { usePageReady } from "@/lib/routing/pageReady";

import { LegalView } from "./LegalView";
import { hashTarget } from "./legalModel";

export interface LegalPageProps {
  name: "privacy" | "terms";
  text: LegalText;
  /** `Privacy policy` */
  seoTitle: string;
  description: string;
  path: string;
}

export function LegalPage({ name, text, seoTitle, description, path }: LegalPageProps) {
  const { hash } = useLocation();
  usePageReady(name, true);

  useEffect(() => {
    const id = hashTarget(hash);
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <>
      <SeoHead title={seoTitle} description={description} path={path} noIndex={!text.reviewed} />
      <LegalView text={text} />
    </>
  );
}

export default LegalPage;
