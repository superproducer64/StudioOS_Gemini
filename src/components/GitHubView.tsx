import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  GitCommit,
  RefreshCw,
  Search,
  Sparkles,
  Unlink,
} from 'lucide-react';
import {
  GitHubConnectionState,
  GitHubRepoStatus,
  Project,
} from '../types/studioos.ts';
import { studioApi } from '../lib/supabaseClient.ts';

interface GitHubViewProps {
  githubState: GitHubConnectionState | null;
  projects: Project[];
  loading: boolean;
  onRefreshGitHub: (force?: boolean) => Promise<void>;
  onLookupTarget: (target: string) => Promise<void>;
  onDisconnectGitHub: () => Promise<void>;
  onLinkRepoToProject: (projectId: string, repoFullName: string | null) => Promise<void>;
  onAskAboutRepos: (question: string) => void;
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const hours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function ciStatusPresentation(status: GitHubRepoStatus['ci_status']): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'passing':
      return { label: 'CI Passing', className: 'text-emerald-700 font-semibold' };
    case 'failing':
      return { label: 'CI Failing', className: 'text-red-700 font-semibold' };
    case 'pending':
      return { label: 'CI Pending', className: 'text-amber-700 font-semibold' };
    case 'unknown':
    default:
      return { label: 'No Workflow', className: 'text-slate-500' };
  }
}

