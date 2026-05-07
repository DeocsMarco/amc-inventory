import { Router } from 'express';
import { reportController } from './report.controller';

const router = Router();

router.get('/dashboard', (req, res) => reportController.getDashboard(req, res));
router.get('/soh', (req, res) => reportController.getSoh(req, res));
router.get('/daily/:date', (req, res) => reportController.getDailySummary(req, res));
router.get('/categories', (req, res) => reportController.getCategorySummary(req, res));
router.get('/monthly/:year/:month', (req, res) => reportController.getMonthlyReport(req, res));

export default router;
