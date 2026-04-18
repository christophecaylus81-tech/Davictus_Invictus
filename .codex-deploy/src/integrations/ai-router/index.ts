import { env } from "../../config/env";
import { AiRouter } from "./AiRouter";
import { ClaudeAdapter } from "./adapters/ClaudeAdapter";
import { DeepSeekAdapter } from "./adapters/DeepSeekAdapter";
import { OllamaLlmAdapter } from "./adapters/OllamaLlmAdapter";

export { AiRouter } from "./AiRouter";
export { ComplexityEvaluator } from "./ComplexityEvaluator";
export type {
  ComplexityLevel,
  ComplexityScore,
  LlmAdapter,
  LlmRequest,
  LlmResponse,
  ModelTarget,
  RoutingDecision
} from "./types";

/**
 * Crée une instance AiRouter câblée sur les adapters configurés via env.
 * Les adapters cloud (DeepSeek, Claude) sont optionnels :
 * si les clés API sont absentes, le routeur dégrade proprement vers Ollama local.
 */
export function createAiRouter(): AiRouter {
  const ollamaBase = env.integrations.ollamaBaseUrl;

  const config = {
    ollamaLight: new OllamaLlmAdapter(ollamaBase, "llama3.2:latest"),
    ollamaReason: new OllamaLlmAdapter(ollamaBase, "deepseek-r1:7b"),
    ollamaCoder: new OllamaLlmAdapter(ollamaBase, "deepseek-coder:6.7b"),
    ...(env.integrations.deepseekApiKey
      ? {
          deepseek: new DeepSeekAdapter(
            env.integrations.deepseekApiKey,
            env.integrations.deepseekBaseUrl
          )
        }
      : {}),
    ...(env.integrations.anthropicApiKey
      ? { claude: new ClaudeAdapter(env.integrations.anthropicApiKey) }
      : {})
  };

  return new AiRouter(config);
}
