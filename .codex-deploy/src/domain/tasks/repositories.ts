import type { Task } from "./types";

export interface TaskListFilters {
  limit?: number;
  projectId?: string;
}

export interface TaskRepository {
  list(filters?: TaskListFilters): Promise<Task[]>;
  listActive(): Promise<Task[]>;
}
