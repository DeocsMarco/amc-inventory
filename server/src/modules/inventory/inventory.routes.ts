import { Router } from 'express';
import { inventoryController } from './inventory.controller';

const router = Router();

router.get('/', (req, res) => inventoryController.getAll(req, res));
router.get('/:id', (req, res) => inventoryController.getById(req, res));
router.post('/', (req, res) => inventoryController.create(req, res));
router.put('/:id', (req, res) => inventoryController.update(req, res));
router.delete('/:id', (req, res) => inventoryController.delete(req, res));

export default router;
