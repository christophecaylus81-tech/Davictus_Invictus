import type { LlmAdapter, LlmRequest, LlmResponse } from "../types";

// Google Gemini via endpoint compatible OpenAI
// https://ai.google.dev/gemini-api/docs/openai
interface OpenAiChatResponse {
  choices: Array<{ message: { content: string } }>;
  model: string;
  usage?: { total_tokens: number };
}

export class GeminiAdapter implements LlmAdapter {
  readonly name: string;
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

  constructor(
    private readonly apiKey: string,
    private readonly model = "gemini-2.0-flash"
  ) {
    this.name = `gemini:${model}`;
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
      throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
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
