import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import authRoutes from './routes/auth';
import assessmentRoutes from './routes/assessments';
import userRoutes from './routes/users';

const app = express();

app.use(cors({ origin: env.frontendOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'NIST AI RMF Advisor API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/users', userRoutes);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ ok: false, message: `File too large. Maximum file size is ${env.maxFileMb} MB.` });
  }

  return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Unexpected server error.' });
});

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
