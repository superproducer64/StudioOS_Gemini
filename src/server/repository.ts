import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AttentionItem,
  DashboardSummary,
  PriorityLevel,
  Project,
  ProjectStatus,
  Task,
  TaskStatus,
  Transaction,
  TransactionType,
} from '../types/studioos.ts';
import { getInitialSeedData } from '../data/seedData.ts';

interface LocalStoreData {
  projects: Project[];
  tasks: Task[];
  transactions: Transaction[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'studioos-db.json');

function isValidSupabaseConfig(): boolean {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  return (
    Boolean(url && key) &&
    url.startsWith('https://') &&
    !url.includes('your-project-ref') &&
    !key.includes('your-supabase')
  );
}

let supabaseAdmin: SupabaseClient | null = null;
if (isValidSupabaseConfig()) {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)!;
  supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false },
  });
}

function readLocalStore(): LocalStoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const seed = getInitialSeedData();
      fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf-8');
      return seed;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as LocalStoreData;
    if (!parsed.projects || !parsed.tasks || !parsed.transactions) {
      const seed = getInitialSeedData();
      fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf-8');
      return seed;
    }
    return parsed;
  } catch (err) {
    console.error('Error reading local StudioOS store, using seed data:', err);
    return getInitialSeedData();
  }
}

