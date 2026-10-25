import fs from 'fs';
import path from 'path';
import {
  GitHubConnectionState,
  GitHubRepoStatus,
  Project,
} from '../types/studioos.ts';
import { StudioRepository } from '../server/repository.ts';

interface StoredGitHubSession {
  accessToken: string | null;
  username: string | null;
  avatarUrl: string | null;
  trackedOwner: string;
  cachedPublicRepos?: GitHubRepoStatus[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const GITHUB_STATE_FILE = path.join(DATA_DIR, 'github-state.json');

function readGitHubState(): StoredGitHubSession {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(GITHUB_STATE_FILE)) {
      const raw = fs.readFileSync(GITHUB_STATE_FILE, 'utf-8');
      return JSON.parse(raw) as StoredGitHubSession;
    }
  } catch (err) {
    console.error('Error reading GitHub state file:', err);
  }
  return {
    accessToken: null,
    username: null,
    avatarUrl: null,
    trackedOwner: process.env.GITHUB_DEFAULT_OWNER || 'bgp-studios',
  };
}

function writeGitHubState(state: StoredGitHubSession): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(GITHUB_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing GitHub state file:', err);
  }
}

export function isGitHubOAuthConfigured(): boolean {
  const clientId = process.env.GITHUB_CLIENT_ID || '';
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
  return (
    Boolean(clientId && clientSecret) &&
    !clientId.includes('your-github') &&
    !clientSecret.includes('your-github')
  );
}

export function getGitHubCallbackUrl(): string {
  const appUrl = (
    process.env.APP_URL ||
    'https://ais-dev-zskwmz2t4mn56wbxyovyrt-441960441183.us-west1.run.app'
  ).replace(/\/$/, '');
  return `${appUrl}/auth/github/callback`;
}

export function getGitHubAuthorizeUrl(): { url: string; configured: boolean; callbackUrl: string } {
  const callbackUrl = getGitHubCallbackUrl();
  const configured = isGitHubOAuthConfigured();
  if (!configured) {
    return {
      url: '',
      configured: false,
      callbackUrl,
    };
  }

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: callbackUrl,
    scope: 'repo read:user',
  });

  return {
    url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    configured: true,
    callbackUrl,
  };
}

export async function exchangeGitHubCodeForToken(code: string): Promise<void> {
  if (!isGitHubOAuthConfigured()) {
    throw new Error('GitHub OAuth Client ID and Secret are not configured on the server.');
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'StudioOS-BGP-Studios',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: getGitHubCallbackUrl(),
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`GitHub token exchange failed (${tokenRes.status})`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'No access_token returned from GitHub');
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'StudioOS-BGP-Studios',
    },
  });

  let username = 'github-user';
  let avatarUrl: string | null = null;
  if (userRes.ok) {
    const userJson = (await userRes.json()) as { login?: string; avatar_url?: string };
    if (userJson.login) username = userJson.login;
    if (userJson.avatar_url) avatarUrl = userJson.avatar_url;
  }

  const existing = readGitHubState();
  writeGitHubState({
    ...existing,
    accessToken: tokenData.access_token,
    username,
    avatarUrl,
    trackedOwner: username,
    cachedPublicRepos: undefined,
  });
}

export function disconnectGitHubAccount(): void {
  writeGitHubState({
    accessToken: null,
    username: null,
    avatarUrl: null,
    trackedOwner: process.env.GITHUB_DEFAULT_OWNER || 'bgp-studios',
    cachedPublicRepos: undefined,
  });
}

function linkReposToProjects(repos: GitHubRepoStatus[], projects: Project[]): GitHubRepoStatus[] {
  return repos.map((repo) => {
    const matchedProject = projects.find((p) => {
      if (p.github_repo && p.github_repo.toLowerCase() === repo.full_name.toLowerCase()) {
        return true;
      }
      const normProj = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normRepo = repo.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normProj.length > 2 && normRepo.includes(normProj);
    });

    return {
      ...repo,
      linked_project_id: matchedProject?.id || repo.linked_project_id || null,
      linked_project_name: matchedProject?.name || repo.linked_project_name || null,
    };
  });
}

