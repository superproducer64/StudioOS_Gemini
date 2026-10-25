import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { StudioRepository } from './src/server/repository.ts';
import { askStudioOS } from './src/services/agentService.ts';
import {
  disconnectGitHubAccount,
  exchangeGitHubCodeForToken,
  getGitHubAuthorizeUrl,
  getGitHubStatus,
  lookupPublicGitHubTarget,
} from './src/services/githubService.ts';
import { TaskStatus } from './src/types/studioos.ts';

// Dev server must run on port 3000 per environment constraints
const PORT = 3000;

const OWNER_EMAIL = process.env.STUDIOOS_OWNER_EMAIL || 'bgp.studios.hou@gmail.com';
const OWNER_NAME = process.env.STUDIOOS_OWNER_NAME || 'BGP Studios Owner';
const ACCESS_CODE = process.env.STUDIOOS_ACCESS_CODE || 'bgp-studio-01';

// Track active session state on server for v0.1 single-user flow
let currentSessionUser: {
  id: string;
  email: string;
  name: string;
  role: string;
  auth_provider: 'supabase' | 'studio-local';
} | null = {
  id: 'owner-bgp-01',
  email: OWNER_EMAIL,
  name: OWNER_NAME,
  role: 'Owner',
  auth_provider: StudioRepository.getStorageMode() === 'supabase' ? 'supabase' : 'studio-local',
};

