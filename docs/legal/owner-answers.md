# Owner answers for the legal pages

Fill in each **Answer** line and return this file. A short second session pastes the answers into
`src/content/legal/privacy.ts` and `terms.ts`, removes the `{{NEED: …}}` markers, and runs the tests. The
reviewed flags in `src/content/legal/reviewed.ts` stay false until your reviewer has signed off.

Line numbers are as of the commit that added this file. If a line has moved, search for the quoted marker.

Facts already filled from the providers' own pages are marked "for reviewer sign-off" in the code, with the
source address and the date it was read beside each one. They are listed at the end of this file.

---

## 1. About the business

### 1.1 Who runs the site
- **Question:** What is the full legal name of the business or person that runs OpenBuilds.ai?
- **Why:** The privacy policy has to name the controller of your data, and the terms have to name who you are
  agreeing with.
- **Example of a good answer:** "Example Ltd, a company registered in England and Wales, number 12345678."
  Or, for a sole trader: "Jane Smith, trading as OpenBuilds.ai."
- **Fills:** `privacy.ts:20` and `terms.ts:21`, `{{NEED: legal name of the business or person running the site}}`
- **Answer:**

### 1.2 ICO registration
- **Question:** Are you registered with the Information Commissioner's Office (you pay the data protection fee)?
  If so, what is the registration number? If you are exempt, say so and the line will be removed.
- **Why:** The privacy policy shows the number if there is one.
- **Example of a good answer:** "Yes: ZB123456." Or: "Not registered; remove the line."
- **Fills:** `privacy.ts:27`, `{{NEED: ICO registration number, or remove}}`
- **Answer:**

## 2. Contacts

### 2.1 Postal address
- **Question:** What postal address should appear on the legal pages?
- **Why:** UK data protection law and consumer law expect a way to reach you by post. A registered office or a
  service address is fine; it does not have to be a home address.
- **Example of a good answer:** "Example Ltd, 1 Example Street, Manchester M1 1AA, United Kingdom."
- **Fills:** `privacy.ts:25` and `terms.ts:21`, `{{NEED: postal address}}`
- **Answer:**

### 2.2 Privacy contact email
- **Question:** Which email address handles privacy requests, account closures and reports about under-age
  accounts?
- **Why:** It appears in five places: the contact list, Your rights, Children, closing an account, and the terms'
  contact line. One address for all of them is simplest.
- **Example of a good answer:** "privacy@openbuilds.ai (a shared inbox, checked every working day)."
- **Fills:** `privacy.ts:26`, `privacy.ts:279`, `privacy.ts:332`, `terms.ts:129`, `terms.ts:187`,
  `{{NEED: privacy contact email}}`
- **Answer:**

## 3. Minimum age

### 3.1 Minimum age for an account
- **Question:** Is the minimum age 13 or 18?
- **Why:** The privacy policy and the terms state it, and the sign-up tick will ask people to confirm it (G18).
  13 is the UK's age of digital consent. 18 avoids the Children's Code duties, but you would have to turn away
  younger people.
- **Example of a good answer:** "18."
- **Fills:** `privacy.ts:332` and `terms.ts:32`, `{{NEED: minimum age, 13 or 18}}`, and the constant
  `MINIMUM_AGE` (currently `null`) in the code
- **Answer:**

## 4. Retention periods

### 4.1 Messages
- **Question:** How long are direct messages kept after they are sent, if they are not deleted?
- **Why:** The privacy policy must say how long each kind of data is kept.
- **Example of a good answer:** "Until either person deletes the conversation, or 2 years after the last message,
  whichever comes first."
- **Fills:** `privacy.ts:244`, `{{NEED: retention period}}` in the Messages row
- **Answer:**

### 4.2 Reports
- **Question:** How long do you keep reports about content (who reported, what, why, and the outcome)?
- **Why:** As above. Reports hold personal data about two people.
- **Example of a good answer:** "12 months after the report is closed."
- **Fills:** `privacy.ts:246`, `{{NEED: retention period}}` in the Reports row
- **Answer:**

### 4.3 Notifications
- **Question:** How long are notifications kept?
- **Example of a good answer:** "90 days, then deleted automatically."
- **Fills:** `privacy.ts:247`, `{{NEED: retention period}}` in the Notifications row
- **Answer:**

