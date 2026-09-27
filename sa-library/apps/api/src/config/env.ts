import 'dotenv/config';
import { z } from 'zod';

export const env = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
    CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
    COLLECTION_WINDOW_DAYS: z.coerce.number().int().min(1).max(30).default(3),
    LOAN_PERIOD_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  })
  .parse(process.env);