export async function createStudioServer() {
  const app = express();
  app.use(express.json());

  // --------------------------------------------------------------------------
  // 1. HEALTH & SYSTEM STATUS
  // --------------------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '0.1.0',
      storage_mode: StudioRepository.getStorageMode(),
    });
  });

  // --------------------------------------------------------------------------
  // 2. AUTHENTICATION (Supabase Auth + Primary User v0.1 Flow)
  // --------------------------------------------------------------------------
  app.get('/api/auth/session', (_req, res) => {
    res.json({
      authenticated: Boolean(currentSessionUser),
      user: currentSessionUser,
      storage_mode: StudioRepository.getStorageMode(),
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const normalizedEmail = (email || OWNER_EMAIL).trim().toLowerCase();

      // If Supabase is configured with valid credentials, attempt Supabase Auth first
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (
        supabaseUrl &&
        supabaseAnonKey &&
        supabaseUrl.startsWith('https://') &&
        !supabaseUrl.includes('your-project-ref')
      ) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: password || ACCESS_CODE,
        });

        if (!error && data.user) {
          currentSessionUser = {
            id: data.user.id,
            email: data.user.email || normalizedEmail,
            name: data.user.user_metadata?.name || OWNER_NAME,
            role: 'Owner',
            auth_provider: 'supabase',
          };
          return res.json({
            authenticated: true,
            user: currentSessionUser,
            storage_mode: StudioRepository.getStorageMode(),
          });
        }
      }

      // Primary Owner v0.1 Authentication validation
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }

      if (password && password.trim().length < 4) {
        return res.status(401).json({ error: 'Invalid access credentials.' });
      }

      currentSessionUser = {
        id: 'owner-bgp-01',
        email: normalizedEmail,
        name: OWNER_NAME,
        role: 'Owner',
        auth_provider: 'studio-local',
      };

      res.json({
        authenticated: true,
        user: currentSessionUser,
        storage_mode: StudioRepository.getStorageMode(),
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: error.message || 'Authentication failed' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    currentSessionUser = null;
    res.json({
      authenticated: false,
      user: null,
      storage_mode: StudioRepository.getStorageMode(),
    });
  });

  // --------------------------------------------------------------------------
  // 3. DASHBOARD SUMMARY
  // --------------------------------------------------------------------------
  app.get('/api/dashboard', async (_req, res) => {
    try {
      const summary = await StudioRepository.getDashboardSummary();
      res.json(summary);
    } catch (error: any) {
      console.error('Error building dashboard summary:', error);
      res.status(500).json({ error: 'Failed to load dashboard summary' });
    }
  });

  // --------------------------------------------------------------------------
  // 4. PROJECTS ROUTES
  // --------------------------------------------------------------------------
  app.get('/api/projects', async (req, res) => {
    try {
      const includeArchived = req.query.includeArchived !== 'false';
      const projects = await StudioRepository.getProjects(includeArchived);
      res.json(projects);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to load projects' });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const { name } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Project name is required.' });
      }
      const created = await StudioRepository.createProject(req.body);
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  app.patch('/api/projects/:id', async (req, res) => {
    try {
      const updated = await StudioRepository.updateProject(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  app.post('/api/projects/:id/archive', async (req, res) => {
    try {
      const archived = await StudioRepository.archiveProject(req.params.id);
      if (!archived) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json(archived);
    } catch (error: any) {
      console.error('Error archiving project:', error);
      res.status(500).json({ error: 'Failed to archive project' });
    }
  });

  // --------------------------------------------------------------------------
  // 5. TASKS ROUTES
  // --------------------------------------------------------------------------
  app.get('/api/tasks', async (req, res) => {
    try {
      const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
      const status = req.query.status ? (String(req.query.status) as TaskStatus) : undefined;
      const tasks = await StudioRepository.getTasks({ projectId, status });
      res.json(tasks);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to load tasks' });
    }
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const { title } = req.body || {};
      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'Task title is required.' });
      }
      const created = await StudioRepository.createTask(req.body);
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  app.patch('/api/tasks/:id', async (req, res) => {
    try {
      const updated = await StudioRepository.updateTask(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    try {
      const ok = await StudioRepository.deleteTask(req.params.id);
      if (!ok) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json({ deleted: true });
    } catch (error: any) {
      console.error('Error deleting task:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  // --------------------------------------------------------------------------
  // 6. FINANCIAL TRANSACTIONS ROUTES
  // --------------------------------------------------------------------------
  app.get('/api/transactions', async (_req, res) => {
    try {
      const transactions = await StudioRepository.getTransactions();
      res.json(transactions);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Failed to load transactions' });
    }
  });

  app.post('/api/transactions', async (req, res) => {
    try {
      const { amount, type } = req.body || {};
      if (amount === undefined || Number.isNaN(Number(amount)) || Number(amount) < 0) {
        return res.status(400).json({ error: 'Valid positive transaction amount is required.' });
      }
      if (type && type !== 'Income' && type !== 'Expense') {
        return res.status(400).json({ error: 'Transaction type must be Income or Expense.' });
      }
      const created = await StudioRepository.createTransaction(req.body);
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  });

  app.delete('/api/transactions/:id', async (req, res) => {
    try {
      const ok = await StudioRepository.deleteTransaction(req.params.id);
      if (!ok) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      res.json({ deleted: true });
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      res.status(500).json({ error: 'Failed to delete transaction' });
    }
  });

  // --------------------------------------------------------------------------
  // 7. ASK STUDIOOS AGENT ENDPOINT (READ-ONLY CHIEF OF STAFF)
  // --------------------------------------------------------------------------
  app.post('/api/agent/ask', async (req, res) => {
    try {
      const { question } = req.body || {};
      const result = await askStudioOS(question);
      res.json(result);
    } catch (error: any) {
      console.error('Error in Ask StudioOS agent:', error);
      res.status(500).json({ error: error.message || 'StudioOS agent analysis failed' });
    }
  });

  // --------------------------------------------------------------------------
  // 8. SEED DATA RESET ENDPOINT
  // --------------------------------------------------------------------------
  app.post('/api/seed/reset', async (_req, res) => {
    try {
      const counts = await StudioRepository.resetToSeedData();
      res.json({ reset: true, counts });
    } catch (error: any) {
      console.error('Error resetting seed data:', error);
      res.status(500).json({ error: 'Failed to reset seed data' });
    }
  });

  // --------------------------------------------------------------------------
  // 8B. GITHUB OAUTH & REPOSITORY STATUS ROUTES
  // --------------------------------------------------------------------------
  app.get('/api/github/auth/url', (_req, res) => {
    const authInfo = getGitHubAuthorizeUrl();
    res.json(authInfo);
  });

  const githubCallbackHandler = async (req: express.Request, res: express.Response) => {
    const code = req.query.code ? String(req.query.code) : '';
    try {
      if (code) {
        await exchangeGitHubCodeForToken(code);
      }
      res.send(`
        <html>
          <body style="font-family: sans-serif; padding: 2rem; text-align: center;">
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'github' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>GitHub authentication successful. This window will close automatically.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('GitHub OAuth callback error:', error);
      res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; padding: 2rem; text-align: center;">
            <p>GitHub authentication failed: ${error.message || 'Unknown error'}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${JSON.stringify(
                  error.message || 'Authentication failed'
                )} }, '*');
              }
            </script>
          </body>
        </html>
      `);
    }
  };

  app.get(['/auth/github/callback', '/auth/github/callback/'], githubCallbackHandler);

  app.get('/api/github/status', async (req, res) => {
    try {
      const refresh = req.query.refresh === 'true';
      const status = await getGitHubStatus(refresh);
      res.json(status);
    } catch (error: any) {
      console.error('Error fetching GitHub status:', error);
      res.status(500).json({ error: error.message || 'Failed to load GitHub repository status' });
    }
  });

  app.post('/api/github/lookup', async (req, res) => {
    try {
      const { target } = req.body || {};
      const status = await lookupPublicGitHubTarget(String(target || ''));
      res.json(status);
    } catch (error: any) {
      console.error('Error in GitHub lookup:', error);
      res.status(400).json({ error: error.message || 'Unable to fetch GitHub repository data' });
    }
  });

  app.post('/api/github/disconnect', async (_req, res) => {
    try {
      disconnectGitHubAccount();
      const status = await getGitHubStatus(false);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to disconnect GitHub' });
    }
  });

  // --------------------------------------------------------------------------
  // 9. FRONTEND SERVING (VITE MIDDLEWARE IN DEV / STATIC IN PROD)
  // --------------------------------------------------------------------------
  const distPath = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  }

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  createStudioServer().then((app) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`StudioOS v0.1 server running at http://0.0.0.0:${PORT}`);
    });
  });
}
