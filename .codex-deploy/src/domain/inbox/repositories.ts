import type { GtdBucket, GtdClassification } from "../gtd/types";
import type { InboxItem, InboxSource } from "./types";

export interface CreateInboxItemInput {
  source: InboxSource;
  userId?: string | null;
  externalRef?: string | null;
  content: string;
}

export interface InboxRepository {
  create(input: CreateInboxItemInput): Promise<InboxItem>;
  findById(id: string): Promise<InboxItem | null>;
  listRecent(limit: number): Promise<InboxItem[]>;
}

export interface InboxProcessingResult {
  inboxItem: InboxItem;
  bucket: GtdBucket;
  projectId: string | null;
  taskId: string | null;
}

export interface InboxProcessingGateway {
  processClassification(input: {
    item: InboxItem;
    classification: GtdClassification;
  }): Promise<InboxProcessingResult>;
}
