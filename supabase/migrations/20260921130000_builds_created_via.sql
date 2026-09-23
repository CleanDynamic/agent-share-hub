-- =============================================================================
-- buildgallery — builds.created_via, how a build arrived (EX-P14)
-- =============================================================================
-- One nullable JSONB column on public.builds recording the ROUTE a build
-- arrived by, so its page can say a true sentence about its own origin: a
-- conversation was extracted by a connector, and a person reviewed it before
-- any of it was written.
--
-- WHAT THIS COLUMN IS NOT. It is not a signal, not a score, not a filter and
-- not a gate. Nothing in src/lib/build/signals.ts or src/lib/build/gallery.ts
-- reads it, completeness does not count it, and the gallery neither ranks nor
-- admits on it. It is a label, and a label that changed a build's standing
-- would be a reason for a creator to game how their work arrived rather than
-- what it is.
--
-- NULLABLE, WITH NO DEFAULT, DELIBERATELY. Every build that exists today
-- arrived some other way and there is nothing true to say about most of them,
-- so NULL means "nothing recorded" and reads as no line on the page at all. A
-- default would make that sentence up for every row in the table, and a
-- backfill would make it up for the past. Neither is a fact this column is
-- entitled to invent.
--
-- ADD COLUMN with no default and no NOT NULL is a catalogue-only change in
-- Postgres 11 and later: no table rewrite, no full-table lock held for the
-- length of one, so this applies in constant time whatever builds now holds.
--
-- NO POLICY CHANGES, AND NONE ARE NEEDED. The four policies EX-P00-era
-- migration 20260825112817 wrote on public.builds are column-agnostic and
-- already correct for this one:
--
--   SELECT  status <> 'draft' OR creator_id = (select auth.uid())
--                             OR public.is_admin((select auth.uid()))
--   UPDATE  creator_id = (select auth.uid())
--                             OR public.is_admin((select auth.uid()))
--
-- So a visitor reads created_via on a published build because the row is
-- readable, and a creator writes it on their own draft because the row is
-- writable. Every auth.uid() in both is already the wrapped (select auth.uid())
-- form the contract requires; this migration adds no policy and therefore adds
-- no call of either form.
--
-- NO INDEX. Nothing queries this column — it is read by id, on one build, on
-- that build's own page, in a row already being fetched. A GIN index on a JSONB
-- column nothing filters on is write cost bought with no read saved.
--
-- WHO WRITES IT. The browser, through the data layer (src/lib/build/
-- provenance.ts), with the creator's own session, at the moment they confirm an
-- import. NOT the mcp edge function: contract prohibition 1 is that the
-- connector parks a proposal and never writes to builds, and prohibition 2 is
-- that the function holds no service-role key with which it could.
--
-- THE SHAPE. Three cases, written by claimImport:
--
--   a new build                { "source": "connector",
--                                "client": "claude-code",
--                                "reader_id": "claude",
--                                "imports": ["<import uuid>"] }
--
--   an existing draft that     { "source": "mixed",
--   had nothing recorded         "imports": ["<import uuid>"] }
--
--   an existing draft that     the stored object, unchanged except that this
--   already had something      import's id is appended to "imports"
--
-- "mixed" is the honest word for the third case's starting point: the creator
-- had already begun that draft by some other route, and a connector import
-- joined it. Claiming "connector" there would overstate what the connector did.
--
-- TEXT INSIDE AN IMPORTED CONVERSATION NEVER REACHES THIS COLUMN. Every value
-- here is an id, a client name from a fixed list of six, or a reader id from
-- the registry. Nothing read out of a creator's conversation is stored in it,
-- and nothing that reads it treats what it finds as an instruction.
-- =============================================================================

ALTER TABLE public.builds
  ADD COLUMN created_via JSONB NULL;

COMMENT ON COLUMN public.builds.created_via IS
  'How this build arrived, as a label only. {source: "connector"|"mixed", '
  'client?, reader_id?, imports: [import_session_id]}. NULL means nothing was '
  'recorded, which is every build made before EX-P14 and every build made by '
  'hand. Written by the browser through src/lib/build/provenance.ts with the '
  'creator''s own session, never by the mcp edge function. Read by the build '
  'page and by nothing else: it is not a signal, does not count toward '
  'completeness, and neither ranks nor gates the gallery.';
