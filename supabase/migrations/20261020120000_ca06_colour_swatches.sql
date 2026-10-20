-- =============================================================================
-- buildgallery — a maker's recent and favourite colours (CA-06 P6)
-- =============================================================================
-- The colour picker keeps up to 8 recent colours and up to 24 favourites. They
-- belong to the maker, not to a build, so they live on the maker's own profile
-- row and follow them across builds and devices.
--
-- One column, with a default, so every existing row reads as "none yet" and no
-- row is rewritten by hand. The check holds the shape: an object with two
-- arrays, at most 8 and 24 entries, each a string "#RRGGBB" in upper case.
--
-- NO POLICY CHANGES. "Users can update own profile" (FOR UPDATE USING
-- auth.uid() = id) already lets a signed-in maker write their own row, and only
-- theirs; the client writes this column through that policy.
--
-- Safe to run twice: the column is added only if missing, and the check only if
-- no constraint of its name exists.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS colour_swatches jsonb NOT NULL DEFAULT '{"recent":[],"favourites":[]}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_colour_swatches_shape'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      -- coalesce: a missing key makes the test NULL, which a CHECK would let through.
      ADD CONSTRAINT profiles_colour_swatches_shape CHECK (coalesce(
        jsonb_typeof(colour_swatches) = 'object'
        AND jsonb_typeof(colour_swatches -> 'recent') = 'array'
        AND jsonb_typeof(colour_swatches -> 'favourites') = 'array'
        AND jsonb_array_length(colour_swatches -> 'recent') <= 8
        AND jsonb_array_length(colour_swatches -> 'favourites') <= 24
        AND NOT jsonb_path_exists(colour_swatches, '$.recent[*] ? (@.type() != "string" || !(@ like_regex "^#[0-9A-F]{6}$"))')
        AND NOT jsonb_path_exists(colour_swatches, '$.favourites[*] ? (@.type() != "string" || !(@ like_regex "^#[0-9A-F]{6}$"))'),
        false
      ));
  END IF;
END
$$;

COMMENT ON COLUMN public.profiles.colour_swatches IS
  'CA-06: the maker''s colour picker swatches, {"recent": [...up to 8], "favourites": [...up to 24]}, each "#RRGGBB".';
