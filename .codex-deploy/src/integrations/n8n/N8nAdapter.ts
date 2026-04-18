import type { ProcessInboxItemResult } from "../../domain/inbox/usecases/ProcessInboxItemUseCase";

export interface ProcessingEventNotifier {
  notifyInboxProcessed(event: ProcessInboxItemResult): Promise<void>;
}

export class N8nWebhookNotifier implements ProcessingEventNotifier {
  constructor(private readonly webhookUrl?: string) {}

  async notifyInboxProcessed(event: ProcessInboxItemResult): Promise<void> {
    if (!this.webhookUrl) {
      return;
    }

    await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(event)
    });
  }
}
