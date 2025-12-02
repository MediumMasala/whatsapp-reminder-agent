import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1),

  // Railway uses REDIS_URL, local uses REDIS_HOST/PORT
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().transform(Number).optional(),
  REDIS_PASSWORD: z.string().optional(),

  WHATSAPP_API_URL: z.string().url(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(1),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_WEBHOOK_SECRET: z.string().min(1),

  DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
  REMINDER_CHECK_INTERVAL_MS: z.string().transform(Number).default('30000'),
  MAX_CONVERSATION_HISTORY: z.string().transform(Number).default('100'),

  ADMIN_TOKEN: z.string().optional().default('admin_test_token_2025'),

  OPENAI_API_KEY: z.string().min(1),
});

function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map(e => e.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missing}`);
    }
    throw error;
  }
}

export const env = validateEnv();
export type Env = z.infer<typeof envSchema>;
