import path from 'path';

export const config = {
  port: process.env.PORT || 3001,
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/inventory.db'),
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads'),
  unitsPerLot: 30,
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
};
