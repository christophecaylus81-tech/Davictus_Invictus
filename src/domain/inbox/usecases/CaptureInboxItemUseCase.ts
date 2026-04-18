import type { CreateInboxItemInput, InboxRepository } from "../repositories";
import type { InboxItem } from "../types";

export interface CaptureInboxInput {
  source: CreateInboxItemInput["source"];
  content: string;
  userId?: string | null;
  externalRef?: string | null;
}

export class CaptureInboxItemUseCase {
  constructor(private readonly inboxRepository: InboxRepository) {}

  async execute(input: CaptureInboxInput): Promise<InboxItem> {
    const content = input.content.trim();
    if (!content) {
      throw new Error("Le contenu de l'inbox ne peut pas être vide.");
    }

    return this.inboxRepository.create({
      source: input.source,
      userId: input.userId ?? null,
      externalRef: input.externalRef ?? null,
      content
    });
  }
}
