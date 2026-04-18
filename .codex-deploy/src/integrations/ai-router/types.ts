export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResponse {
  content: string;
  model: string;
  tokensUsed?: number | undefined;
}

export interface LlmAdapter {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  complete(request: LlmRequest): Promise<LlmResponse>;
}

export type ComplexityLevel = "trivial" | "simple" | "moderate" | "complex" | "critical";

export interface ComplexityScore {
  level: ComplexityLevel;
  score: number; // 0.0 → 1.0
  reasons: string[];
}

export type ModelTarget =
  | "ollama:llama3.2:latest"
  | "ollama:deepseek-r1:7b"
  | "ollama:deepseek-coder:6.7b"
  | "deepseek:deepseek-chat"
  | "claude:claude-sonnet-4-6";

export interface RoutingDecision {
  target: ModelTarget;
  adapter: LlmAdapter;
  complexity: ComplexityScore;
  fallback?: ModelTarget;
}
