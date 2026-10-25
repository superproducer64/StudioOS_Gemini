import React, { useState } from 'react';
import { Check, Edit2, Plus, Trash2, X } from 'lucide-react';
import {
  PriorityLevel,
  Project,
  Task,
  TaskStatus,
} from '../types/studioos.ts';

interface TasksViewProps {
  tasks: Task[];
  projects: Project[];
  loading: boolean;
  initialOpenCreate?: boolean;
  onClearInitialCreate?: () => void;
  onCreateTask: (data: Partial<Task>) => Promise<void>;
  onUpdateTask: (id: string, data: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}

const TASK_STATUSES: TaskStatus[] = [
  TaskStatus.Open,
  TaskStatus.InProgress,
  TaskStatus.Waiting,
  TaskStatus.Completed,
];

const PRIORITIES: PriorityLevel[] = [
  PriorityLevel.Low,
  PriorityLevel.Normal,
  PriorityLevel.High,
  PriorityLevel.Critical,
];

function priorityStyle(priority: PriorityLevel): string {
  switch (priority) {
    case PriorityLevel.Critical:
      return 'text-red-700 font-semibold';
    case PriorityLevel.High:
      return 'text-amber-700 font-semibold';
    case PriorityLevel.Normal:
      return 'text-slate-700 font-medium';
    case PriorityLevel.Low:
    default:
      return 'text-slate-500';
  }
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  projects,
  loading,
  initialOpenCreate,
  onClearInitialCreate,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('OPEN_ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [showForm, setShowForm] = useState<boolean>(Boolean(initialOpenCreate));
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.Open);
  const [priority, setPriority] = useState<PriorityLevel>(PriorityLevel.Normal);
  const [dueDate, setDueDate] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const openCreate = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setProjectId('');
    setStatus(TaskStatus.Open);
    setPriority(PriorityLevel.Normal);
    setDueDate('');
    setShowForm(true);
    if (onClearInitialCreate) onClearInitialCreate();
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setProjectId(task.project_id || '');
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.due_date || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload: Partial<Task> = {
        title: title.trim(),
        description: description.trim(),
        project_id: projectId || null,
        status,
        priority,
        due_date: dueDate || null,
      };
      if (editingTask) {
        await onUpdateTask(editingTask.id, payload);
      } else {
        await onCreateTask(payload);
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleCompleted = async (task: Task) => {
    const nextStatus =
      task.status === TaskStatus.Completed ? TaskStatus.Open : TaskStatus.Completed;
    await onUpdateTask(task.id, { status: nextStatus });
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'OPEN_ALL' && t.status === TaskStatus.Completed) return false;
    if (statusFilter === 'OVERDUE') {
      if (t.status === TaskStatus.Completed || !t.due_date || t.due_date >= today) {
        return false;
      }
    } else if (
      statusFilter !== 'ALL' &&
      statusFilter !== 'OPEN_ALL' &&
      t.status !== statusFilter
    ) {
      return false;
    }

    if (projectFilter !== 'ALL') {
      if (projectFilter === 'UNASSIGNED' && t.project_id !== null) return false;
      if (projectFilter !== 'UNASSIGNED' && t.project_id !== projectFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
          <p className="text-sm text-slate-600">
            Track studio deliverables, client obligations, and overdue action items across projects.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {[
            { id: 'OPEN_ALL', label: 'Active (Non-Completed)' },
            { id: 'OVERDUE', label: 'Overdue' },
            { id: TaskStatus.Open, label: 'Open' },
            { id: TaskStatus.InProgress, label: 'In Progress' },
            { id: TaskStatus.Waiting, label: 'Waiting' },
            { id: TaskStatus.Completed, label: 'Completed' },
            { id: 'ALL', label: 'All Tasks' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="projectFilter" className="text-xs text-slate-500 whitespace-nowrap">
            Project:
          </label>
          <select
            id="projectFilter"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="ALL">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="UNASSIGNED">Unassigned / Studio General</option>
          </select>
        </div>
      </div>

      {/* Create / Edit Task Form */}
      {showForm && (
        <div className="bg-white border border-slate-300 rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              {editingTask ? 'Edit Task' : 'Create New Task'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Close task form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Task Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Review unbilled development hours for Diana"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project (Optional)
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">— No Project (General Studio) —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description / Context
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes, acceptance criteria, or blocker details..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                {saving ? 'Saving...' : editingTask ? 'Save Task' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tasks Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">No tasks match the current filter.</p>
            <p className="text-xs text-slate-500">
              Create a new task above or switch the status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50/60">
                  <th className="py-3 px-4 font-medium w-10">Done</th>
                  <th className="py-3 px-4 font-medium">Task</th>
                  <th className="py-3 px-4 font-medium">Project</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Priority</th>
                  <th className="py-3 px-4 font-medium text-right">Due Date</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredTasks.map((task) => {
                  const isCompleted = task.status === TaskStatus.Completed;
                  const isOverdue =
                    !isCompleted && Boolean(task.due_date && task.due_date < today);

                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50/70 transition-colors align-top"
                    >
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => toggleCompleted(task)}
                          aria-label={`Mark "${task.title}" as ${
                            isCompleted ? 'open' : 'completed'
                          }`}
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                            isCompleted
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 hover:border-slate-900 bg-white'
                          }`}
                        >
                          {isCompleted && <Check className="w-3.5 h-3.5" />}
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        <div
                          className={`font-medium ${
                            isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-xs text-slate-500 mt-0.5 max-w-xl">
                            {task.description}
                          </div>
                        )}
                        {task.completed_at && (
                          <div className="text-xs font-mono tabular-nums text-emerald-700 mt-0.5">
                            Completed {task.completed_at.split('T')[0]}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                        {task.project_name || 'General Studio'}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          aria-label={`Status for ${task.title}`}
                          value={task.status}
                          onChange={(e) =>
                            onUpdateTask(task.id, {
                              status: e.target.value as TaskStatus,
                            })
                          }
                          className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span className={priorityStyle(task.priority)}>
                          {task.priority}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-right whitespace-nowrap">
                        {task.due_date ? (
                          <span
                            className={
                              isOverdue
                                ? 'text-red-700 font-semibold'
                                : 'text-slate-700'
                            }
                          >
                            {task.due_date}
                            {isOverdue ? ' (Overdue)' : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(task)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Edit task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTask(task.id)}
                            className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