### 4.4 Error reports (your Sentry plan)
- **Question:** Which Sentry plan is the project on?
- **Why:** Sentry keeps errors 30 days on its Developer (free) plan and 90 days on Team, Business and Enterprise
  (Sentry's data retention page, read 17 November 2026).
- **Example of a good answer:** "Team plan, so 90 days."
- **Fills:** `privacy.ts:251`, `{{NEED: Sentry retention period}}`
- **Answer:**

## 5. Your Supabase settings

### 5.1 Supabase region
- **Question:** Which region is the Supabase project in? (Supabase dashboard › Project Settings › General shows it.)
- **Why:** The privacy policy says where the database is. If it is in an EU or UK region, data in the database
  does not leave Europe.
- **Example of a good answer:** "eu-west-2 (London)."
- **Fills:** `privacy.ts:174`, `{{NEED: confirm the region of our Supabase project}}` (the row currently says "United States")
- **Answer:**

### 5.2 Backup retention
- **Question:** How long does the project keep backups? (Supabase dashboard › Database › Backups; it depends on
  the plan and on point-in-time recovery.)
- **Why:** Deleted data stays in backups until they roll over, and the policy says for how long.
- **Example of a good answer:** "7 days (Pro plan daily backups, no point-in-time recovery)."
- **Fills:** `privacy.ts:256`, `{{NEED: Supabase backup retention}}`
- **Answer:**

### 5.3 When expired imports are deleted
- **Question:** Imports from an AI tool that nobody reviews are marked expired after 7 days. Is anything set to
  delete them after that (a scheduled job in Supabase), and after how long?
- **Why:** The policy says they expire but not when they are removed. The repository schedules the expiry, not a deletion.
- **Example of a good answer:** "Deleted 30 days after they expire, by the nightly job." Or: "Nothing deletes them yet."
- **Fills:** `privacy.ts:245`, `{{NEED: when expired imports are deleted}}`
- **Answer:**

## 6. Appeal route

### 6.1 How someone challenges a moderation decision
- **Question:** How should someone appeal a decision to hide their content or close their account, and how
  quickly will you answer?
- **Why:** The terms promise a way to challenge decisions. The Online Safety Act expects a clear complaints route.
- **Example of a good answer:** "Email appeals@openbuilds.ai with the link and why you disagree. A person who did
  not make the first decision replies within 14 days."
- **Fills:** `terms.ts:119`, `{{NEED: appeal route and contact}}`
- **Answer:**

## 7. Liability wording (for your reviewer)

### 7.1 The liability paragraph
- **Question:** Has your reviewer approved the liability paragraph in Terms › Liability, or do they want changes?
- **Why:** It limits what you are responsible for. Only a qualified reviewer should settle this wording; this
  work did not write or change it.
- **Example of a good answer:** "Approved as written." Or the reviewer's replacement text.
- **Fills:** `terms.ts:157`, `{{NEED: confirm liability wording with a reviewer}}`
- **Answer:**

## 8. Services the research could not settle

### 8.1 The Lovable AI gateway's data terms
- **Question:** Which Lovable plan is the workspace on, and is "AI app context" on or off (Lovable › Settings ›
  Privacy and security)?
- **Why:** Lovable's own pages disagree on whether customer content can be used for training (its terms grant a
  licence with an opt-out; its privacy policy and data processing agreement say personal data is not used). Its
  retention depends on the plan: with AI app context on, it keeps each AI request for 90 days, and that setting
  is on by default on Free and Pro. If you no longer use the gateway, say so and the line will be removed.
- **Example of a good answer:** "Business plan, AI app context off, training opt-out set." Or: "We no longer use Lovable AI."
- **Fills:** `privacy.ts:153`, `{{NEED: Lovable AI gateway's training and retention terms for our plan}}`
- **Answer:**

### 8.2 OpenAI's transfer safeguard
- **Question:** Have you accepted OpenAI's data processing addendum? If so, which transfer mechanism does it name
  (standard contractual clauses with the UK Addendum, or the Data Privacy Framework)?
- **Why:** OpenAI's pages refused automated reading (HTTP 403), so this could not be checked. The addendum is in
  the OpenAI platform under Settings › Organization › Data controls.
- **Example of a good answer:** "Accepted; it uses the EU SCCs with the UK Addendum."
- **Fills:** `privacy.ts:223`, `{{NEED: OpenAI's transfer safeguard}}`
- **Answer:**

