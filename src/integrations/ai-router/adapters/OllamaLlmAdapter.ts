import type { LlmAdapter, LlmRequest, LlmResponse } from "../types";

interface OllamaChatResponse {
  message: { content: string };
  model: string;
  eval_count?: number;
}

export class OllamaLlmAdapter implements LlmAdapter {
  readonly name: string;

  constructor(
    private readonly baseUrl: string,
    private readonly model: string
  ) {
    this.name = `ollama:${model}`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return false;
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      return (data.models ?? []).some((m) => m.name === this.model);
    } catch {
      return false;
    }
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.3,
          num_predict: request.maxTokens ?? 512
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as OllamaChatResponse;

    return {
      content: data.message.content.trim(),
      model: this.name,
      tokensUsed: data.eval_count
    };
  }
}
