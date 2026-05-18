import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT ?? 4000),
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
  vectorStoreIds: (process.env.VECTOR_STORE_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  jwtSecret: process.env.JWT_SECRET ?? '',
  maxFileMb: Number(process.env.MAX_FILE_MB ?? 20),
  allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES ?? '').split(',').map((s) => s.trim()).filter(Boolean),
};
