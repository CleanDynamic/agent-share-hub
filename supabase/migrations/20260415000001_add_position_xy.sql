-- Add free-form pixel position columns to content_blocks
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS position_x INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS position_y INTEGER DEFAULT NULL;
