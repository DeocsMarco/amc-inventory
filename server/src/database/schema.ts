import Database from 'better-sqlite3';

export function createSchema(db: Database.Database): void {
  db.exec(`
    -- Categories table
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Items table
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id),
      name TEXT NOT NULL,
      qty_per_unit REAL DEFAULT 1,
      unit TEXT DEFAULT 'PC',
      initial_soh REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Transactions table (daily IN/OUT)
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER REFERENCES items(id),
      date DATE NOT NULL,
      type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
      quantity REAL NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Index for faster transaction queries
    CREATE INDEX IF NOT EXISTS idx_transactions_item_date
      ON transactions(item_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_date
      ON transactions(date);

    -- Monthly snapshots for historical data
    CREATE TABLE IF NOT EXISTS monthly_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER REFERENCES items(id),
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_name TEXT NOT NULL UNIQUE,
      lot_number INTEGER NOT NULL,
      units_per_lot INTEGER DEFAULT 30
    );

    -- Monthly section lot overrides
    CREATE TABLE IF NOT EXISTS monthly_section_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL REFERENCES section_lots(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
      lot_number INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(section_id, year, month)
    );

    -- SOH adjustments history
    CREATE TABLE IF NOT EXISTS soh_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id),
      date DATE NOT NULL,
      previous_soh REAL NOT NULL,
      new_soh REAL NOT NULL,
      adjustment REAL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Index for monthly section lots
    CREATE INDEX IF NOT EXISTS idx_monthly_section_lots_lookup
      ON monthly_section_lots(section_id, year, month);
  `);
}
