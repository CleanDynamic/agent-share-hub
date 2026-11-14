/* The About page, on the site's own pieces: the shared page header, the reading column (the page grid's columns 4 to 9), the
   seven type sizes and the tone tokens. The words are the page's own, unchanged. */

import type { CSSProperties, ReactNode } from "react";

import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/brand/Button";
import { PageHeader } from "@/components/shell/PageHeader";
import { ReadingColumn } from "@/components/shell/ReadingColumn";
import { SITE_NAME } from "@/lib/site";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, measure } from "@/lib/theme/type";

const prose: CSSProperties = { ...measure, margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text2 };
const heading: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 14, fontWeight: 500, lineHeight: 1.3, color: t.text };
const link: CSSProperties = { color: t.text, textDecoration: "underline", textUnderlineOffset: 3, textDecorationThickness: 1 };

/** A section under a hairline: its heading, then what it holds. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ borderTop: `1px solid ${t.hairline}`, paddingTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={heading}>{title}</h2>
      {children}
    </section>
  );
}

const About = () => {
  return (
    <>
      <SeoHead
        title="About"
        description="The community hub for AI builders and curious humans. Free to browse. Every item reviewed before it goes live."
        path="/about"
      />
      <PageHeader title={`About ${SITE_NAME}`} />
      <ReadingColumn>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={prose}>
            {SITE_NAME} is the community hub for people who want to use AI — not just talk about it.
            Like Football Manager tactics forums, we let experts share the AI setups they have already
            built so that anyone — technical or not — can download and use them immediately.
          </p>
          <p style={prose}>
            Everything on the platform is AI-agnostic. Whether you use ChatGPT, Gemini, Claude,
            Grok, or something else entirely, the content here is built to work with your tools.
            Every item is reviewed before it goes live. No junk, no untested prompts.
          </p>
          <p style={prose}>
            The platform is free to browse and download. Creators who invest time building
            high-quality content have five ways to earn from it: donations, subscriptions, direct
            sales, personalised commissions, and a share of ad revenue as the platform grows.
          </p>
        </div>

        <Section title="Get in Touch">
          <ul style={{ ...prose, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>
              Twitter:{" "}
              <a href="https://twitter.com/neoscaleai" target="_blank" rel="noopener noreferrer" style={link}>
                @neoscaleai
              </a>
            </li>
            <li>
              Email: <span style={{ color: t.text }}>hello@neoscale.ai</span>
            </li>
          </ul>
        </Section>

        <Section title="For Creators">
          <p style={prose}>
            Want to share your work and earn from it? The Upload page is open
            to everyone. We review every submission before it goes live. Quality over quantity, always.
          </p>
          <div>
            <Button variant="primary" size={32} href="/upload">
              Upload Your Work
            </Button>
          </div>
        </Section>
      </ReadingColumn>
    </>
  );
};

export default About;
