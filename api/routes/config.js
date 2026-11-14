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

export default router;
