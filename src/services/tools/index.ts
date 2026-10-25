import { StudioRepository } from '../../server/repository.ts';
import { getGitHubStatus } from '../githubService.ts';
import {
  GitHubRepoStatus,
  Project,
  Task,
  TaskStatus,
  Transaction,
} from '../../types/studioos.ts';

/**
 * StudioOS Tool Layer (v0.1)
 *
 * Centralizes data retrieval and mutation functions for the StudioOS Agent
 * and future tool-calling integrations.
 *
 * Note: For version 0.1, StudioOS Agent operates in strictly READ-ONLY mode.
 * Write tools (`create_task`, `update_project`) and external integration stubs
 * (`draft_email`, `get_calendar`) are registered here for clean future expansion
 * and explicit architectural separation, but are NOT automatically invoked by the AI.
 */

export async function get_projects(includeArchived = false): Promise<Project[]> {
  return StudioRepository.getProjects(includeArchived);
}

export async function get_tasks(filters?: {
  projectId?: string;
  status?: TaskStatus;
}): Promise<Task[]> {
  return StudioRepository.getTasks(filters);
}

export async function get_overdue_tasks(): Promise<Task[]> {
  return StudioRepository.getOverdueTasks();
}

export async function get_transactions(): Promise<Transaction[]> {
  return StudioRepository.getTransactions();
}

export async function get_github_repos(): Promise<GitHubRepoStatus[]> {
  const status = await getGitHubStatus(false);
  return status.repos;
}

export async function create_task(input: Partial<Task>): Promise<Task> {
  return StudioRepository.createTask(input);
}

export async function update_project(
  projectId: string,
  updates: Partial<Project>
): Promise<Project | null> {
  return StudioRepository.updateProject(projectId, updates);
}

/**
 * Future External Tool Stub: draft_email
 * Not enabled in StudioOS v0.1 (Read-Only Agent Scope).
 */
export async function draft_email(_params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ status: 'disabled_in_v0_1'; message: string }> {
  return {
    status: 'disabled_in_v0_1',
    message:
      'Email drafting and sending integrations are disabled in StudioOS v0.1 (read-only mode).',
  };
}

/**
 * Future External Tool Stub: get_calendar
 * Not enabled in StudioOS v0.1 (Read-Only Agent Scope).
 */
export async function get_calendar(_params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ status: 'disabled_in_v0_1'; events: never[]; message: string }> {
  return {
    status: 'disabled_in_v0_1',
    events: [],
    message: 'External calendar integration is not yet enabled in StudioOS v0.1.',
  };
}

export const STUDIO_TOOLS_REGISTRY = {
  readOnlyTools: {
    get_projects,
    get_tasks,
    get_overdue_tasks,
    get_transactions,
  },
  mutationTools: {
    create_task,
    update_project,
  },
  futureExternalTools: {
    draft_email,
    get_calendar,
  },
};
