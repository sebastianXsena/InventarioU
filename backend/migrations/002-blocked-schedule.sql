-- Add weekly blocked schedule to laboratories (class times)
ALTER TABLE laboratories
  ADD COLUMN IF NOT EXISTS blocked_schedule JSONB NOT NULL DEFAULT '[]'::jsonb;
