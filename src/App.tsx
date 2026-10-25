/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckSquare,
  DollarSign,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import {
  DashboardSummary,
  GitHubConnectionState,
  Project,
  Task,
  TaskStatus,
  Transaction,
  UserSession,
} from './types/studioos.ts';
import { studioApi } from './lib/supabaseClient.ts';
import { LoginView } from './components/LoginView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ProjectsView } from './components/ProjectsView.tsx';
import { TasksView } from './components/TasksView.tsx';
import { MoneyView } from './components/MoneyView.tsx';
import { GitHubView } from './components/GitHubView.tsx';
import { AskStudioOSView } from './components/AskStudioOSView.tsx';

type NavTab = 'dashboard' | 'projects' | 'tasks' | 'money' | 'github' | 'ask';

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'money', label: 'Money', icon: DollarSign },
  { id: 'github', label: 'GitHub', icon: GitBranch },
  { id: 'ask', label: 'Ask StudioOS', icon: Sparkles },
];

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Studio operational state
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [githubState, setGithubState] = useState<GitHubConnectionState | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Cross-view triggers
  const [askQuestionPrompt, setAskQuestionPrompt] = useState<string>(
    'What should I work on?'
  );
  const [openCreateTaskOnNav, setOpenCreateTaskOnNav] = useState(false);
  const [openCreateTxOnNav, setOpenCreateTxOnNav] = useState(false);

  const loadAllStudioData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [dashData, projData, taskData, txData, ghData] = await Promise.all([
        studioApi.getDashboard(),
        studioApi.getProjects(true),
        studioApi.getTasks(),
        studioApi.getTransactions(),
        studioApi.getGitHubStatus(false),
      ]);
      setDashboard(dashData);
      setProjects(projData);
      setTasks(taskData);
      setTransactions(txData);
      setGithubState(ghData);
    } catch (err) {
      console.error('Failed to load StudioOS data:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    studioApi
      .getSession()
      .then((sess) => {
        setSession(sess);
        if (sess.authenticated) {
          loadAllStudioData();
        }
      })
      .catch((err) => {
        console.error('Session check failed:', err);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, [loadAllStudioData]);

  const handleLogin = async (email: string, password?: string) => {
    const sess = await studioApi.login(email, password);
    setSession(sess);
    await loadAllStudioData();
  };

  const handleLogout = async () => {
    const sess = await studioApi.logout();
    setSession(sess);
  };

  const handleResetSeed = async () => {
    await studioApi.resetSeedData();
    await loadAllStudioData();
  };

  // CRUD Handlers
  const handleCreateProject = async (data: Partial<Project>) => {
    await studioApi.createProject(data);
    await loadAllStudioData();
  };

  const handleUpdateProject = async (id: string, data: Partial<Project>) => {
    await studioApi.updateProject(id, data);
    await loadAllStudioData();
  };

  const handleArchiveProject = async (id: string) => {
    await studioApi.archiveProject(id);
    await loadAllStudioData();
  };

  const handleCreateTask = async (data: Partial<Task>) => {
    await studioApi.createTask(data);
    await loadAllStudioData();
  };

  const handleUpdateTask = async (id: string, data: Partial<Task>) => {
    await studioApi.updateTask(id, data);
    await loadAllStudioData();
  };

  const handleCompleteTaskFromDashboard = async (taskId: string) => {
    await studioApi.updateTask(taskId, { status: TaskStatus.Completed });
    await loadAllStudioData();
  };

  const handleDeleteTask = async (id: string) => {
    await studioApi.deleteTask(id);
    await loadAllStudioData();
  };

  const handleCreateTransaction = async (data: Partial<Transaction>) => {
    await studioApi.createTransaction(data);
    await loadAllStudioData();
  };

  const handleDeleteTransaction = async (id: string) => {
    await studioApi.deleteTransaction(id);
    await loadAllStudioData();
  };

  const handleRefreshGitHub = async (force = true) => {
    const ghData = await studioApi.getGitHubStatus(force);
    setGithubState(ghData);
  };

  const handleLookupGitHubTarget = async (target: string) => {
    const ghData = await studioApi.lookupGitHubTarget(target);
    setGithubState(ghData);
  };

  const handleDisconnectGitHub = async () => {
    const ghData = await studioApi.disconnectGitHub();
    setGithubState(ghData);
  };

  const handleLinkRepoToProject = async (
    projectId: string,
    repoFullName: string | null
  ) => {
    await studioApi.updateProject(projectId, { github_repo: repoFullName });
    await loadAllStudioData();
  };

  const handleAskFromAnywhere = (question: string) => {
    setAskQuestionPrompt(question);
    setActiveTab('ask');
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        Initializing StudioOS...
      </div>
    );
  }

  if (!session?.authenticated) {
    return <LoginView onLoginSuccess={handleLogin} />;
  }

  const currentNavLabel =
    NAV_ITEMS.find((item) => item.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Navigation Sidebar (Desktop) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-slate-900 text-slate-100 border-r border-slate-800">
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="text-lg font-bold tracking-tight text-white">StudioOS</div>
          <div className="text-xs text-slate-400 mt-0.5">BGP Studios · v0.1</div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.id === 'tasks' && (dashboard?.overdue_tasks_count || 0) > 0 && (
                  <span className="text-xs font-mono tabular-nums text-red-400">
                    {dashboard?.overdue_tasks_count} overdue
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="px-2">
            <div className="text-xs font-medium text-slate-200 truncate">
              {session.user?.email}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Primary Owner · Read-Only AI
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleResetSeed}
              title="Reset sample BGP Studios seed data"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Seed</span>
            </button>
            <button
              onClick={handleLogout}
              title="Sign out of StudioOS"
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Zone 1 Brand/Breadcrumb - Zone 2 Quick Nav - Zone 3 Primary Actions */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-md"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <a
              href="#dashboard"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('dashboard');
              }}
              className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap"
            >
              BGP Studios / {currentNavLabel}
            </a>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === item.id
                    ? 'text-slate-900 font-semibold underline underline-offset-4'
                    : ''
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            {activeTab !== 'ask' && (
              <button
                onClick={() => handleAskFromAnywhere('What should I work on?')}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                What should I work on?
              </button>
            )}
            <button
              onClick={handleLogout}
              className="lg:hidden px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-900 text-white px-4 py-3 space-y-1 border-b border-slate-800">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg ${
                    activeTab === item.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Viewport Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              summary={dashboard}
              loading={loadingData}
              onNavigate={(tab) => setActiveTab(tab)}
              onAskQuestion={handleAskFromAnywhere}
              onCompleteTask={handleCompleteTaskFromDashboard}
              onQuickCreateTask={() => {
                setOpenCreateTaskOnNav(true);
                setActiveTab('tasks');
              }}
              onQuickLogTransaction={() => {
                setOpenCreateTxOnNav(true);
                setActiveTab('money');
              }}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectsView
              projects={projects}
              loading={loadingData}
              onCreateProject={handleCreateProject}
              onUpdateProject={handleUpdateProject}
              onArchiveProject={handleArchiveProject}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              projects={projects}
              loading={loadingData}
              initialOpenCreate={openCreateTaskOnNav}
              onClearInitialCreate={() => setOpenCreateTaskOnNav(false)}
              onCreateTask={handleCreateTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {activeTab === 'money' && (
            <MoneyView
              transactions={transactions}
              projects={projects}
              loading={loadingData}
              initialOpenCreate={openCreateTxOnNav}
              onClearInitialCreate={() => setOpenCreateTxOnNav(false)}
              onCreateTransaction={handleCreateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {activeTab === 'github' && (
            <GitHubView
              githubState={githubState}
              projects={projects}
              loading={loadingData}
              onRefreshGitHub={handleRefreshGitHub}
              onLookupTarget={handleLookupGitHubTarget}
              onDisconnectGitHub={handleDisconnectGitHub}
              onLinkRepoToProject={handleLinkRepoToProject}
              onAskAboutRepos={handleAskFromAnywhere}
            />
          )}

          {activeTab === 'ask' && (
            <AskStudioOSView initialQuestion={askQuestionPrompt} />
          )}
        </main>
      </div>
    </div>
  );
}
