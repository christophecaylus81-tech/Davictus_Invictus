export interface CreateProcessingLogInput {
  inboxItemId: string;
  stage: string;
  message: string;
}

export interface ProcessingLogRecord {
  id: number;
  inboxItemId: string;
  stage: string;
  message: string;
  createdAt: Date;
}

export interface ProcessingLogRepository {
  append(input: CreateProcessingLogInput): Promise<void>;
  listByInboxItem(inboxItemId: string, limit: number): Promise<ProcessingLogRecord[]>;
}
