-- =============================================================================
-- MIGRATION 13: Stage plot
--
-- Adds a nullable JSONB column on `bands` to hold the whole stage-plot
-- document (icons + input list). No new RLS: existing bands policies
-- cover it — admins write via the saveStagePlot Server Action, public
-- read via the EPK. Zod validates the blob at the Server Action boundary.
-- =============================================================================

ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS stage_plot JSONB;

COMMENT ON COLUMN public.bands.stage_plot IS
  'Stage plot document (icons + input list). Shape defined by Zod schema in types/stage-plot.ts. Null = never created.';
