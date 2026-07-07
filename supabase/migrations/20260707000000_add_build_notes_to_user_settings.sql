-- Rich-text "Build Notes" panel: important points to reference before/during a build.
-- Edited from Settings, rendered read-only on the Overview page. Stores Tiptap's HTML
-- output (schema-controlled — bold/italic/lists only, no arbitrary markup).
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS build_notes text;

COMMENT ON COLUMN public.user_settings.build_notes IS
  'Rich-text HTML (from the Settings > Build Notes editor) shown read-only on the Overview page.';