export const GitHubView: React.FC<GitHubViewProps> = ({
  githubState,
  projects,
  loading,
  onRefreshGitHub,
  onLookupTarget,
  onDisconnectGitHub,
  onLinkRepoToProject,
  onAskAboutRepos,
}) => {
  const [lookupInput, setLookupInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LINKED' | 'FAILING_OR_ISSUES'>('ALL');

  // Listen for OAuth popup completion postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setOauthNotice(null);
        setShowSetupGuide(false);
        onRefreshGitHub(true);
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setOauthNotice(event.data.error || 'GitHub OAuth failed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onRefreshGitHub]);

  const handleConnectOAuth = async () => {
    setOauthNotice(null);
    try {
      const authInfo = await studioApi.getGitHubAuthUrl();
      if (!authInfo.configured || !authInfo.url) {
        setShowSetupGuide(true);
        setOauthNotice(
          'GitHub OAuth credentials (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET) are not set yet. Follow the setup guide below, or use the Live GitHub Lookup bar to check public repositories immediately.'
        );
        return;
      }

      const authWindow = window.open(
        authInfo.url,
        'github_oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        setOauthNotice(
          'Popup window was blocked by the browser. Please allow popups for this site and click Connect GitHub again.'
        );
      }
    } catch (err: any) {
      setOauthNotice(err.message || 'Unable to initiate GitHub OAuth flow.');
    }
  };

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupInput.trim()) return;
    setLookupLoading(true);
    setOauthNotice(null);
    try {
      await onLookupTarget(lookupInput.trim());
    } catch (err: any) {
      setOauthNotice(err.message || 'Could not fetch GitHub repository data.');
    } finally {
      setLookupLoading(false);
    }
  };

  const repos = githubState?.repos || [];
  const totalOpenIssues = repos.reduce((sum, r) => sum + r.open_issues_count, 0);
  const totalOpenPrs = repos.reduce((sum, r) => sum + r.open_prs_count, 0);
  const failingReposCount = repos.filter((r) => r.ci_status === 'failing').length;
  const linkedReposCount = repos.filter((r) => Boolean(r.linked_project_id)).length;

  const filteredRepos = repos.filter((r) => {
    if (statusFilter === 'LINKED') return Boolean(r.linked_project_id);
    if (statusFilter === 'FAILING_OR_ISSUES') {
      return r.ci_status === 'failing' || r.open_issues_count > 0;
    }
    return true;
  });

  const devCallbackUrl =
    'https://ais-dev-zskwmz2t4mn56wbxyovyrt-441960441183.us-west1.run.app/auth/github/callback';
  const sharedCallbackUrl =
    'https://ais-pre-zskwmz2t4mn56wbxyovyrt-441960441183.us-west1.run.app/auth/github/callback';

  return (
    <div className="space-y-6">
      {/* Header & Connection Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">GitHub Repositories</h2>
          <p className="text-sm text-slate-600">
            Monitor repository activity, latest commits, CI build status, and open issues across BGP Studios projects.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() =>
              onAskAboutRepos(
                'Review our GitHub repositories, CI build statuses, and open issues alongside active projects. What needs attention?'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask StudioOS about Repos</span>
          </button>

          <button
            onClick={() => onRefreshGitHub(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Status</span>
          </button>

          {githubState?.auth_mode === 'oauth' ? (
            <button
              onClick={onDisconnectGitHub}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Disconnect @{githubState.username}</span>
            </button>
          ) : (
            <button
              onClick={handleConnectOAuth}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Connect GitHub (OAuth)</span>
            </button>
          )}
        </div>
      </div>

      {/* Connection & Public Repo Lookup Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              {githubState?.auth_mode === 'oauth' ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected via GitHub OAuth (@{githubState.username})
                </span>
              ) : githubState?.auth_mode === 'public_lookup' ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Live GitHub API Lookup ({githubState.tracked_owner})
                </span>
              ) : (
                <span className="text-slate-700 font-medium">
                  Showing BGP Studios Repository Slate ({githubState?.tracked_owner || 'bgp-studios'})
                </span>
              )}
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <button
                type="button"
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                className="text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                {showSetupGuide ? 'Hide OAuth Setup Guide' : 'OAuth Callback & Setup Info'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Connect private repositories via GitHub OAuth or enter any public GitHub user, organization, or{' '}
              <code className="font-mono text-slate-700">owner/repo</code> to inspect live status.
            </p>
          </div>

          <form
            onSubmit={handleLookupSubmit}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto lg:min-w-96"
          >
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Check GitHub user/org or owner/repo..."
              aria-label="GitHub user, organization, or repository"
              className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="submit"
              disabled={lookupLoading}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{lookupLoading ? 'Checking...' : 'Check Live Status'}</span>
            </button>
            {githubState?.auth_mode === 'public_lookup' && (
              <button
                type="button"
                onClick={onDisconnectGitHub}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap cursor-pointer"
              >
                Reset to BGP Slate
              </button>
            )}
          </form>
        </div>

        {oauthNotice && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <span>{oauthNotice}</span>
          </div>
        )}

        {showSetupGuide && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs text-slate-700">
            <div className="font-semibold text-slate-900">
              GitHub OAuth App Configuration (For Private Repo Access)
            </div>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>
                Open{' '}
                <a
                  href="https://github.com/settings/developers"
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-900 font-medium underline"
                >
                  GitHub Developer Settings → OAuth Apps
                </a>{' '}
                and create a new OAuth App.
              </li>
              <li>
                Set the <strong>Authorization callback URL</strong> to one of your environment URLs:
                <div className="mt-1 space-y-1 pl-4 font-mono tabular-nums text-slate-800">
                  <div>Development: {devCallbackUrl}</div>
                  <div>Shared / Deployed: {sharedCallbackUrl}</div>
                </div>
              </li>
              <li>
                Add <code className="font-mono">GITHUB_CLIENT_ID</code> and{' '}
                <code className="font-mono">GITHUB_CLIENT_SECRET</code> in the AI Studio Secrets panel, then click{' '}
                <strong>Connect GitHub (OAuth)</strong>.
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Summary Metrics Grid */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-5">
          <div className="text-xs text-slate-500">Tracked Repositories</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {repos.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Owner: <span className="font-mono">{githubState?.tracked_owner || 'bgp-studios'}</span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">Linked Studio Projects</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {linkedReposCount} / {projects.filter((p) => p.status !== 'Archived').length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Synced with active StudioOS slate
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">Open Issues &amp; PRs</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {totalOpenIssues}
            <span className="text-sm font-normal text-slate-500 ml-1.5">
              issues · {totalOpenPrs} PRs
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across tracked repositories
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">CI / Workflow Health</div>
          <div
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              failingReposCount > 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {failingReposCount > 0 ? `${failingReposCount} Failing` : 'All Nominal'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Latest branch workflow status
          </div>
        </div>
      </div>

      {/* Repositories Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {[
              { id: 'ALL', label: 'All Repositories' },
              { id: 'LINKED', label: 'Linked to Projects' },
              { id: 'FAILING_OR_ISSUES', label: 'Needs Attention (CI / Issues)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
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

          <span className="text-xs font-mono tabular-nums text-slate-500">
            Showing {filteredRepos.length} of {repos.length} repositories
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading GitHub repository status...
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">
              No repositories match this filter.
            </p>
            <p className="text-xs text-slate-500">
              Switch filter tabs or check another GitHub organization above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50/60">
                  <th className="py-3 px-4 font-medium">Repository &amp; Branch</th>
                  <th className="py-3 px-4 font-medium">Linked Studio Project</th>
                  <th className="py-3 px-4 font-medium">Latest Commit</th>
                  <th className="py-3 px-4 font-medium">CI · Issues</th>
                  <th className="py-3 px-4 font-medium text-right">Last Push</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredRepos.map((repo) => {
                  const ci = ciStatusPresentation(repo.ci_status);
                  return (
                    <tr
                      key={repo.id}
                      className="hover:bg-slate-50/70 transition-colors align-top"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <a
                            href={repo.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-slate-900 hover:underline inline-flex items-center gap-1"
                          >
                            <span>{repo.full_name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        </div>
                        {repo.description && (
                          <div className="text-xs text-slate-500 mt-0.5 max-w-md">
                            {repo.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <span className="font-mono tabular-nums">
                            branch: {repo.default_branch}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{repo.private ? 'Private' : 'Public'}</span>
                          {repo.language && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{repo.language}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          aria-label={`Link ${repo.full_name} to project`}
                          value={repo.linked_project_id || ''}
                          onChange={(e) => {
                            const selectedProjId = e.target.value;
                            if (selectedProjId) {
                              onLinkRepoToProject(selectedProjId, repo.full_name);
                            } else if (repo.linked_project_id) {
                              onLinkRepoToProject(repo.linked_project_id, null);
                            }
                          }}
                          className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                        >
                          <option value="">— Unlinked —</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.status})
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3.5 px-4 max-w-sm">
                        {repo.latest_commit ? (
                          <div className="space-y-0.5">
                            <div className="text-xs text-slate-800 truncate">
                              {repo.latest_commit.message}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-500">
                              <GitCommit className="w-3 h-3" />
                              <span>{repo.latest_commit.sha}</span>
                              <span aria-hidden="true">·</span>
                              <span>{repo.latest_commit.author}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No recent commit data</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                        <div className={ci.className}>{ci.label}</div>
                        <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                          {repo.open_issues_count} open issues
                          {repo.open_prs_count > 0 ? ` · ${repo.open_prs_count} PRs` : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-right text-slate-600 whitespace-nowrap">
                        <div>{repo.pushed_at.split('T')[0]}</div>
                        <div className="text-slate-400">
                          {formatRelativeTime(repo.pushed_at)}
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
