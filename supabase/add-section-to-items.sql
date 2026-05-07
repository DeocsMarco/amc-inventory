-- Add section_id to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES section_lots(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_items_section ON items(section_id);

-- Grant permissions
GRANT ALL ON section_lots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON section_lots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON section_lots TO authenticated;
