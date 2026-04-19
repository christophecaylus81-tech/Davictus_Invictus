import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function withEmptyStringFallback<T extends z.ZodTypeAny>(schema: T): z.ZodEffects<T, z.output<T>, unknown> {
  return z.preprocess(emptyStringToUndefined, schema);
}

const rawEnvSchema = z.object({
  NODE_ENV: withEmptyStringFallback(
    z.enum(["development", "test", "production"]).default("development")
  ),
  MASTER_KEY: withEmptyStringFallback(z.string().min(32).optional()),
  HOST: withEmptyStringFallback(z.string().default("0.0.0.0")),
  PORT: withEmptyStringFallback(
    z.coerce.number().int().min(1).max(65535).default(3001)
  ),
  DATABASE_URL: z.string().min(1, "DATABASE_URL est obligatoire"),
  TELEGRAM_BOT_TOKEN: withEmptyStringFallback(z.string().optional()),
  TELEGRAM_ALLOWED_CHAT_IDS: withEmptyStringFallback(z.string().optional()),
  TELEGRAM_AUTO_PROCESS: withEmptyStringFallback(
    z.enum(["true", "false"]).default("true")
  ),
  N8N_WEBHOOK_URL: withEmptyStringFallback(z.string().optional()),
  OLLAMA_BASE_URL: withEmptyStringFallback(
    z.string().url().default("http://localhost:11434")
  ),
  OPENAI_API_KEY: withEmptyStringFallback(z.string().optional()),
  OPENAI_BASE_URL: withEmptyStringFallback(
    z.string().url().default("https://api.openai.com/v1")
  ),
  OPENAI_TRANSCRIBE_MODEL: withEmptyStringFallback(
    z.string().default("whisper-1")
  ),
  DEEPSEEK_API_KEY: withEmptyStringFallback(z.string().optional()),
  DEEPSEEK_BASE_URL: withEmptyStringFallback(
    z.string().url().default("https://api.deepseek.com/v1")
  ),
  ANTHROPIC_API_KEY: withEmptyStringFallback(z.string().optional()),
  QWEN_API_KEY: withEmptyStringFallback(z.string().optional()),
  QWEN_BASE_URL: withEmptyStringFallback(
    z.string().url().default("https://dashscope.aliyuncs.com/compatible-mode/v1")
  ),
  QWEN_MODEL: withEmptyStringFallback(z.string().default("qwen-plus")),
  DEV_AGENT_WORKER_TOKEN: withEmptyStringFallback(z.string().optional()),
  DEV_AGENT_SERVER_URL: withEmptyStringFallback(
    z.string().url().default("http://localhost:3001")
  ),
  DEV_AGENT_PROVIDER: withEmptyStringFallback(
    z.enum(["codex", "claude"]).default("codex")
  ),
  DEV_AGENT_WORKER_ID: withEmptyStringFallback(
    z.string().default("davitus-local-worker")
  ),
  DEV_AGENT_REPO_PATH: withEmptyStringFallback(z.string().optional()),
  DEV_AGENT_POLL_INTERVAL_MS: withEmptyStringFallback(
    z.coerce.number().int().min(1000).max(60000).default(5000)
  )
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
  host: parsed.HOST,
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
    anthropicApiKey: normalizeOptional(parsed.ANTHROPIC_API_KEY),
    qwenApiKey: normalizeOptional(parsed.QWEN_API_KEY),
    qwenBaseUrl: parsed.QWEN_BASE_URL,
    qwenModel: parsed.QWEN_MODEL
  },
  devAgent: {
    workerToken: normalizeOptional(parsed.DEV_AGENT_WORKER_TOKEN),
    serverUrl: parsed.DEV_AGENT_SERVER_URL,
    provider: parsed.DEV_AGENT_PROVIDER,
    workerId: parsed.DEV_AGENT_WORKER_ID,
    repoPath: normalizeOptional(parsed.DEV_AGENT_REPO_PATH),
    pollIntervalMs: parsed.DEV_AGENT_POLL_INTERVAL_MS
  }
} as const;
