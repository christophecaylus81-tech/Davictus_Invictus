export interface OllamaClient {
  isAvailable(): Promise<boolean>;
}

export class HttpOllamaClient implements OllamaClient {
  constructor(private readonly baseUrl: string) {}

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { method: "GET" });
      return response.ok;
    } catch {
      return false;
    }
  }
}
