export enum ProjectStatus {
  Idea = 'Idea',
  Planning = 'Planning',
  Active = 'Active',
  Waiting = 'Waiting',
  Review = 'Review',
  Completed = 'Completed',
  Archived = 'Archived',
}

export enum PriorityLevel {
  Low = 'Low',
  Normal = 'Normal',
  High = 'High',
  Critical = 'Critical',
}

export enum TaskStatus {
  Open = 'Open',
  InProgress = 'In Progress',
  Waiting = 'Waiting',
  Completed = 'Completed',
}

export enum TransactionType {
  Income = 'Income',
  Expense = 'Expense',
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: PriorityLevel;
  client: string | null;
  revenue_model: string | null;
  unbilled_amount?: number;
  next_action: string | null;
  due_date: string | null;
  github_repo?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubCommitSummary {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface GitHubRepoStatus {
  id: string;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  language: string | null;
  open_issues_count: number;
  open_prs_count: number;
  stargazers_count: number;
  ci_status: 'passing' | 'failing' | 'pending' | 'unknown';
  updated_at: string;
  pushed_at: string;
  latest_commit: GitHubCommitSummary | null;
  linked_project_id: string | null;
  linked_project_name: string | null;
  source: 'oauth' | 'public_api' | 'studio_seed';
}

export interface GitHubConnectionState {
  connected: boolean;
  oauth_configured: boolean;
  auth_mode: 'oauth' | 'public_lookup' | 'seed_preview';
  username: string | null;
  avatar_url: string | null;
  tracked_owner: string;
  callback_url: string;
  repos: GitHubRepoStatus[];
}

export interface Task {
  id: string;
  project_id: string | null;
  project_name?: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: PriorityLevel;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  project_id: string | null;
  project_name?: string | null;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  transaction_date: string;
  client: string | null;
  notes: string | null;
  created_at: string;
}

export interface AttentionItem {
  id: string;
  kind: 'overdue_task' | 'high_priority_project' | 'unbilled_work' | 'upcoming_deadline' | 'blocked_work';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  subtitle: string;
  reason: string;
  recommended_action: string;
  project_id?: string | null;
  task_id?: string | null;
  due_date?: string | null;
  amount?: number;
}

export interface DashboardSummary {
  active_projects_count: number;
  open_tasks_count: number;
  overdue_tasks_count: number;
  upcoming_deadlines_count: number;
  income_this_month: number;
  expenses_this_month: number;
  net_income_this_month: number;
  unbilled_work_total: number;
  needs_attention: AttentionItem[];
  active_projects: Project[];
  overdue_tasks: Task[];
  upcoming_deadlines: Array<{
    id: string;
    type: 'project' | 'task';
    title: string;
    project_name: string | null;
    priority: PriorityLevel;
    status: string;
    due_date: string;
    days_remaining: number;
  }>;
}

export interface AgentPriorityRecommendation {
  rank: number;
  project_or_area: string;
  why_it_matters: string;
  recommended_next_action: string;
  urgency_tag: string;
}

export interface AgentResponse {
  question: string;
  generated_at: string;
  provider: 'openai' | 'gemini' | 'deterministic-fallback';
  facts: string[];
  priorities: AgentPriorityRecommendation[];
  additional_notes: string;
  read_only_notice: string;
  context_summary: {
    active_projects_evaluated: number;
    open_tasks_evaluated: number;
    overdue_tasks_evaluated: number;
    monthly_net_income: number;
    unbilled_work_total: number;
  };
}

export interface UserSession {
  authenticated: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    auth_provider: 'supabase' | 'studio-local';
  } | null;
  storage_mode: 'supabase' | 'local-postgres-mirror';
}
