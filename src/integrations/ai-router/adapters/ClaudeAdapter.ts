import type { LlmAdapter, LlmRequest, LlmResponse } from "../types";

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export class ClaudeAdapter implements LlmAdapter {
  readonly name = "claude:claude-sonnet-4-6";

  private readonly model: string;

  constructor(
    private readonly apiKey: string,
    model = "claude-sonnet-4-6"
  ) {
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    // Anthropic API separates system from user messages
    const systemMsg = request.messages.find((m) => m.role === "system");
    const userMessages: AnthropicMessage[] = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0.3,
      messages: userMessages
    };

    if (systemMsg) {
      body.system = systemMsg.content;
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error(`Claude error ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    const content = data.content.find((c) => c.type === "text")?.text ?? "";
    const usage = data.usage;

    return {
      content: content.trim(),
      model: this.name,
      tokensUsed: usage ? usage.input_tokens + usage.output_tokens : undefined
    };
  }
}
