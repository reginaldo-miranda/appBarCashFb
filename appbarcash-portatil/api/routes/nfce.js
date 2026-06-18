import express from 'express';
import { emitirNfce, getDetails, generatePdf, sendPdfEmail } from '../controllers/NfceController.js';
import { listXmlFolders, exportXmls } from '../controllers/ExportController.js';
import {
  ativarContingencia,
  desativarContingencia,
  listarContingencias,
  emitirNfceContingencia,
  retentarContingencia,
  inutilizarContingencia
} from '../controllers/NfceController.js';

const router = express.Router();

// ── Rotas normais (existentes — não alterar) ──
router.post('/emitir', emitirNfce);
router.get('/xml-folders', listXmlFolders);
router.post('/export-xmls', exportXmls);
router.get('/:saleId/pdf', generatePdf);
router.post('/:saleId/send-email', sendPdfEmail);
router.get('/:saleId', getDetails);

// ── Rotas de Contingência Offline (novas) ──
router.post('/contingencia/ativar', ativarContingencia);
router.post('/contingencia/desativar', desativarContingencia);
router.get('/contingencia/lista', listarContingencias);
router.post('/contingencia/emitir', emitirNfceContingencia);
router.post('/contingencia/:nfceId/retentar', retentarContingencia);
router.post('/contingencia/:nfceId/inutilizar', inutilizarContingencia);

export default router;
