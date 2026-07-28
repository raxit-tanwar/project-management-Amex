-- Personal monthly hours target, shown on the Reports > Goals tab against actual logged
-- hours. Null = use the app default (160h, matching the existing 8h/day assumption already
-- used elsewhere in the app, e.g. OverviewClient's daily-efficiency calculation).
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS monthly_target_hours integer;

COMMENT ON COLUMN public.user_settings.monthly_target_hours IS
  'Personal monthly hours target shown on the Reports > Goals tab. Null = use the app default (160h, matching the existing 8h/day assumption used elsewhere).';
