import { Router } from 'express';
import { exportController } from './export.controller';

const router = Router();

router.get('/xlsx', (req, res) => exportController.exportXlsx(req, res));

export default router;
