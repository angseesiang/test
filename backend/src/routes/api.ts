import express from 'express';
import multer from 'multer';
import { validateFile } from '../utils/fileValidation';
import { env } from '../config/env';
import { searchAllVectorStores } from '../services/vectorSearch';
import { chunkText } from '../utils/chunking';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/auth/login', async (req, res) => {
  return res.json({ ok: true, token: 'jwt-placeholder' });
});

router.post('/files/upload', upload.array('files'), async (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  files.forEach(validateFile);
  return res.json({ ok: true, count: files.length });
});

router.post('/analyze', async (req, res) => {
  const { prompt } = req.body as { prompt: string };
  const chunks = chunkText(prompt);
  const out = [] as unknown[];
  for (const chunk of chunks) {
    const matches = await searchAllVectorStores(chunk, env.vectorStoreIds, 3);
    out.push({ chunk, matches: matches.length ? matches : [{ message: 'No reliable match found.' }] });
  }
  return res.json({ ok: true, rows: out });
});

router.get('/results/:analysisId', async (_req, res) => res.json({ ok: true, rows: [] }));
router.get('/reports/:analysisId', async (_req, res) => res.json({ ok: true, url: '/tmp/report.csv' }));
router.get('/audit-logs', async (_req, res) => res.json({ ok: true, logs: [] }));

export default router;
