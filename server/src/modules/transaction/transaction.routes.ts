import { Router } from 'express';
import { transactionController } from './transaction.controller';

const router = Router();

router.get('/', (req, res) => transactionController.getAll(req, res));
router.get('/daily/:date', (req, res) => transactionController.getDaily(req, res));
router.get('/:id', (req, res) => transactionController.getById(req, res));
router.post('/', (req, res) => transactionController.create(req, res));
router.put('/upsert', (req, res) => transactionController.upsert(req, res));
router.post('/bulk', (req, res) => transactionController.bulkCreate(req, res));
router.delete('/:id', (req, res) => transactionController.delete(req, res));

export default router;
