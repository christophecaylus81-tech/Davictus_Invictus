import type { Task, TaskStatus } from "./types";

export interface TaskListFilters {
  limit?: number;
  projectId?: string;
}

export interface CreateTaskData {
  title: string;
  projectId?: string;
  notes?: string;
  status?: TaskStatus;
  priority?: number;
}

export interface TaskRepository {
  list(filters?: TaskListFilters): Promise<Task[]>;
  listActive(): Promise<Task[]>;
  create(data: CreateTaskData): Promise<Task>;
  updateStatus(id: string, status: TaskStatus): Promise<Task>;
  updateProject(id: string, projectId: string | null): Promise<Task>;
  delete(id: string): Promise<void>;
}
