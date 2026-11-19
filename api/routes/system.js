import express from 'express';
import { listDirectories, resetMovements, downloadBackup } from '../controllers/SystemController.js';

const router = express.Router();

router.get('/directories', listDirectories);
router.post('/reset-movements', resetMovements);
router.get('/download-backup/:filename', downloadBackup);

export default router;
