import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  AttentionItem,
  DashboardSummary,
  PriorityLevel,
  TaskStatus,
} from '../types/studioos.ts';

interface DashboardViewProps {
  summary: DashboardSummary | null;
  loading: boolean;
  onNavigate: (tab: 'dashboard' | 'projects' | 'tasks' | 'money' | 'ask') => void;
  onAskQuestion: (question: string) => void;
  onCompleteTask: (taskId: string) => Promise<void>;
  onQuickCreateTask: () => void;
  onQuickLogTransaction: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function priorityTextColor(priority: PriorityLevel): string {
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

function severityIndicator(severity: AttentionItem['severity']): {
  label: string;
  colorClass: string;
} {
  if (severity === 'critical') {
    return { label: 'Critical Action', colorClass: 'text-red-700 font-semibold' };
  }
  if (severity === 'high') {
    return { label: 'High Priority', colorClass: 'text-amber-700 font-semibold' };
  }
  return { label: 'Blocked / Follow-up', colorClass: 'text-slate-700 font-medium' };
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  loading,
  onNavigate,
  onAskQuestion,
  onCompleteTask,
  onQuickCreateTask,
  onQuickLogTransaction,
}) => {
  const [quickPrompt, setQuickPrompt] = useState('What should I work on?');
  const [completingId, setCompletingId] = useState<string | null>(null);

  const handleQuickAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAskQuestion(quickPrompt.trim() || 'What should I work on?');
  };

  const handleComplete = async (taskId: string) => {
    setCompletingId(taskId);
    try {
      await onCompleteTask(taskId);
    } finally {
      setCompletingId(null);
    }
  };

