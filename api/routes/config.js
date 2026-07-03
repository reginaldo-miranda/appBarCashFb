import express from 'express';
import { getSmtpConfig, saveSmtpConfig, testSmtpConnection, getCardapioIpConfig, saveCardapioIpConfig } from '../controllers/ConfigController.js';

const router = express.Router();

router.get('/smtp', getSmtpConfig);
router.post('/smtp', saveSmtpConfig);
router.post('/smtp/test', testSmtpConnection);

router.get('/cardapio-ip', getCardapioIpConfig);
router.post('/cardapio-ip', saveCardapioIpConfig);

export default router;
