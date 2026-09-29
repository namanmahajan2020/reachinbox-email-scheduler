import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname,resolve } from 'node:path';
import { z } from 'zod';
dotenv.config({path:resolve(dirname(fileURLToPath(import.meta.url)),'../../../../.env')});
const schema = z.object({ DATABASE_URL:z.string().url(), REDIS_URL:z.string().url(), ELASTICSEARCH_URL:z.string().url().default('http://localhost:9200'), PORT:z.coerce.number().default(4000), FRONTEND_URL:z.string().url().default('http://localhost:5173'), SESSION_SECRET:z.string().min(24), GOOGLE_CLIENT_ID:z.string().optional(), GOOGLE_CLIENT_SECRET:z.string().optional(), GOOGLE_CALLBACK_URL:z.string().url().optional(), SLACK_CLIENT_ID:z.string().optional(), SLACK_CLIENT_SECRET:z.string().optional(), SLACK_CALLBACK_URL:z.string().url().optional(), SLACK_TOKEN_ENCRYPTION_KEY:z.string().length(32).refine(value=>Buffer.byteLength(value,'utf8')===32,'Must be 32 UTF-8 bytes').optional(), SMTP_HOST:z.string().default('smtp.ethereal.email'), SMTP_PORT:z.coerce.number().default(587), SMTP_SECURE:z.string().default('false'), ETHEREAL_USER:z.string().optional(), ETHEREAL_PASS:z.string().optional(), WORKER_CONCURRENCY:z.coerce.number().int().positive().default(5), MIN_EMAIL_DELAY_MS:z.coerce.number().int().nonnegative().default(1000), DEFAULT_HOURLY_LIMIT:z.coerce.number().int().positive().default(100), COOKIE_SECURE:z.string().default('false') });
export const env=schema.parse(process.env);

