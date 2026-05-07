import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../../config';
import { importController } from './import.controller';

// Ensure uploads directory exists
if (!fs.existsSync(config.uploadsDir)) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `import-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      cb(new Error('Only Excel files are allowed'));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

const router = Router();

router.post('/xlsx', upload.single('file'), (req, res) => importController.importXlsx(req, res));

export default router;