function getSeedBgpStudioRepos(projects: Project[]): GitHubRepoStatus[] {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

  const seedRepos: GitHubRepoStatus[] = [
    {
      id: 'gh-caddlatch',
      name: 'caddlatch-ios',
      full_name: 'bgp-studios/caddlatch-ios',
      html_url: 'https://github.com/bgp-studios/caddlatch-ios',
      description: 'SwiftUI iOS golf yardage and caddie utility app (App Store build 1.0.4).',
      private: true,
      default_branch: 'main',
      language: 'Swift',
      open_issues_count: 2,
      open_prs_count: 1,
      stargazers_count: 4,
      ci_status: 'passing',
      updated_at: hoursAgo(6),
      pushed_at: hoursAgo(6),
      latest_commit: {
        sha: 'a8f4d21',
        message: 'fix(privacy): update App Store privacy manifest & yardage cache',
        author: 'bgp-studios',
        date: hoursAgo(6),
        url: 'https://github.com/bgp-studios/caddlatch-ios/commit/a8f4d21',
      },
      linked_project_id: 'proj-caddlatch',
      linked_project_name: 'Caddlatch',
      source: 'studio_seed',
    },
    {
      id: 'gh-pour-across-america',
      name: 'pour-across-america',
      full_name: 'bgp-studios/pour-across-america',
      html_name: 'bgp-studios/pour-across-america',
      html_url: 'https://github.com/bgp-studios/pour-across-america',
      description: 'Next.js + Supabase tasting passport & QR check-in platform for Diana.',
      private: true,
      default_branch: 'main',
      language: 'TypeScript',
      open_issues_count: 5,
      open_prs_count: 2,
      stargazers_count: 1,
      ci_status: 'failing',
      updated_at: hoursAgo(3),
      pushed_at: hoursAgo(3),
      latest_commit: {
        sha: '7c3e91b',
        message: 'feat(checkin): add venue QR webhook signature check (pending Diana copy)',
        author: 'bgp-studios',
        date: hoursAgo(3),
        url: 'https://github.com/bgp-studios/pour-across-america/commit/7c3e91b',
      },
      linked_project_id: 'proj-pour-across-america',
      linked_project_name: 'Pour Across America',
      source: 'studio_seed',
    } as GitHubRepoStatus,
    {
      id: 'gh-mars-roofing',
      name: 'mars-roofing-web',
      full_name: 'bgp-studios/mars-roofing-web',
      html_url: 'https://github.com/bgp-studios/mars-roofing-web',
      description: 'Mars Roofing & Exteriors lead capture site and storm-damage intake funnel.',
      private: true,
      default_branch: 'main',
      language: 'TypeScript',
      open_issues_count: 1,
      open_prs_count: 0,
      stargazers_count: 0,
      ci_status: 'passing',
      updated_at: hoursAgo(28),
      pushed_at: hoursAgo(28),
      latest_commit: {
        sha: '4b190ef',
        message: 'chore(analytics): log September storm lead form conversions',
        author: 'bgp-studios',
        date: hoursAgo(28),
        url: 'https://github.com/bgp-studios/mars-roofing-web/commit/4b190ef',
      },
      linked_project_id: 'proj-mars-roofing',
      linked_project_name: 'Mars Roofing',
      source: 'studio_seed',
    },
    {
      id: 'gh-intro-app',
      name: 'intro-app',
      full_name: 'bgp-studios/intro-app',
      html_url: 'https://github.com/bgp-studios/intro-app',
      description: 'Warm introduction and relationship graph SaaS (Closed Beta).',
      private: true,
      default_branch: 'main',
      language: 'TypeScript',
      open_issues_count: 8,
      open_prs_count: 1,
      stargazers_count: 9,
      ci_status: 'passing',
      updated_at: hoursAgo(19),
      pushed_at: hoursAgo(19),
      latest_commit: {
        sha: 'e2109ca',
        message: 'feat(onboarding): simplify mutual contact import step for beta cohort',
        author: 'bgp-studios',
        date: hoursAgo(19),
        url: 'https://github.com/bgp-studios/intro-app/commit/e2109ca',
      },
      linked_project_id: 'proj-intro',
      linked_project_name: 'Intro',
      source: 'studio_seed',
    },
    {
      id: 'gh-fab-mvp',
      name: 'fab-mvp',
      full_name: 'bgp-studios/fab-mvp',
      html_url: 'https://github.com/bgp-studios/fab-mvp',
      description: 'Early architecture and prototype scaffold for FAB.',
      private: true,
      default_branch: 'main',
      language: 'TypeScript',
      open_issues_count: 3,
      open_prs_count: 0,
      stargazers_count: 2,
      ci_status: 'pending',
      updated_at: hoursAgo(96),
      pushed_at: hoursAgo(96),
      latest_commit: {
        sha: '19d44a0',
        message: 'docs(spec): initial domain schema draft',
        author: 'bgp-studios',
        date: hoursAgo(96),
        url: 'https://github.com/bgp-studios/fab-mvp/commit/19d44a0',
      },
      linked_project_id: 'proj-fab',
      linked_project_name: 'FAB',
      source: 'studio_seed',
    },
    {
      id: 'gh-signalos',
      name: 'signalos',
      full_name: 'bgp-studios/signalos',
      html_url: 'https://github.com/bgp-studios/signalos',
      description: 'Signal ingestion and market briefing pipeline prototype.',
      private: true,
      default_branch: 'main',
      language: 'Python',
      open_issues_count: 2,
      open_prs_count: 0,
      stargazers_count: 3,
      ci_status: 'unknown',
      updated_at: hoursAgo(140),
      pushed_at: hoursAgo(140),
      latest_commit: {
        sha: '90f12bc',
        message: 'init: feed parser configuration scaffold',
        author: 'bgp-studios',
        date: hoursAgo(140),
        url: 'https://github.com/bgp-studios/signalos/commit/90f12bc',
      },
      linked_project_id: 'proj-signalos',
      linked_project_name: 'SignalOS',
      source: 'studio_seed',
    },
  ];

  return linkReposToProjects(seedRepos, projects);
}

