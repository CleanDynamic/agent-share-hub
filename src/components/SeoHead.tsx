import { Helmet } from "react-helmet-async";

const SITE_URL = import.meta.env.VITE_SITE_URL || "https://neoscaleai.com";

interface SeoHeadProps {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  ogType?: string;
  jsonLd?: Record<string, any>;
}

export function SeoHead({ title, description, path, noIndex, ogType = "website", jsonLd }: SeoHeadProps) {
  const canonical = `${SITE_URL}${path}`;

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

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
