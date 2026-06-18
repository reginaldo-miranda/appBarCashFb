import express from 'express';
import { listDirectories } from '../controllers/SystemController.js';

const router = express.Router();

router.get('/directories', listDirectories);

export default router;
