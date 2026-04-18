import type { GtdBucket } from "../gtd/types";

export type InboxSource = "telegram" | "api" | "email" | "whatsapp" | "manual";
export type InboxStatus = "captured" | "processed" | "archived" | "deleted";

export interface InboxItem {
  id: string;
  source: InboxSource;
  userId: string | null;
  externalRef: string | null;
  content: string;
  status: InboxStatus;
  gtdBucket: GtdBucket | null;
  classificationReason: string | null;
  projectId: string | null;
  taskId: string | null;
  createdAt: Date;
  processedAt: Date | null;
  deletedAt: Date | null;
}
