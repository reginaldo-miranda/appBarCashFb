import express from 'express';
import { emitirNfce, getDetails, generatePdf, sendPdfEmail } from '../controllers/NfceController.js';
import { listXmlFolders, exportXmls } from '../controllers/ExportController.js';

const router = express.Router();

router.post('/emitir', emitirNfce);
router.get('/xml-folders', listXmlFolders);
router.post('/export-xmls', exportXmls);

router.get('/:saleId/pdf', generatePdf);
router.post('/:saleId/send-email', sendPdfEmail);
router.get('/:saleId', getDetails);

export default router;
