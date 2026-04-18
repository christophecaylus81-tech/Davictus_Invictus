export type TaskStatus = "todo" | "next" | "in_progress" | "done" | "cancelled";

export interface Task {
  id: string;
  projectId: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: number;
  dueDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}
