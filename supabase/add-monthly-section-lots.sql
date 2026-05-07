-- Monthly Section Lot Numbers
-- Tracks lot numbers for each section per month

CREATE TABLE IF NOT EXISTS monthly_section_lots (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES section_lots(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  lot_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(section_id, year, month)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_monthly_section_lots_lookup
ON monthly_section_lots(section_id, year, month);