  if (loading || !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-28 bg-white border border-slate-200 rounded-xl p-5 animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 bg-white border border-slate-200 rounded-xl p-6 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Chief-of-Staff Quick Prompt Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              Ask StudioOS Chief of Staff
            </h2>
            <p className="text-sm text-slate-600">
              Analyze live BGP Studios projects, tasks, deadlines, and cash flow to surface your top 3 priorities.
            </p>
          </div>

          <form
            onSubmit={handleQuickAskSubmit}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-xl"
          >
            <input
              type="text"
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              placeholder="What should I work on?"
              aria-label="Ask StudioOS a question"
              className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ask StudioOS</span>
            </button>
          </form>
        </div>
      </div>

      {/* Primary Operational & Financial Metrics Grid */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Projects</span>
            <button
              onClick={() => onNavigate('projects')}
              className="text-slate-700 hover:text-slate-900 hover:underline font-medium cursor-pointer"
            >
              View all
            </button>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {summary.active_projects_count}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {summary.upcoming_deadlines_count} upcoming deadlines
            </span>
          </div>
        </div>

        <div className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Open &amp; Overdue Tasks</span>
            <button
              onClick={() => onNavigate('tasks')}
              className="text-slate-700 hover:text-slate-900 hover:underline font-medium cursor-pointer"
            >
              Manage tasks
            </button>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {summary.open_tasks_count}
            </span>
            <span
              className={`text-xs font-mono tabular-nums ${
                summary.overdue_tasks_count > 0
                  ? 'text-red-700 font-semibold'
                  : 'text-emerald-700'
              }`}
            >
              {summary.overdue_tasks_count} overdue
            </span>
          </div>
        </div>

        <div className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Monthly Cash Flow</span>
            <button
              onClick={() => onNavigate('money')}
              className="text-slate-700 hover:text-slate-900 hover:underline font-medium cursor-pointer"
            >
              Ledger
            </button>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
              {formatCurrency(summary.income_this_month)}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Exp: {formatCurrency(summary.expenses_this_month)} · Net:{' '}
              {formatCurrency(summary.net_income_this_month)}
            </span>
          </div>
        </div>

        <div className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Outstanding / Unbilled Work</span>
            <button
              onClick={() => onNavigate('projects')}
              className="text-slate-700 hover:text-slate-900 hover:underline font-medium cursor-pointer"
            >
              Review hours
            </button>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                summary.unbilled_work_total > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {formatCurrency(summary.unbilled_work_total)}
            </span>
            <span className="text-xs text-slate-500">
              Across active client accounts
            </span>
          </div>
        </div>
      </div>

      {/* NEEDS ATTENTION SECTION */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Needs Attention</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Highest-urgency overdue tasks, unbilled client work, and release blockers across BGP Studios.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="font-mono tabular-nums">
              {summary.needs_attention.length} priority items surfaced
            </span>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => onAskQuestion('What should I work on?')}
              className="font-medium text-slate-900 hover:underline cursor-pointer"
            >
              Run AI Triage
            </button>
          </div>
        </div>

        {summary.needs_attention.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-900">
              All clear — no overdue tasks or critical blockers right now.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Review upcoming project milestones or ask StudioOS for strategic planning priorities.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {summary.needs_attention.map((item) => {
              const sev = severityIndicator(item.severity);
              return (
                <div
                  key={item.id}
                  className="px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-1 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={sev.colorClass}>{sev.label}</span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-slate-600">{item.subtitle}</span>
                      {item.due_date && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="font-mono tabular-nums text-slate-500">
                            Due {item.due_date}
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>

                    <p className="text-xs text-slate-600">
                      <span className="font-medium text-slate-700">Why it matters:</span>{' '}
                      {item.reason}
                    </p>
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">Next action:</span>{' '}
                      {item.recommended_action}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {item.task_id && (
                      <button
                        onClick={() => handleComplete(item.task_id!)}
                        disabled={completingId === item.task_id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {completingId === item.task_id ? 'Completing...' : 'Mark Complete'}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() =>
                        onNavigate(item.task_id ? 'tasks' : 'projects')
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>{item.task_id ? 'Open Task' : 'Open Project'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Two-Column Operational Tables: Active Projects & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active & Review Projects Table */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Active &amp; In-Review Projects
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Current studio slate and immediate next actions
              </p>
            </div>
            <button
              onClick={() => onNavigate('projects')}
              className="text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline whitespace-nowrap cursor-pointer"
            >
              All projects →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50/50">
                  <th className="py-2.5 px-4 font-medium">Project</th>
                  <th className="py-2.5 px-4 font-medium">Status · Priority</th>
                  <th className="py-2.5 px-4 font-medium">Next Action</th>
                  <th className="py-2.5 px-4 font-medium text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {summary.active_projects.map((proj) => (
                  <tr key={proj.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{proj.name}</div>
                      <div className="text-xs text-slate-500">
                        {proj.client
                          ? `Client: ${proj.client}`
                          : proj.revenue_model || 'Internal'}
                        {(proj.unbilled_amount || 0) > 0 && (
                          <span className="text-amber-700 font-mono tabular-nums">
                            {' '}
                            · ${Number(proj.unbilled_amount).toLocaleString()} unbilled
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      <span className="text-slate-800 font-medium">{proj.status}</span>
                      <span aria-hidden="true" className="mx-1.5 text-slate-300">
                        ·
                      </span>
                      <span className={priorityTextColor(proj.priority)}>
                        {proj.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 max-w-xs">
                      {proj.next_action || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-right text-slate-600 whitespace-nowrap">
                      {proj.due_date || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Upcoming Deadlines & Quick Actions */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Upcoming Deadlines (Next 14 Days)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scheduled task and project milestones
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onQuickCreateTask}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Task</span>
                </button>
                <button
                  onClick={onQuickLogTransaction}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Money</span>
                </button>
              </div>
            </div>

            {summary.upcoming_deadlines.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No deadlines scheduled in the next 14 days.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {summary.upcoming_deadlines.map((d) => (
                  <div
                    key={`${d.type}-${d.id}`}
                    className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-900 truncate">
                        {d.title}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="capitalize">{d.type}</span>
                        {d.project_name && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{d.project_name}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className={priorityTextColor(d.priority)}>{d.priority}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono tabular-nums font-medium text-slate-900">
                        {d.due_date}
                      </div>
                      <div
                        className={`text-xs font-mono tabular-nums ${
                          d.days_remaining <= 2 ? 'text-amber-700 font-medium' : 'text-slate-500'
                        }`}
                      >
                        {d.days_remaining === 0
                          ? 'Due today'
                          : `in ${d.days_remaining}d`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overdue summary footer inside card */}
          {summary.overdue_tasks.length > 0 && (
            <div className="px-6 py-3 bg-red-50/60 border-t border-red-100 flex items-center justify-between text-xs">
              <span className="text-red-800 font-medium">
                {summary.overdue_tasks.length} overdue task
                {summary.overdue_tasks.length === 1 ? '' : 's'} require immediate completion
              </span>
              <button
                onClick={() => onNavigate('tasks')}
                className="font-semibold text-red-900 hover:underline whitespace-nowrap cursor-pointer"
              >
                Resolve overdue →
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