async function enrichGitHubRepoItem(
  rawRepo: any,
  headers: Record<string, string>,
  source: 'oauth' | 'public_api'
): Promise<GitHubRepoStatus> {
  let latestCommit: GitHubRepoStatus['latest_commit'] = null;
  let ciStatus: GitHubRepoStatus['ci_status'] = 'unknown';

  try {
    const [commitsRes, runsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${rawRepo.full_name}/commits?per_page=1`, { headers }),
      fetch(`https://api.github.com/repos/${rawRepo.full_name}/actions/runs?per_page=1`, { headers }),
    ]);

    if (commitsRes.ok) {
      const commits = (await commitsRes.json()) as any[];
      if (Array.isArray(commits) && commits[0]) {
        latestCommit = {
          sha: String(commits[0].sha || '').slice(0, 7),
          message: String(commits[0].commit?.message || '').split('\n')[0],
          author:
            commits[0].author?.login ||
            commits[0].commit?.author?.name ||
            rawRepo.owner?.login ||
            'unknown',
          date: commits[0].commit?.author?.date || rawRepo.pushed_at || new Date().toISOString(),
          url: commits[0].html_url || rawRepo.html_url,
        };
      }
    }

    if (runsRes.ok) {
      const runsData = (await runsRes.json()) as { workflow_runs?: any[] };
      const latestRun = runsData.workflow_runs?.[0];
      if (latestRun) {
        if (latestRun.status !== 'completed') {
          ciStatus = 'pending';
        } else if (latestRun.conclusion === 'success') {
          ciStatus = 'passing';
        } else if (
          latestRun.conclusion === 'failure' ||
          latestRun.conclusion === 'timed_out'
        ) {
          ciStatus = 'failing';
        }
      } else {
        ciStatus = 'passing';
      }
    }
  } catch {
    // Keep default commit/ci fallback if rate limited
  }

  return {
    id: String(rawRepo.id || rawRepo.full_name),
    name: rawRepo.name,
    full_name: rawRepo.full_name,
    html_url: rawRepo.html_url,
    description: rawRepo.description || null,
    private: Boolean(rawRepo.private),
    default_branch: rawRepo.default_branch || 'main',
    language: rawRepo.language || null,
    open_issues_count: Number(rawRepo.open_issues_count || 0),
    open_prs_count: 0,
    stargazers_count: Number(rawRepo.stargazers_count || 0),
    ci_status: ciStatus,
    updated_at: rawRepo.updated_at || new Date().toISOString(),
    pushed_at: rawRepo.pushed_at || rawRepo.updated_at || new Date().toISOString(),
    latest_commit: latestCommit,
    linked_project_id: null,
    linked_project_name: null,
    source,
  };
}

