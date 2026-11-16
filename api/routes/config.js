import express from 'express';
import {
  getSmtpConfig,
  saveSmtpConfig,
  testSmtpConnection,
  getCardapioIpConfig,
  saveCardapioIpConfig,
  getCardapioTunnelStatus,
  startCardapioTunnel,
  stopCardapioTunnel,
  getFiscalReformaConfig,
  saveFiscalReformaConfig,
} from '../controllers/ConfigController.js';

const router = express.Router();

router.get('/smtp', getSmtpConfig);
router.post('/smtp', saveSmtpConfig);
router.post('/smtp/test', testSmtpConnection);

router.get('/cardapio-ip', getCardapioIpConfig);
router.post('/cardapio-ip', saveCardapioIpConfig);

router.get('/tunnel/status', getCardapioTunnelStatus);
router.post('/tunnel/start', startCardapioTunnel);
router.post('/tunnel/stop', stopCardapioTunnel);

router.get('/fiscal-reforma', getFiscalReformaConfig);
router.post('/fiscal-reforma', saveFiscalReformaConfig);

export default router;
