-- Mark whether a note was created as a task (from the "Make this a task" flow
-- in the Notes tab of ProjectDetailPanel). When set, the app renders a "Task"
-- pill on the note and also creates a matching row in public.tasks.
ALTER TABLE public.project_notes_log
  ADD COLUMN IF NOT EXISTS is_task boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.project_notes_log.is_task IS
  'True when this note was posted with "Make this a task", which also creates a matching row in public.tasks.';

-- Backfill: flag existing notes whose text matches a task in the same project.
UPDATE public.project_notes_log n
  SET is_task = true
  FROM public.tasks t
  WHERE t.project_id = n.project_id
    AND t.name = n.content
    AND n.is_task = false;
