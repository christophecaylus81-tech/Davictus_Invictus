import { describe, expect, it } from "vitest";
import type {
  CreateInboxItemInput,
  InboxProcessingGateway,
  InboxProcessingResult,
  InboxRepository
} from "../src/domain/inbox/repositories";
import type { InboxItem, InboxStatus } from "../src/domain/inbox/types";
import type { GtdClassification } from "../src/domain/gtd/types";
import type {
  CreateProcessingLogInput,
  ProcessingLogRecord,
  ProcessingLogRepository
} from "../src/domain/logs/repositories";
import { ProcessInboxItemUseCase } from "../src/domain/inbox/usecases/ProcessInboxItemUseCase";
import { CaptureInboxItemUseCase } from "../src/domain/inbox/usecases/CaptureInboxItemUseCase";

class InMemoryInboxRepository implements InboxRepository {
  private items = new Map<string, InboxItem>();
  private seq = 0;

  async create(input: CreateInboxItemInput): Promise<InboxItem> {
    this.seq += 1;
    const item: InboxItem = {
      id: `inbox-${this.seq}`,
      source: input.source,
      userId: input.userId ?? null,
      externalRef: input.externalRef ?? null,
      content: input.content,
      status: "captured",
      gtdBucket: null,
      classificationReason: null,
      projectId: null,
      taskId: null,
      createdAt: new Date(),
      processedAt: null,
      deletedAt: null
    };
    this.items.set(item.id, item);
    return item;
  }

  async findById(id: string): Promise<InboxItem | null> {
    return this.items.get(id) ?? null;
  }

  async listRecent(_limit: number): Promise<InboxItem[]> {
    return [...this.items.values()];
  }
}

class InMemoryProcessingGateway implements InboxProcessingGateway {
  private taskSeq = 0;
  private projectSeq = 0;

  async processClassification(input: {
    item: InboxItem;
    classification: GtdClassification;
  }): Promise<InboxProcessingResult> {
    let status: InboxStatus;
    let projectId: string | null = null;
    let taskId: string | null = null;

    switch (input.classification.bucket) {
      case "task":
        this.taskSeq += 1;
        taskId = `task-${this.taskSeq}`;
        status = "processed";
        break;
      case "project":
        this.projectSeq += 1;
        this.taskSeq += 1;
        projectId = `project-${this.projectSeq}`;
        taskId = `task-${this.taskSeq}`;
        status = "processed";
        break;
      case "incubator":
      case "archive":
        status = "archived";
        break;
      case "trash":
        status = "deleted";
        break;
    }

    const updatedItem: InboxItem = {
      ...input.item,
      status,
      gtdBucket: input.classification.bucket,
      classificationReason: input.classification.reason,
      projectId,
      taskId,
      processedAt: new Date(),
      deletedAt: input.classification.bucket === "trash" ? new Date() : null
    };

    return {
      inboxItem: updatedItem,
      bucket: input.classification.bucket,
      projectId,
      taskId
    };
  }
}

class InMemoryProcessingLogRepository implements ProcessingLogRepository {
  private logs: ProcessingLogRecord[] = [];

  async append(input: CreateProcessingLogInput): Promise<void> {
    this.logs.push({
      id: this.logs.length + 1,
      inboxItemId: input.inboxItemId,
      stage: input.stage,
      message: input.message,
      createdAt: new Date()
    });
  }

  async listByInboxItem(inboxItemId: string, limit: number): Promise<ProcessingLogRecord[]> {
    return this.logs.filter((log) => log.inboxItemId === inboxItemId).slice(0, limit);
  }
}

describe("ProcessInboxItemUseCase", () => {
  it("transforme un item actionnable en tâche", async () => {
    const inboxRepository = new InMemoryInboxRepository();
    const processingGateway = new InMemoryProcessingGateway();
    const logs = new InMemoryProcessingLogRepository();
    const capture = new CaptureInboxItemUseCase(inboxRepository);
    const process = new ProcessInboxItemUseCase({
      inboxRepository,
      processingGateway,
      processingLogRepository: logs
    });

    const inboxItem = await capture.execute({
      source: "manual",
      content: "Appeler le comptable pour valider la TVA"
    });

    const result = await process.execute(inboxItem.id);
    const logList = await logs.listByInboxItem(inboxItem.id, 10);

    expect(result.classification.bucket).toBe("task");
    expect(result.taskId).toMatch(/^task-/);
    expect(result.inboxItem.status).toBe("processed");
    expect(logList).toHaveLength(2);
  });

  it("transforme une idée en incubateur", async () => {
    const inboxRepository = new InMemoryInboxRepository();
    const processingGateway = new InMemoryProcessingGateway();
    const logs = new InMemoryProcessingLogRepository();
    const capture = new CaptureInboxItemUseCase(inboxRepository);
    const process = new ProcessInboxItemUseCase({
      inboxRepository,
      processingGateway,
      processingLogRepository: logs
    });

    const inboxItem = await capture.execute({
      source: "manual",
      content: "Idée: lancer un format newsletter premium plus tard"
    });

    const result = await process.execute(inboxItem.id);

    expect(result.classification.bucket).toBe("incubator");
    expect(result.projectId).toBeNull();
    expect(result.taskId).toBeNull();
    expect(result.inboxItem.status).toBe("archived");
  });

  it("retombe sur la classification heuristique si l'enrichissement IA échoue", async () => {
    const inboxRepository = new InMemoryInboxRepository();
    const processingGateway = new InMemoryProcessingGateway();
    const logs = new InMemoryProcessingLogRepository();
    const capture = new CaptureInboxItemUseCase(inboxRepository);
    const process = new ProcessInboxItemUseCase({
      inboxRepository,
      processingGateway,
      processingLogRepository: logs,
      aiRouter: {
        complete: async () => {
          throw new Error("fetch failed");
        }
      } as never
    });

    const inboxItem = await capture.execute({
      source: "manual",
      content: "/start"
    });

    const result = await process.execute(inboxItem.id);
    const logList = await logs.listByInboxItem(inboxItem.id, 10);

    expect(result.classification.bucket).toBe("task");
    expect(result.classification.aiEnriched).not.toBe(true);
    expect(result.taskId).toMatch(/^task-/);
    expect(logList.some((log) => log.message.includes("fallback heuristique"))).toBe(true);
  });
});
