-- Build Notes become per-build-type categories (General Information, Website, Mobile App).
-- Convert user_settings.build_notes from a single HTML string into a JSONB object keyed by
-- category id; any existing single-field note moves under the "general" key.
-- Guarded on the current column type so this is safe to re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_settings'
      AND column_name = 'build_notes' AND data_type = 'text'
  ) THEN
    ALTER TABLE public.user_settings ALTER COLUMN build_notes DROP DEFAULT;
    ALTER TABLE public.user_settings
      ALTER COLUMN build_notes TYPE jsonb
      USING CASE
        WHEN build_notes IS NULL OR btrim(build_notes) = '' THEN '{}'::jsonb
        ELSE jsonb_build_object('general', build_notes)
      END;
    ALTER TABLE public.user_settings ALTER COLUMN build_notes SET DEFAULT '{}'::jsonb;
    UPDATE public.user_settings SET build_notes = '{}'::jsonb WHERE build_notes IS NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.user_settings.build_notes IS
  'Per-category Build Notes as JSONB: { "general": html, "website": html, "mobile": html }. Edited in Settings > Build Notes, shown read-only on Overview.';
