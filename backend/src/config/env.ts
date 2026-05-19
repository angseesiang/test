import 'dotenv/config';

function splitCsv(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  openaiApiKey: (process.env.OPENAI_API_KEY ?? '').replace(/^"|"$/g, ''),
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
  vectorStoreIds: splitCsv(process.env.VECTOR_STORE_IDS),
  jwtSecret: process.env.JWT_SECRET ?? 'local-development-secret-change-me',
  maxFileMb: Number(process.env.MAX_FILE_MB ?? 25),
  maxFilesPerAssessment: Number(process.env.MAX_FILES_PER_ASSESSMENT ?? 20),
  maxPointsPerAssessment: Number(process.env.MAX_POINTS_PER_ASSESSMENT ?? 250),
  minPossibleScore: Number(process.env.MIN_POSSIBLE_SCORE ?? 0.7)
};
