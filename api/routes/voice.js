import express from 'express';
import { parseVoiceCommand, executeVoiceCommand } from '../controllers/VoiceController.js';

const router = express.Router();

router.post('/parse', parseVoiceCommand);
router.post('/execute', executeVoiceCommand);

export default router;
