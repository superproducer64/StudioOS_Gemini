import React, { useState } from 'react';
import { Archive, Edit2, Plus, X } from 'lucide-react';
import {
  PriorityLevel,
  Project,
  ProjectStatus,
} from '../types/studioos.ts';

interface ProjectsViewProps {
  projects: Project[];
  loading: boolean;
  onCreateProject: (data: Partial<Project>) => Promise<void>;
  onUpdateProject: (id: string, data: Partial<Project>) => Promise<void>;
  onArchiveProject: (id: string) => Promise<void>;
}

const ALL_STATUSES: ProjectStatus[] = [
  ProjectStatus.Idea,
  ProjectStatus.Planning,
  ProjectStatus.Active,
  ProjectStatus.Waiting,
  ProjectStatus.Review,
  ProjectStatus.Completed,
  ProjectStatus.Archived,
];

const ALL_PRIORITIES: PriorityLevel[] = [
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
      return 'text-slate-800 font-medium';
    case PriorityLevel.Low:
    default:
      return 'text-slate-500';
  }
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  loading,
  onCreateProject,
  onUpdateProject,
  onArchiveProject,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL_ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.Active);
  const [priority, setPriority] = useState<PriorityLevel>(PriorityLevel.Normal);
  const [client, setClient] = useState('');
  const [revenueModel, setRevenueModel] = useState('');
  const [unbilledAmount, setUnbilledAmount] = useState('0');
  const [nextAction, setNextAction] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [githubRepo, setGithubRepo] = useState('');

  const openCreateForm = () => {
    setEditingProject(null);
    setName('');
    setDescription('');
    setStatus(ProjectStatus.Active);
    setPriority(PriorityLevel.Normal);
    setClient('');
    setRevenueModel('');
    setUnbilledAmount('0');
    setNextAction('');
    setDueDate('');
    setGithubRepo('');
    setShowForm(true);
  };

  const openEditForm = (proj: Project) => {
    setEditingProject(proj);
    setName(proj.name);
    setDescription(proj.description || '');
    setStatus(proj.status);
    setPriority(proj.priority);
    setClient(proj.client || '');
    setRevenueModel(proj.revenue_model || '');
    setUnbilledAmount(String(proj.unbilled_amount || 0));
    setNextAction(proj.next_action || '');
    setDueDate(proj.due_date || '');
    setGithubRepo(proj.github_repo || '');
    setShowForm(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload: Partial<Project> = {
        name: name.trim(),
        description: description.trim(),
        status,
        priority,
        client: client.trim() || null,
        revenue_model: revenueModel.trim() || null,
        unbilled_amount: Number(unbilledAmount) || 0,
        next_action: nextAction.trim() || null,
        due_date: dueDate || null,
        github_repo: githubRepo.trim() || null,
      };
      if (editingProject) {
        await onUpdateProject(editingProject.id, payload);
      } else {
        await onCreateProject(payload);
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (statusFilter === 'ALL_ACTIVE' && p.status === ProjectStatus.Archived) return false;
    if (
      statusFilter !== 'ALL' &&
      statusFilter !== 'ALL_ACTIVE' &&
      p.status !== statusFilter
    ) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.client && p.client.toLowerCase().includes(q)) ||
        (p.next_action && p.next_action.toLowerCase().includes(q)) ||
        (p.revenue_model && p.revenue_model.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
          <p className="text-sm text-slate-600">
            Manage BGP Studios products, client engagements, revenue models, and immediate next actions.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setStatusFilter('ALL_ACTIVE')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'ALL_ACTIVE'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Working Slate
          </button>
          {[
            ProjectStatus.Active,
            ProjectStatus.Review,
            ProjectStatus.Planning,
            ProjectStatus.Waiting,
            ProjectStatus.Idea,
            ProjectStatus.Completed,
            ProjectStatus.Archived,
          ].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search project, client, next action..."
          className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 w-full lg:w-64"
        />
      </div>

      {/* Create / Edit Project Drawer Card */}
      {showForm && (
        <div className="bg-white border border-slate-300 rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              {editingProject ? `Edit Project: ${editingProject.name}` : 'Create New Project'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Close project form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Caddlatch"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Client (Optional)
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="e.g., Diana / Mars Roofing & Exteriors"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {ALL_STATUSES.map((s) => (
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
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {ALL_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Revenue Model
              </label>
              <input
                type="text"
                value={revenueModel}
                onChange={(e) => setRevenueModel(e.target.value)}
                placeholder="e.g., Monthly service / $2.99 app purchase"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Unbilled Work ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unbilledAmount}
                  onChange={(e) => setUnbilledAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recommended Next Action
              </label>
              <input
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="e.g., Check App Store review status"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                GitHub Repository (owner/repo)
              </label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="e.g., bgp-studios/caddlatch-ios"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description / Notes
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief project summary and key operational context..."
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
                {saving
                  ? 'Saving...'
                  : editingProject
                  ? 'Save Changes'
                  : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Projects Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading projects...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">No projects match this filter.</p>
            <p className="text-xs text-slate-500">
              Create a new project or switch the status filter above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50/60">
                  <th className="py-3 px-4 font-medium">Project &amp; Client</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Priority</th>
                  <th className="py-3 px-4 font-medium">Revenue Model</th>
                  <th className="py-3 px-4 font-medium">Next Action</th>
                  <th className="py-3 px-4 font-medium text-right">Due Date</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    className="hover:bg-slate-50/70 transition-colors align-top"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{project.name}</div>
                      {project.client && (
                        <div className="text-xs text-slate-600 mt-0.5">
                          Client: {project.client}
                        </div>
                      )}
                      {project.github_repo && (
                        <div className="text-xs font-mono text-slate-500 mt-0.5">
                          Repo: {project.github_repo}
                        </div>
                      )}
                      {project.description && (
                        <div className="text-xs text-slate-500 mt-1 max-w-md">
                          {project.description}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <select
                        aria-label={`Status for ${project.name}`}
                        value={project.status}
                        onChange={(e) =>
                          onUpdateProject(project.id, {
                            status: e.target.value as ProjectStatus,
                          })
                        }
                        className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                      <span className={priorityStyle(project.priority)}>
                        {project.priority}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      <div>{project.revenue_model || '—'}</div>
                      {(project.unbilled_amount || 0) > 0 && (
                        <div className="text-amber-700 font-mono tabular-nums font-medium mt-0.5">
                          ${Number(project.unbilled_amount).toLocaleString()} unbilled
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-800 max-w-xs">
                      {project.next_action || '—'}
                    </td>

                    <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-right text-slate-600 whitespace-nowrap">
                      {project.due_date || '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEditForm(project)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title="Edit project"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {project.status !== ProjectStatus.Archived && (
                          <button
                            onClick={() => onArchiveProject(project.id)}
                            className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                            title="Archive project"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
