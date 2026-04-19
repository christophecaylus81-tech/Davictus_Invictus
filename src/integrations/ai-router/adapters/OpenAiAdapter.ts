import type { LlmAdapter, LlmRequest, LlmResponse } from "../types";

interface OpenAiChatResponse {
  choices: Array<{ message: { content: string } }>;
  model: string;
  usage?: { total_tokens: number };
}

export class OpenAiAdapter implements LlmAdapter {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly model = "gpt-4o",
    private readonly baseUrl = "https://api.openai.com/v1"
  ) {
    this.name = `openai:${model}`;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.3
      })
    });

    if (!res.ok) {
      throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as OpenAiChatResponse;
    const content = data.choices[0]?.message.content ?? "";

    return {
      content: content.trim(),
      model: this.name,
      tokensUsed: data.usage?.total_tokens
    };
  }
}