function writeLocalStore(data: LocalStoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

const PRIORITY_WEIGHT: Record<PriorityLevel, number> = {
  [PriorityLevel.Critical]: 4,
  [PriorityLevel.High]: 3,
  [PriorityLevel.Normal]: 2,
  [PriorityLevel.Low]: 1,
};

export class StudioRepository {
  static getStorageMode(): 'supabase' | 'local-postgres-mirror' {
    return supabaseAdmin ? 'supabase' : 'local-postgres-mirror';
  }

  static async resetToSeedData(): Promise<{ projects: number; tasks: number; transactions: number }> {
    const seed = getInitialSeedData();
    writeLocalStore(seed);
    return {
      projects: seed.projects.length,
      tasks: seed.tasks.length,
      transactions: seed.transactions.length,
    };
  }

  // --------------------------------------------------------------------------
  // PROJECTS CRUD
  // --------------------------------------------------------------------------
  static async getProjects(includeArchived = true): Promise<Project[]> {
    if (supabaseAdmin) {
      let query = supabaseAdmin.from('projects').select('*');
      if (!includeArchived) {
        query = query.neq('status', ProjectStatus.Archived);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) {
        return (data as Project[]).sort(
          (a, b) => (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0)
        );
      }
    }

    const store = readLocalStore();
    const list = includeArchived
      ? store.projects
      : store.projects.filter((p) => p.status !== ProjectStatus.Archived);
    return [...list].sort(
      (a, b) => (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0)
    );
  }

  static async getProjectById(id: string): Promise<Project | null> {
    const projects = await this.getProjects(true);
    return projects.find((p) => p.id === id) || null;
  }

  static async createProject(input: Partial<Project>): Promise<Project> {
    const now = new Date().toISOString();
    const newProject: Project = {
      id: input.id || `proj-${crypto.randomUUID().slice(0, 8)}`,
      name: (input.name || 'Untitled Project').trim(),
      description: (input.description || '').trim(),
      status: (input.status as ProjectStatus) || ProjectStatus.Planning,
      priority: (input.priority as PriorityLevel) || PriorityLevel.Normal,
      client: input.client ? input.client.trim() : null,
      revenue_model: input.revenue_model ? input.revenue_model.trim() : null,
      unbilled_amount: Number(input.unbilled_amount || 0),
      next_action: input.next_action ? input.next_action.trim() : null,
      due_date: input.due_date || null,
      github_repo: input.github_repo ? input.github_repo.trim() : null,
      created_at: now,
      updated_at: now,
    };

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('projects')
        .insert([newProject])
        .select()
        .single();
      if (!error && data) return data as Project;
    }

    const store = readLocalStore();
    store.projects.unshift(newProject);
    writeLocalStore(store);
    return newProject;
  }

  static async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    const now = new Date().toISOString();

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('projects')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data as Project;
    }

    const store = readLocalStore();
    const idx = store.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const existing = store.projects[idx];
    const updated: Project = {
      ...existing,
      ...updates,
      id: existing.id,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      description: updates.description !== undefined ? updates.description.trim() : existing.description,
      client: updates.client !== undefined ? (updates.client ? updates.client.trim() : null) : existing.client,
      revenue_model:
        updates.revenue_model !== undefined
          ? updates.revenue_model
            ? updates.revenue_model.trim()
            : null
          : existing.revenue_model,
      unbilled_amount:
        updates.unbilled_amount !== undefined ? Number(updates.unbilled_amount) : existing.unbilled_amount,
      next_action:
        updates.next_action !== undefined
          ? updates.next_action
            ? updates.next_action.trim()
            : null
          : existing.next_action,
      updated_at: now,
    };

    store.projects[idx] = updated;
    writeLocalStore(store);
    return updated;
  }

  static async archiveProject(id: string): Promise<Project | null> {
    return this.updateProject(id, { status: ProjectStatus.Archived });
  }

  // --------------------------------------------------------------------------
  // TASKS CRUD
  // --------------------------------------------------------------------------
  static async getTasks(filters?: { projectId?: string; status?: TaskStatus }): Promise<Task[]> {
    const projects = await this.getProjects(true);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    let tasks: Task[] = [];
    if (supabaseAdmin) {
      let query = supabaseAdmin.from('tasks').select('*');
      if (filters?.projectId) query = query.eq('project_id', filters.projectId);
      if (filters?.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (!error && data) {
        tasks = data as Task[];
      }
    }

    if (tasks.length === 0) {
      const store = readLocalStore();
      tasks = store.tasks.filter((t) => {
        if (filters?.projectId && t.project_id !== filters.projectId) return false;
        if (filters?.status && t.status !== filters.status) return false;
        return true;
      });
    }

    return tasks
      .map((t) => ({
        ...t,
        project_name: t.project_id ? projectMap.get(t.project_id) || null : null,
      }))
      .sort((a, b) => {
        if (a.status === TaskStatus.Completed && b.status !== TaskStatus.Completed) return 1;
        if (a.status !== TaskStatus.Completed && b.status === TaskStatus.Completed) return -1;
        const pDiff = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
        if (pDiff !== 0) return pDiff;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });
  }

  static async getOverdueTasks(): Promise<Task[]> {
    const today = new Date().toISOString().split('T')[0];
    const allTasks = await this.getTasks();
    return allTasks.filter(
      (t) => t.status !== TaskStatus.Completed && Boolean(t.due_date && t.due_date < today)
    );
  }

  static async createTask(input: Partial<Task>): Promise<Task> {
    const now = new Date().toISOString();
    const status = (input.status as TaskStatus) || TaskStatus.Open;
    const newTask: Task = {
      id: input.id || `task-${crypto.randomUUID().slice(0, 8)}`,
      project_id: input.project_id || null,
      title: (input.title || 'Untitled Task').trim(),
      description: (input.description || '').trim(),
      status,
      priority: (input.priority as PriorityLevel) || PriorityLevel.Normal,
      due_date: input.due_date || null,
      completed_at: status === TaskStatus.Completed ? now : null,
      created_at: now,
      updated_at: now,
    };

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from('tasks').insert([newTask]).select().single();
      if (!error && data) return data as Task;
    }

    const store = readLocalStore();
    store.tasks.unshift(newTask);
    writeLocalStore(store);

    const projects = store.projects;
    const project = projects.find((p) => p.id === newTask.project_id);
    return {
      ...newTask,
      project_name: project?.name || null,
    };
  }

  static async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const now = new Date().toISOString();

    const store = readLocalStore();
    const idx = store.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;

    const existing = store.tasks[idx];
    const nextStatus = (updates.status as TaskStatus) ?? existing.status;
    let completedAt = existing.completed_at;
    if (nextStatus === TaskStatus.Completed && existing.status !== TaskStatus.Completed) {
      completedAt = now;
    } else if (nextStatus !== TaskStatus.Completed) {
      completedAt = null;
    }

    const updated: Task = {
      ...existing,
      ...updates,
      id: existing.id,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      description: updates.description !== undefined ? updates.description.trim() : existing.description,
      status: nextStatus,
      completed_at: completedAt,
      updated_at: now,
    };

    if (supabaseAdmin) {
      await supabaseAdmin.from('tasks').update(updated).eq('id', id);
    }

    store.tasks[idx] = updated;
    writeLocalStore(store);

    const project = store.projects.find((p) => p.id === updated.project_id);
    return {
      ...updated,
      project_name: project?.name || null,
    };
  }

  static async deleteTask(id: string): Promise<boolean> {
    if (supabaseAdmin) {
      await supabaseAdmin.from('tasks').delete().eq('id', id);
    }
    const store = readLocalStore();
    const before = store.tasks.length;
    store.tasks = store.tasks.filter((t) => t.id !== id);
    writeLocalStore(store);
    return store.tasks.length < before;
  }

  // --------------------------------------------------------------------------
  // TRANSACTIONS CRUD (FINANCIAL ACTIVITY)
  // --------------------------------------------------------------------------
  static async getTransactions(): Promise<Transaction[]> {
    const projects = await this.getProjects(true);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    let transactions: Transaction[] = [];
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false });
      if (!error && data) {
        transactions = data as Transaction[];
      }
    }

    if (transactions.length === 0) {
      const store = readLocalStore();
      transactions = store.transactions;
    }

    return transactions
      .map((tx) => ({
        ...tx,
        amount: Number(tx.amount),
        project_name: tx.project_id ? projectMap.get(tx.project_id) || null : null,
      }))
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  }

  static async createTransaction(input: Partial<Transaction>): Promise<Transaction> {
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const newTx: Transaction = {
      id: input.id || `tx-${crypto.randomUUID().slice(0, 8)}`,
      project_id: input.project_id || null,
      type: (input.type as TransactionType) || TransactionType.Income,
      amount: Math.max(0, Number(input.amount || 0)),
      category: (input.category || 'General').trim(),
      description: (input.description || '').trim(),
      transaction_date: input.transaction_date || today,
      client: input.client ? input.client.trim() : null,
      notes: input.notes ? input.notes.trim() : null,
      created_at: now,
    };

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .insert([newTx])
        .select()
        .single();
      if (!error && data) return data as Transaction;
    }

    const store = readLocalStore();
    store.transactions.unshift(newTx);
    writeLocalStore(store);

    const project = store.projects.find((p) => p.id === newTx.project_id);
    return {
      ...newTx,
      project_name: project?.name || null,
    };
  }

  static async deleteTransaction(id: string): Promise<boolean> {
    if (supabaseAdmin) {
      await supabaseAdmin.from('transactions').delete().eq('id', id);
    }
    const store = readLocalStore();
    const before = store.transactions.length;
    store.transactions = store.transactions.filter((tx) => tx.id !== id);
    writeLocalStore(store);
    return store.transactions.length < before;
  }

  // --------------------------------------------------------------------------
  // DASHBOARD AGGREGATION & NEEDS ATTENTION LOGIC
  // --------------------------------------------------------------------------
  static async getDashboardSummary(): Promise<DashboardSummary> {
    const [projects, tasks, transactions] = await Promise.all([
      this.getProjects(false),
      this.getTasks(),
      this.getTransactions(),
    ]);

    const today = new Date().toISOString().split('T')[0];
    const currentYearMonth = today.slice(0, 7); // YYYY-MM

    const activeProjects = projects.filter(
      (p) =>
        p.status === ProjectStatus.Active ||
        p.status === ProjectStatus.Review ||
        p.status === ProjectStatus.Waiting
    );

    const openTasks = tasks.filter((t) => t.status !== TaskStatus.Completed);
    const overdueTasks = openTasks.filter((t) => Boolean(t.due_date && t.due_date < today));

    // Calculate days difference helper
    const diffDays = (dateStr: string): number => {
      const target = new Date(`${dateStr}T00:00:00`);
      const nowDate = new Date(`${today}T00:00:00`);
      return Math.round((target.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Upcoming deadlines (next 14 days, including today)
    const upcomingDeadlines: DashboardSummary['upcoming_deadlines'] = [];

    for (const t of openTasks) {
      if (t.due_date) {
        const days = diffDays(t.due_date);
        if (days >= 0 && days <= 14) {
          upcomingDeadlines.push({
            id: t.id,
            type: 'task',
            title: t.title,
            project_name: t.project_name || null,
            priority: t.priority,
            status: t.status,
            due_date: t.due_date,
            days_remaining: days,
          });
        }
      }
    }

    for (const p of projects) {
      if (p.status !== ProjectStatus.Completed && p.status !== ProjectStatus.Archived && p.due_date) {
        const days = diffDays(p.due_date);
        if (days >= 0 && days <= 14) {
          upcomingDeadlines.push({
            id: p.id,
            type: 'project',
            title: `${p.name}${p.next_action ? ` — ${p.next_action}` : ''}`,
            project_name: p.name,
            priority: p.priority,
            status: p.status,
            due_date: p.due_date,
            days_remaining: days,
          });
        }
      }
    }

    upcomingDeadlines.sort((a, b) => a.days_remaining - b.days_remaining);

    // Monthly financial totals
    const monthTransactions = transactions.filter((tx) =>
      tx.transaction_date.startsWith(currentYearMonth)
    );
    const incomeThisMonth = monthTransactions
      .filter((tx) => tx.type === TransactionType.Income)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const expensesThisMonth = monthTransactions
      .filter((tx) => tx.type === TransactionType.Expense)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    // Outstanding or unbilled work across active/review projects
    const unbilledWorkTotal = projects
      .filter((p) => p.status !== ProjectStatus.Archived && p.status !== ProjectStatus.Completed)
      .reduce((sum, p) => sum + Number(p.unbilled_amount || 0), 0);

    // Build "Needs Attention" items
    const needsAttention: AttentionItem[] = [];

    // 1. Overdue tasks
    for (const task of overdueTasks) {
      const daysOverdue = task.due_date ? Math.abs(diffDays(task.due_date)) : 1;
      needsAttention.push({
        id: `attn-task-${task.id}`,
        kind: 'overdue_task',
        severity: task.priority === PriorityLevel.Critical ? 'critical' : 'high',
        title: task.title,
        subtitle: task.project_name ? `Project: ${task.project_name}` : 'General Studio Task',
        reason: `Overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} (${task.priority} priority)`,
        recommended_action: `Complete or reschedule task "${task.title}"`,
        project_id: task.project_id,
        task_id: task.id,
        due_date: task.due_date,
      });
    }

    // 2. Unbilled client work & High-priority projects needing action
    for (const proj of projects) {
      if (proj.status === ProjectStatus.Completed || proj.status === ProjectStatus.Archived) continue;

      if ((proj.unbilled_amount || 0) > 0) {
        needsAttention.push({
          id: `attn-unbilled-${proj.id}`,
          kind: 'unbilled_work',
          severity: (proj.unbilled_amount || 0) >= 1000 ? 'critical' : 'high',
          title: `${proj.name} — $${Number(proj.unbilled_amount).toLocaleString()} unbilled work`,
          subtitle: proj.client ? `Client: ${proj.client}` : proj.revenue_model || 'Client Project',
          reason: `Outstanding unbilled work ($${Number(proj.unbilled_amount).toLocaleString()}) ready for review and billing`,
          recommended_action: proj.next_action || 'Audit logged hours and invoice client',
          project_id: proj.id,
          due_date: proj.due_date,
          amount: Number(proj.unbilled_amount),
        });
      } else if (
        proj.priority === PriorityLevel.Critical ||
        proj.priority === PriorityLevel.High ||
        proj.status === ProjectStatus.Review
      ) {
        needsAttention.push({
          id: `attn-proj-${proj.id}`,
          kind: 'high_priority_project',
          severity: proj.priority === PriorityLevel.Critical ? 'critical' : 'high',
          title: `${proj.name} (${proj.status})`,
          subtitle: proj.revenue_model || 'High-Priority Project',
          reason: `Marked ${proj.priority} priority in ${proj.status} stage`,
          recommended_action: proj.next_action || 'Execute next project milestone',
          project_id: proj.id,
          due_date: proj.due_date,
        });
      }
    }

    // 3. Blocked / Waiting tasks
    for (const task of openTasks.filter((t) => t.status === TaskStatus.Waiting)) {
      needsAttention.push({
        id: `attn-blocked-${task.id}`,
        kind: 'blocked_work',
        severity: 'medium',
        title: task.title,
        subtitle: task.project_name ? `Blocked on ${task.project_name}` : 'Waiting on external input',
        reason: 'Task is in Waiting status and may block downstream delivery',
        recommended_action: 'Follow up with stakeholder to unblock',
        project_id: task.project_id,
        task_id: task.id,
        due_date: task.due_date,
      });
    }

    return {
      active_projects_count: activeProjects.length,
      open_tasks_count: openTasks.length,
      overdue_tasks_count: overdueTasks.length,
      upcoming_deadlines_count: upcomingDeadlines.length,
      income_this_month: incomeThisMonth,
      expenses_this_month: expensesThisMonth,
      net_income_this_month: incomeThisMonth - expensesThisMonth,
      unbilled_work_total: unbilledWorkTotal,
      needs_attention: needsAttention.slice(0, 6),
      active_projects: activeProjects,
      overdue_tasks: overdueTasks,
      upcoming_deadlines: upcomingDeadlines.slice(0, 8),
    };
  }
}
