import { Helmet } from "react-helmet-async";

const SITE_URL = import.meta.env.VITE_SITE_URL || "https://neoscaleai.com";
const SITE_NAME = "NeoScale";

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
  publishedTime,
  modifiedTime,
  articleAuthor,
  articleTags,
}: SeoHeadProps) {
  const canonical = `${SITE_URL}${path}`;
  const jsonLdArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
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
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:site" content="@neoscaleai" />
      {image && <meta name="twitter:image" content={image} />}
      {twitterCreator && <meta name="twitter:creator" content={`@${twitterCreator.replace(/^@/, "")}`} />}

      {jsonLdArray.map((obj, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(obj)}</script>
      ))}
    </Helmet>
  );
}