export async function lookupPublicGitHubTarget(targetInput: string): Promise<GitHubConnectionState> {
  const cleaned = targetInput
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\/$/, '');

  if (!cleaned) {
    throw new Error('Please enter a GitHub username, organization, or owner/repo.');
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'StudioOS-BGP-Studios',
  };

  const state = readGitHubState();
  if (state.accessToken) {
    headers.Authorization = `Bearer ${state.accessToken}`;
  }

  let rawRepos: any[] = [];
  if (cleaned.includes('/')) {
    // Single repository lookup (owner/repo)
    const repoRes = await fetch(`https://api.github.com/repos/${cleaned}`, { headers });
    if (!repoRes.ok) {
      throw new Error(`GitHub repository "${cleaned}" not found or inaccessible (${repoRes.status}).`);
    }
    const singleRepo = await repoRes.json();
    rawRepos = [singleRepo];
  } else {
    // User or Organization lookup
    const userReposRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(cleaned)}/repos?sort=pushed&per_page=12`,
      { headers }
    );
    if (!userReposRes.ok) {
      throw new Error(`GitHub user or organization "${cleaned}" not found (${userReposRes.status}).`);
    }
    rawRepos = (await userReposRes.json()) as any[];
  }

  const topSlice = rawRepos.slice(0, 8);
  const enriched = await Promise.all(
    topSlice.map((r) => enrichGitHubRepoItem(r, headers, 'public_api'))
  );

  const projects = await StudioRepository.getProjects(true);
  const linked = linkReposToProjects(enriched, projects);

  writeGitHubState({
    ...state,
    trackedOwner: cleaned,
    cachedPublicRepos: linked,
  });

  return getGitHubStatus(false);
}

export async function getGitHubStatus(forceRefresh = false): Promise<GitHubConnectionState> {
  const state = readGitHubState();
  const projects = await StudioRepository.getProjects(true);
  const callbackUrl = getGitHubCallbackUrl();
  const oauthConfigured = isGitHubOAuthConfigured();

  // 1. If OAuth access token is present, fetch authenticated user's repositories
  if (state.accessToken) {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${state.accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'StudioOS-BGP-Studios',
      };

      const reposRes = await fetch(
        'https://api.github.com/user/repos?sort=pushed&per_page=10&affiliation=owner,collaborator,organization_member',
        { headers }
      );

      if (reposRes.ok) {
        const rawRepos = (await reposRes.json()) as any[];
        const enriched = await Promise.all(
          rawRepos.slice(0, 8).map((r) => enrichGitHubRepoItem(r, headers, 'oauth'))
        );
        return {
          connected: true,
          oauth_configured: oauthConfigured,
          auth_mode: 'oauth',
          username: state.username,
          avatar_url: state.avatarUrl,
          tracked_owner: state.username || state.trackedOwner,
          callback_url: callbackUrl,
          repos: linkReposToProjects(enriched, projects),
        };
      }
    } catch (err) {
      console.error('Failed to fetch OAuth GitHub repos:', err);
    }
  }

  // 2. If user previously queried a public GitHub owner/repo
  if (state.cachedPublicRepos && state.cachedPublicRepos.length > 0 && !forceRefresh) {
    return {
      connected: true,
      oauth_configured: oauthConfigured,
      auth_mode: 'public_lookup',
      username: state.trackedOwner,
      avatar_url: null,
      tracked_owner: state.trackedOwner,
      callback_url: callbackUrl,
      repos: linkReposToProjects(state.cachedPublicRepos, projects),
    };
  }

  // 3. Default BGP Studios seed repository status preview
  return {
    connected: false,
    oauth_configured: oauthConfigured,
    auth_mode: 'seed_preview',
    username: null,
    avatar_url: null,
    tracked_owner: state.trackedOwner || 'bgp-studios',
    callback_url: callbackUrl,
    repos: getSeedBgpStudioRepos(projects),
  };
}
