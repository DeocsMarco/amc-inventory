-- SOH Adjustments table - for manual stock corrections
CREATE TABLE IF NOT EXISTS soh_adjustments (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  previous_soh REAL NOT NULL,
  new_soh REAL NOT NULL,
  adjustment REAL GENERATED ALWAYS AS (new_soh - previous_soh) STORED,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_soh_adjustments_item_date ON soh_adjustments(item_id, date);

-- Grant permissions
GRANT ALL ON soh_adjustments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON soh_adjustments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON soh_adjustments TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE soh_adjustments_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE soh_adjustments_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE soh_adjustments_id_seq TO service_role;
