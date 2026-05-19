import OpenAI from 'openai';
import { env } from '../config/env';

export const openai = env.openaiApiKey && !env.openaiApiKey.includes('your-openai-api-key')
  ? new OpenAI({ apiKey: env.openaiApiKey })
  : null;
