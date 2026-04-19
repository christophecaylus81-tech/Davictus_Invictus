import type { LlmAdapter, LlmRequest, LlmResponse } from "../types";

interface OpenAiChatResponse {
  choices: Array<{ message: { content: string } }>;
  model: string;
  usage?: { total_tokens: number };
}

export class QwenAdapter implements LlmAdapter {
  readonly name = "qwen:qwen-plus";

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly visionModel: string;

  constructor(
    private readonly apiKey: string,
    baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model = "qwen-plus",
    visionModel = "qwen-vl-plus"
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.visionModel = visionModel;
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
      throw new Error(`Qwen error ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as OpenAiChatResponse;
    const content = data.choices[0]?.message.content ?? "";

    return {
      content: content.trim(),
      model: this.name,
      tokensUsed: data.usage?.total_tokens
    };
  }

  // Vision : image en base64 + prompt texte → Qwen-VL
  async analyzeImage(imageBase64: string, mimeType: string, prompt: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.visionModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: "text", text: prompt || "Analyse cette image et décris ce que tu vois." }
            ]
          }
        ],
        max_tokens: 1024,
      })
    });

    if (!res.ok) {
      throw new Error(`Qwen vision error ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as OpenAiChatResponse;
    return (data.choices[0]?.message.content ?? "").trim();
  }
}
