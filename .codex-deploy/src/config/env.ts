import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL est obligatoire"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ALLOWED_CHAT_IDS: z.string().optional(),
  TELEGRAM_AUTO_PROCESS: z.enum(["true", "false"]).default("true"),
  N8N_WEBHOOK_URL: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("gpt-4o-mini-transcribe"),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com/v1"),
  ANTHROPIC_API_KEY: z.string().optional()
});

const parsed = rawEnvSchema.parse(process.env);

function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseChatIds(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set<string>();
  }

  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
  );
}

export const env = {
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  databaseUrl: parsed.DATABASE_URL,
  telegram: {
    token: normalizeOptional(parsed.TELEGRAM_BOT_TOKEN),
    allowedChatIds: parseChatIds(parsed.TELEGRAM_ALLOWED_CHAT_IDS),
    autoProcess: parsed.TELEGRAM_AUTO_PROCESS === "true"
  },
  integrations: {
    n8nWebhookUrl: normalizeOptional(parsed.N8N_WEBHOOK_URL),
    ollamaBaseUrl: parsed.OLLAMA_BASE_URL,
    openaiApiKey: normalizeOptional(parsed.OPENAI_API_KEY),
    openaiBaseUrl: parsed.OPENAI_BASE_URL,
    openaiTranscribeModel: parsed.OPENAI_TRANSCRIBE_MODEL,
    deepseekApiKey: normalizeOptional(parsed.DEEPSEEK_API_KEY),
    deepseekBaseUrl: parsed.DEEPSEEK_BASE_URL,
    anthropicApiKey: normalizeOptional(parsed.ANTHROPIC_API_KEY)
  }
} as const;
