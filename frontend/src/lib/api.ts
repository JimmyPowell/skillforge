const API_BASE = "http://localhost:8000/api";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }
  return res.json();
}

// Types

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  version_count: number;
  latest_version: number;
  created_at: string;
  updated_at: string;
}

export interface SkillVersion {
  id: string;
  skill_id: string;
  version: number;
  content: string;
  change_note: string;
  word_count: number;
  created_at: string;
}

export interface SkillDetail extends Skill {
  versions: SkillVersion[];
}

export interface CreateSkillData {
  name: string;
  description: string;
  category: string;
  tags: string[];
  content: string;
}

export interface CreateSkillVersionData {
  content: string;
  change_note: string;
}

export interface Task {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  tags: string[];
  instruction: string;
  dockerfile: string;
  verifier: string;
  solution: string;
  created_at: string;
}

export interface CreateTaskData {
  name: string;
  category: string;
  difficulty: string;
  tags: string[];
  instruction: string;
  dockerfile: string;
  verifier: string;
  solution: string;
}

export interface Run {
  id: string;
  task_id: string;
  task_name: string;
  skill_id: string;
  skill_name: string;
  skill_version: number;
  agent: string;
  model: string;
  status: "pending" | "building" | "running" | "completed" | "failed";
  passed: boolean | null;
  reward: number | null;
  duration_seconds: number | null;
  verifier_output: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CreateRunData {
  task_id: string;
  skill_id: string;
  skill_version?: number;
  agent: string;
  model: string;
}

export interface RunsParams {
  status?: string;
  task_id?: string;
  skill_id?: string;
  limit?: number;
  offset?: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// Skills

export async function fetchSkills(): Promise<Skill[]> {
  return fetchJSON<Skill[]>("/skills");
}

export async function fetchSkill(id: string): Promise<SkillDetail> {
  return fetchJSON<SkillDetail>(`/skills/${id}`);
}

export async function createSkill(data: CreateSkillData): Promise<Skill> {
  return fetchJSON<Skill>("/skills", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createSkillVersion(
  skillId: string,
  data: CreateSkillVersionData
): Promise<SkillVersion> {
  return fetchJSON<SkillVersion>(`/skills/${skillId}/versions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Tasks

export async function fetchTasks(): Promise<Task[]> {
  return fetchJSON<Task[]>("/tasks");
}

export async function fetchTask(id: string): Promise<Task> {
  return fetchJSON<Task>(`/tasks/${id}`);
}

export async function createTask(data: CreateTaskData): Promise<Task> {
  return fetchJSON<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function importTasks(sourcePath: string): Promise<ImportResult> {
  return fetchJSON<ImportResult>("/tasks/import", {
    method: "POST",
    body: JSON.stringify({ source_path: sourcePath }),
  });
}

// Runs

export async function fetchRuns(params?: RunsParams): Promise<Run[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.task_id) searchParams.set("task_id", params.task_id);
  if (params?.skill_id) searchParams.set("skill_id", params.skill_id);
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.offset) searchParams.set("offset", params.offset.toString());
  const qs = searchParams.toString();
  return fetchJSON<Run[]>(`/runs${qs ? `?${qs}` : ""}`);
}

export async function fetchRun(id: string): Promise<Run> {
  return fetchJSON<Run>(`/runs/${id}`);
}

export async function createRun(data: CreateRunData): Promise<Run> {
  return fetchJSON<Run>("/runs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Trajectory

export interface TrajectoryEvent {
  step: number;
  type: "user_message" | "tool_call" | "agent_message";
  kind: string;
  title: string;
  content: string;
  is_skill_related: boolean;
  duration_ms: number | null;
}

export interface SkillUsageAnalysis {
  skill_read: boolean;
  read_at_step: number | null;
  read_method: string | null;
  sections_accessed: string[];
  skill_mentions_in_reasoning: Array<{ step: number; quote: string }>;
  time_to_first_read_sec: number | null;
}

export async function fetchTrajectory(runId: string): Promise<TrajectoryEvent[]> {
  return fetchJSON<TrajectoryEvent[]>(`/runs/${runId}/trajectory`);
}

export async function fetchSkillUsage(runId: string): Promise<SkillUsageAnalysis> {
  return fetchJSON<SkillUsageAnalysis>(`/runs/${runId}/skill-usage`);
}
