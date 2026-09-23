-- buildgallery — builds.created_via, how a build arrived (EX-P14)
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