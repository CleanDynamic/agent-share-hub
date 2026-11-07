import { Helmet } from "react-helmet-async";
import { SITE_NAME, siteUrl } from "@/lib/site";

// UX-13: the canonical and og:url always come from the one site address, so the
// Lovable address and any preview canonicalise to openbuilds.ai.

// UX-14: every title is `<page> · OpenBuilds.ai`, and the home page is the name alone.
const TITLE_SUFFIX = ` · ${SITE_NAME}`;

/** The title a page gets: the suffix once, and none when the title already is the site's name. */
function fullTitle(title: string): string {
  if (title === SITE_NAME || title.endsWith(TITLE_SUFFIX)) return title;
  return `${title}${TITLE_SUFFIX}`;
}

interface SeoHeadProps {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  ogType?: string;
  /** Optional Open Graph image URL (og:image / twitter:image). */
  image?: string;
  /** Single JSON-LD object OR array for emitting multiple <script> tags. */
  jsonLd?: Record<string, any> | Record<string, any>[];
  /** Optional Twitter @handle (without @) for twitter:creator. */
  twitterCreator?: string;
  /**
   * Optional Twitter @handle (without @) for twitter:site. Omitted unless
   * passed: OpenBuilds.ai has no account of its own to name (RC-P16b).
   */
  twitterSite?: string;
  /** ISO date strings for article metadata. */
  publishedTime?: string;
  modifiedTime?: string;
  /** Article author display name (for og:article:author). */
  articleAuthor?: string;
  /** Article tags (for og:article:tag). */
  articleTags?: string[];
}

export function SeoHead({
  title,
  description,
  path,
  noIndex,
  ogType = "website",
  image,
  jsonLd,
  twitterCreator,
  twitterSite,
  publishedTime,
  modifiedTime,
  articleAuthor,
  articleTags,
}: SeoHeadProps) {
  const canonical = siteUrl(path);
  const shownTitle = fullTitle(title);
  const jsonLdArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{shownTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph */}
      <meta property="og:title" content={shownTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content={SITE_NAME} />
      {image && <meta property="og:image" content={image} />}
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {articleAuthor && <meta property="article:author" content={articleAuthor} />}
      {(articleTags ?? []).map((t) => (
        <meta key={t} property="article:tag" content={t} />
      ))}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={shownTitle} />
      <meta name="twitter:description" content={description} />
      {twitterSite && <meta name="twitter:site" content={`@${twitterSite.replace(/^@/, "")}`} />}
      {image && <meta name="twitter:image" content={image} />}
      {twitterCreator && <meta name="twitter:creator" content={`@${twitterCreator.replace(/^@/, "")}`} />}

      {jsonLdArray.map((obj, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(obj)}</script>
      ))}
    </Helmet>
  );
}
