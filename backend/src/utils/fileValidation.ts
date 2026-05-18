import { env } from '../config/env';

export function validateFile(file: Express.Multer.File) {
  if (!env.allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(`Unsupported file type: ${file.mimetype}`);
  }
  if (file.size > env.maxFileMb * 1024 * 1024) {
    throw new Error(`File too large: ${file.originalname}`);
  }
}
