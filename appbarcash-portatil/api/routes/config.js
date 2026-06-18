import express from 'express';
import { getSmtpConfig, saveSmtpConfig, testSmtpConnection } from '../controllers/ConfigController.js';

const router = express.Router();

router.get('/smtp', getSmtpConfig);
router.post('/smtp', saveSmtpConfig);
router.post('/smtp/test', testSmtpConnection);

export default router;
