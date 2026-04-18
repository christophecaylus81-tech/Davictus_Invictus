export type ProjectStatus = "active" | "on_hold" | "completed" | "cancelled";

export interface Project {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}
