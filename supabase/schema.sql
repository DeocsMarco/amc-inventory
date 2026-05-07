-- AMC Inventory Management System - Supabase Schema
-- Run this in your Supabase SQL Editor

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id),
  name TEXT NOT NULL,
  qty_per_unit REAL DEFAULT 1,
  unit TEXT DEFAULT 'PC',
  initial_soh REAL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table (daily IN/OUT)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
  quantity REAL NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_item_date ON transactions(item_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

-- Monthly snapshots for historical data
CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  opening_soh REAL,
  closing_soh REAL,
  total_in REAL,
  total_out REAL,
  UNIQUE(item_id, year, month)
);

-- Section/Lot configuration
CREATE TABLE IF NOT EXISTS section_lots (
  id SERIAL PRIMARY KEY,
  section_name TEXT NOT NULL,
  lot_number INTEGER NOT NULL,
  units_per_lot INTEGER DEFAULT 30
);

-- Seed default categories
INSERT INTO categories (name, sort_order) VALUES
  ('METAL COMPONENTS', 0),
  ('TRIM PARTS', 1),
  ('DOOR COMPONENTS / PLASTICS', 2),
  ('ELECTRICAL', 3),
  ('STICKERS / EMBLEM', 4),
  ('HARDWARES', 5),
  ('SHOP SUPPLIES', 6),
  ('PALBOND PB-N144R', 7),
  ('ACCELARATOR AC-131', 8),
  ('FINE CLEANER 4349', 9),
  ('WELDING CONSUMABLE', 10),
  ('HAND TAPS', 11),
  ('DISCS / BLADES', 12),
  ('MISCELLANEOUS', 13)
ON CONFLICT (name) DO NOTHING;

-- Seed section lots
INSERT INTO section_lots (section_name, lot_number) VALUES
  ('TRIM', 849),
  ('METAL', 852),
  ('DECKING', 848),
  ('PDI', 846)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (optional, for production)
-- ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
