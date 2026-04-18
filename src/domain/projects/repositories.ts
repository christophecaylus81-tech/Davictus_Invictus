import type { Project } from "./types";

export interface ProjectRepository {
  list(limit: number): Promise<Project[]>;
  listActive(): Promise<Project[]>;
}
