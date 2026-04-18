export type GtdBucket = "task" | "project" | "incubator" | "archive" | "trash";

export interface GtdClassification {
  bucket: GtdBucket;
  reason: string;
  confidence: number;
  suggestedTitle: string;
  suggestedTaskTitle?: string | undefined;
  aiEnriched?: boolean | undefined;
}
