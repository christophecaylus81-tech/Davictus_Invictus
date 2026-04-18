import type { GtdClassification } from "../../domain/gtd/types";
import { ComplexityEvaluator } from "./ComplexityEvaluator";
import type { LlmAdapter, LlmRequest, LlmResponse, RoutingDecision } from "./types";

export interface AiRouterConfig {
  // Local Ollama adapters
  ollamaLight: LlmAdapter;   // llama3.2:latest  — trivial tasks
  ollamaReason: LlmAdapter;  // deepseek-r1:7b   — classification, reasoning
  ollamaCoder: LlmAdapter;   // deepseek-coder:6.7b — code tasks

  // Cloud adapters (optional — degrade gracefully if not configured)
  deepseek?: LlmAdapter | undefined;
  claude?: LlmAdapter | undefined;
}

export class AiRouter {
  private readonly evaluator = new ComplexityEvaluator();

  constructor(private readonly config: AiRouterConfig) {}

  async route(content: string, classification?: GtdClassification): Promise<RoutingDecision> {
    const complexity = this.evaluator.evaluate(content, classification);
    const isCode = this.evaluator.isCodeTask(content);

    // Code tasks → deepseek-coder regardless of complexity
    if (isCode) {
      return {
        target: "ollama:deepseek-coder:6.7b",
        adapter: this.config.ollamaCoder,
        complexity,
        fallback: "ollama:deepseek-r1:7b"
      };
    }

    switch (complexity.level) {
      case "trivial":
        return {
          target: "ollama:llama3.2:latest",
          adapter: this.config.ollamaLight,
          complexity,
          fallback: "ollama:deepseek-r1:7b"
        };

      case "simple":
        return {
          target: "ollama:deepseek-r1:7b",
          adapter: this.config.ollamaReason,
          complexity
        };

      case "moderate": {
        const ds = this.config.deepseek;
        if (ds && (await ds.isAvailable())) {
          return {
            target: "deepseek:deepseek-chat",
            adapter: ds,
            complexity,
            fallback: "ollama:deepseek-r1:7b"
          };
        }
        return {
          target: "ollama:deepseek-r1:7b",
          adapter: this.config.ollamaReason,
          complexity
        };
      }

      case "complex":
      case "critical": {
        const claude = this.config.claude;
        if (claude && (await claude.isAvailable())) {
          return {
            target: "claude:claude-sonnet-4-6",
            adapter: claude,
            complexity,
            fallback: "deepseek:deepseek-chat"
          };
        }
        const ds = this.config.deepseek;
        if (ds && (await ds.isAvailable())) {
          return {
            target: "deepseek:deepseek-chat",
            adapter: ds,
            complexity,
            fallback: "ollama:deepseek-r1:7b"
          };
        }
        return {
          target: "ollama:deepseek-r1:7b",
          adapter: this.config.ollamaReason,
          complexity
        };
      }
    }
  }

  async complete(content: string, request: LlmRequest, classification?: GtdClassification): Promise<LlmResponse & { routing: RoutingDecision }> {
    const decision = await this.route(content, classification);

    try {
      const response = await decision.adapter.complete(request);
      return { ...response, routing: decision };
    } catch (err) {
      // Fallback si le modèle principal échoue
      if (decision.fallback) {
        const fallbackAdapter = this.resolveAdapter(decision.fallback);
        if (fallbackAdapter) {
          const response = await fallbackAdapter.complete(request);
          return { ...response, routing: decision };
        }
      }
      throw err;
    }
  }

  private resolveAdapter(target: string): LlmAdapter | undefined {
    if (target === "ollama:llama3.2:latest") return this.config.ollamaLight;
    if (target === "ollama:deepseek-r1:7b") return this.config.ollamaReason;
    if (target === "ollama:deepseek-coder:6.7b") return this.config.ollamaCoder;
    if (target === "deepseek:deepseek-chat") return this.config.deepseek;
    if (target === "claude:claude-sonnet-4-6") return this.config.claude;
    return undefined;
  }
}
