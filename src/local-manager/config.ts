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

const localManagerSchema = z.object({
  OLLAMA_BASE_URL: withEmptyStringFallback(
    z.string().url().default("http://localhost:11434")
  ),
  OPENAI_API_KEY: withEmptyStringFallback(z.string().optional()),
  OPENAI_BASE_URL: withEmptyStringFallback(
    z.string().url().default("https://api.openai.com/v1")
  ),
  OPENAI_MANAGER_MODEL: withEmptyStringFallback(
    z.string().default("gpt-4o-mini")
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
  GEMINI_API_KEY: withEmptyStringFallback(z.string().optional()),
  GEMINI_FLASH_MODEL: withEmptyStringFallback(
    z.string().default("gemini-2.0-flash")
  ),
  DAITIVUS_MANAGER_PROVIDER: withEmptyStringFallback(
    z.enum(["ollama", "deepseek", "qwen", "openai", "gemini", "claude"]).optional()
  ),
  DAITIVUS_OLLAMA_MANAGER_MODEL: withEmptyStringFallback(
    z.string().default("llama3.2:latest")
  ),
  DAITIVUS_OLLAMA_EXECUTOR_MODEL: withEmptyStringFallback(
    z.string().default("deepseek-r1:7b")
  ),
  DAITIVUS_CODEX_OUTPUT_DIR: withEmptyStringFallback(
    z.string().default("workspace/local-manager/codex")
  )
});

const parsed = localManagerSchema.parse(process.env);

function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const localManagerConfig = {
  managerProvider: parsed.DAITIVUS_MANAGER_PROVIDER,
  codexOutputDir: parsed.DAITIVUS_CODEX_OUTPUT_DIR,
  ollama: {
    baseUrl: parsed.OLLAMA_BASE_URL,
    managerModel: parsed.DAITIVUS_OLLAMA_MANAGER_MODEL,
    executorModel: parsed.DAITIVUS_OLLAMA_EXECUTOR_MODEL
  },
  openai: {
    apiKey: normalizeOptional(parsed.OPENAI_API_KEY),
    baseUrl: parsed.OPENAI_BASE_URL,
    managerModel: parsed.OPENAI_MANAGER_MODEL
  },
  deepseek: {
    apiKey: normalizeOptional(parsed.DEEPSEEK_API_KEY),
    baseUrl: parsed.DEEPSEEK_BASE_URL
  },
  claude: {
    apiKey: normalizeOptional(parsed.ANTHROPIC_API_KEY)
  },
  qwen: {
    apiKey: normalizeOptional(parsed.QWEN_API_KEY),
    baseUrl: parsed.QWEN_BASE_URL,
    model: parsed.QWEN_MODEL
  },
  gemini: {
    apiKey: normalizeOptional(parsed.GEMINI_API_KEY),
    flashModel: parsed.GEMINI_FLASH_MODEL
  }
} as const;

export type LocalManagerConfig = typeof localManagerConfig;
