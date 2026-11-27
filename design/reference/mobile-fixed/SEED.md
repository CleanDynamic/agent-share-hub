# Seed content for Everyone

Mobile 29g. Eight builds for the owner to publish from real harness sessions, so a new visitor's first screen of Everyone shows what OpenBuilds is for: someone asked an AI for a real thing, here is the thing, and here are the steps to make it again. The reference stills in this folder (`01-home.jpg`, `06-refreshed.jpg`, `07-builds.jpg`, `09-build-pushed.jpg`) draw several of them.

Nothing here is written to the database. Each build is made the normal way: run the session in a harness, import it (the Import tab, or the connector), shape it in the editor, publish.

## What every one of them needs

These are what Everyone now requires (`20261127140000_m29g_everyone_shows_real_builds.sql`), so a build that misses one will not appear:

- **A title the maker typed.** Not "Untitled build". Say what it is in plain words, as the examples below do.
- **At least one published step.** Import the session and keep its steps; open the editor once so the step count is written.
- **A maker who is not a test account.** Publish from a real account, not one marked `is_test_account`.

And what makes them read well on a phone:

- **The cover is the finished thing, never the editor.** A screenshot of the page, poster or app the session made, taken in a browser at phone or desktop width with no browser chrome and no OpenBuilds window in it. Put it in the post as its first picture: that is the cover. A build with no picture shows its title on a Card, which is fine but says less.
- **The post is one or two plain sentences** about what was made and for whom. No title on the post (the build line names it), no em dashes, no exclamation marks.
- **Steps are verbs.** "Plan the page sections", "Write the hero and menu copy". Five to fifteen of them.
- **Two to four sessions** where the work really took that many. A rebuild says in its first post what it changed.

## The eight

### 1. Bakery homepage

- **Cover:** the finished homepage at desktop width: a warm hero photo, the bakery's name, a sticky header, a menu grid of six items with prices.
- **Post:** "Homepage copy for a neighbourhood bakery, turned into one page with a sticky header and a menu grid." A second post with the page at phone width, the menu as a list.
- **Steps (about 12, 3 sessions):** plan the sections; write the hero and menu copy; build the header; lay out the menu grid; make it work on phones; add opening hours and the map link; check contrast; deploy.
- **Then:** a second account rebuilds it as **Bakery homepage with pick-up times** (2 sessions, 7 steps): "Same bakery page, with a pick-up time on the basket and the menu as a list on phones."

### 2. Gig poster for Friday

- **Cover:** the poster itself, portrait: band name large, date and venue, ticket price, a QR code to the ticket link.
- **Post:** "A gig poster for Friday's show, with a version sized for Instagram stories."
- **Steps (about 5, 2 sessions):** set the facts; try three type layouts; pick one and refine; export print and story sizes; add the QR code.

### 3. Café menu with ordering

- **Cover:** the menu page on a phone, an item open with its options (size, milk) and an Add button.
- **Post:** "A café's menu that takes orders: pick a drink, choose the milk, pay at the counter."
- **Steps (about 15, 4 sessions):** model the menu as data; render the list; item options; the basket; the order summary; the counter view for staff; mark an order ready; test on a phone.

### 4. A florist's order page

- **Cover:** the order form beside a bouquet photo: size, flowers, a card message, delivery date.
- **Post:** "An order page for a small florist: choose the bouquet, write the card, pick the day."
- **Steps (about 7, 2 sessions):** list the bouquets; the form; the card message with a character count; delivery dates that skip Sundays; the confirmation email text.

### 5. Recipe card maker

- **Cover:** a printed-looking recipe card: title, a photo, ingredients in one column, numbered steps in the other.
- **Post:** "A recipe card maker: paste a recipe, get a printable card with the steps numbered."
- **Steps (about 6, 2 sessions):** parse a pasted recipe into ingredients and steps; the card layout; print styles; a second card size; fix fractions.

### 6. Invoice generator

- **Cover:** a finished invoice: the sender's details, line items with quantities and totals, VAT, the payment details.
- **Post:** "An invoice generator for freelancers: fill in the jobs, get a PDF with the totals worked out."
- **Steps (about 8, 2 sessions):** the fields; line items that add up; VAT on or off; numbering invoices; the PDF; saving the sender's details for next time.

### 7. Long-form blog layout

- **Cover:** an article page with a large serif headline, a lead paragraph, a pull quote and a figure with a caption.
- **Post:** "A reading layout for long articles: a good measure, footnotes in the margin, figures that fit a phone."
- **Steps (about 9, 3 sessions):** pick the type scale; set the measure; headings and lists; footnotes as side notes on wide screens; figures and captions; the phone layout; dark mode.

### 8. Portfolio in one page

- **Cover:** a one-page portfolio: a name, one line about the person, four project tiles, a contact link.
- **Post:** "A one-page portfolio for an illustrator: four projects, one line each, and a way to get in touch."
- **Steps (about 4, 1 session):** the sections; the project tiles; the contact link; the phone layout.

## Order to publish

Publish them a few hours apart, oldest first in this list, so Everyone's first screen opens on a mix (a page, a poster, an app) rather than on eight of one kind. Publish the bakery rebuild after the bakery, so the "Rebuilt from" card has something to point at.
