import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { getDb } from './database';
import { seedDatabase } from './database/seed';

// Import routes
import categoryRoutes from './modules/category/category.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import transactionRoutes from './modules/transaction/transaction.routes';
import reportRoutes from './modules/report/report.routes';
import importRoutes from './modules/import/import.routes';
import exportRoutes from './modules/export/export.routes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
getDb();
seedDatabase();

// Routes
app.use('/api/categories', categoryRoutes);
app.use('/api/items', inventoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
