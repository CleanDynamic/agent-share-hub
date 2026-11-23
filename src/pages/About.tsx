/* The About page. Synth 15 Part C: one panel at 680, the type of the legal pages: the h1 at 31/36, the text at 15/20 in Text 2,
   each section's h2 at 17/600 with no box and no line. The words are the page's own, with the em dashes taken out. */

import type { CSSProperties, ReactNode } from "react";

import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/brand/Button";
import { ReadingPanel } from "@/components/shell/ReadingPanel";
import { SITE_NAME } from "@/lib/site";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, hero, textStep } from "@/lib/theme/type";
import { SECTION_HEADING } from "@/pages/site/legal/legalStyles";

const prose: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: textStep.body, lineHeight: "20px", color: t.text2 };
const link: CSSProperties = { color: t.text, textDecoration: "underline", textDecorationColor: t.label, textUnderlineOffset: 3, textDecorationThickness: 1 };

/** A section with no box: its heading, then what it holds. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={SECTION_HEADING}>{title}</h2>
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
      <ReadingPanel data-testid="about-page">
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <h1 style={{ ...hero, margin: 0, color: t.text }}>{`About ${SITE_NAME}`}</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={prose}>
              {SITE_NAME} is the community hub for people who want to use AI, not just talk about it.
              Like Football Manager tactics forums, we let experts share the AI setups they have already
              built so that anyone, technical or not, can download and use them immediately.
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

          <Section title="Get in touch">
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

          <Section title="For creators">
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
        </div>
      </ReadingPanel>
    </>
  );
};

export default About;
