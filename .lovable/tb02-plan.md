# TB-02 completion plan

- Preserve the existing Main and side template and reuse PageHeader, Panel, CardHead, SideSection, pageColumns, trackRow, mainStyle, asideStyle, FrameLink, SeoHead, LegalPage, Inline and LegalPlaceholder.
- The three texts, routes, review gate and browser spec already exist. Keep their wording, placeholders and flags unchanged.
- Correct footer tests for the approved TB-01 logo and link order; use the existing radius token for Inline placeholders and zero tracking for the new side headings.
- Strengthen browser network isolation, hash navigation checks and viewport-only screenshot capture. Refresh twelve screenshots and record current verification.
- Files: LegalView.tsx, FooterPageView.tsx, legalLinks.test.tsx, footer-pages.spec.ts, design/HANDOFF.md, design/audits/tb-02/, roadmap.md and AGENTS.md.
- Constraints: requested skills unavailable; branch switching prohibited in this workspace. Preserve Panel's existing section wrapper workaround. Existing PageHeader 13.5px and SideSection 28px remain unchanged. Geist Serif handles supersede the prompt's former font names. Per-page type sets necessarily differ because Contact has no list and Rules has no placeholders.
- Do not run builds or typechecks manually; preview harness owns them. Run focused tests, browser checks and theme/contrast audits; report wider-suite failures without unrelated edits.