### 8.3 X's transfer safeguard
- **Question:** Which safeguard does X state for sign-in data leaving the UK? (See X's privacy policy.)
- **Why:** X's pages refused automated reading (HTTP 402).
- **Example of a good answer:** "X's privacy policy names standard contractual clauses."
- **Fills:** `privacy.ts:226`, `{{NEED: X's transfer safeguard}}`
- **Answer:**

### 8.4 Lovable's contracting entity
- **Question:** Which Lovable company is your contract with: Lovable Labs Sweden AB, or Lovable Labs Incorporated
  (Boston)? Its privacy policy names the first; its data processing agreement names the second as the importer.
- **Why:** The "Who we share it with" table says Lovable is in Sweden, and the transfer table needs the right
  safeguard. If the contract is with the US company, the row should say United States, and both its privacy policy
  and its DPA name the EU SCCs with the UK Addendum.
- **Example of a good answer:** "Lovable Labs Incorporated; use United States and SCCs with the UK Addendum."
- **Fills:** `privacy.ts:229`, `{{NEED: Lovable's contracting entity and transfer safeguard}}`, and the Lovable row
  of the sharing table
- **Answer:**

## 9. Other questions (no placeholder yet)

### 9.1 The legacy ad record
- **Question:** Older content pages (`src/components/ContentBlockViewer.tsx`) can show an ad to visitors. Each ad
  shown writes a row to the `ad_impressions` table, with the viewer's user id when they are signed in, and a
  session-storage key (listed as not strictly necessary). Is this still live? If it is, who serves the ads, and
  should the privacy policy describe `ad_impressions`? If not, can it be retired?
- **Why:** The privacy policy currently says nothing about ad impressions.
- **Example of a good answer:** "Not live; retire it." Or: "Live; we serve our own ads, keep impressions 90 days."
- **Answer:**

### 9.2 The About page's old handle and email
- **Question:** The About page still shows `@neoscaleai` and `hello@neoscale.ai` (`src/pages/About.tsx:61` and `:65`).
  What should they be?
- **Example of a good answer:** "@openbuildsai and hello@openbuilds.ai."
- **Answer:**

### 9.3 The browser cache (for your reviewer)
- **Question:** The site keeps a copy of pages a person has read in the browser's database for up to 24 hours,
  so pages open fast and work offline (`bg-kept-cache`). Does your reviewer agree it is strictly necessary, so
  needs no consent?
- **Why:** The storage table says every item except the ad key is strictly necessary or a chosen setting.
  A speed and offline cache is the one that could be argued either way.
- **Example of a good answer:** "Yes, strictly necessary." Or: "No; it needs consent."
- **Answer:**

### 9.4 The terms' own words (for your reviewer)
- **Question:** The terms still say "By using the site or creating an account, you agree…" and "please don't use
  the site" (`terms.ts:21`). The site now says "Sign up" for making an account and avoids "please" elsewhere. Should
  the terms match?
- **Why:** The legal text was out of scope for the wording sweep.
- **Example of a good answer:** "Yes: 'By using the site or signing up…' and 'don't use the site'."
- **Answer:**

---

## Filled for reviewer sign-off (no answer needed, but your reviewer should check)

| Fact | Where | Source (read 17 November 2026) |
|---|---|---|
| Anthropic does not train on API data; deletes within 30 days; flagged content up to 2 years | `privacy.ts`, AI processing | privacy.claude.com articles 7996868 and 7996866; anthropic.com/legal/commercial-terms |
| OpenAI does not train on API data; abuse-monitoring logs up to 30 days | `privacy.ts`, AI processing | developers.openai.com/api/docs/guides/your-data |
| Microlink is based in Spain (Microlink Labs, S.L., Murcia) | `privacy.ts`, sharing table | microlink.io/terms, microlink.io/dpa |
| Supabase: SCCs with the UK Addendum | `privacy.ts`, Data outside the UK | supabase.com/legal/dpa |
| Netlify: UK-US data bridge | as above | netlify.com/privacy (its DPA page was not found) |
| Cloudflare: UK-US data bridge, SCCs with UK Addendum as fallback | as above | cloudflare.com/cloudflare-customer-dpa |
| Anthropic: SCCs with the UK Addendum | as above | anthropic.com/legal/data-processing-addendum |
| GitHub: UK-US data bridge | as above | github.com/customer-terms/github-data-protection-agreement |
| Google: UK-US data bridge | as above | policies.google.com/privacy/frameworks |
| Sentry: UK-US data bridge | as above | sentry.io/legal/dpa, sentry.io/trust/privacy |
| Microlink: in the EU; SCCs with UK Addendum for its own onward transfers | as above | microlink.io/dpa |
