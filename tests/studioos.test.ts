import assert from 'node:assert/strict';
import { StudioRepository } from '../src/server/repository.ts';
import { askStudioOS } from '../src/services/agentService.ts';
import {
  PriorityLevel,
  ProjectStatus,
  TaskStatus,
  TransactionType,
} from '../src/types/studioos.ts';
import {
  draft_email,
  get_calendar,
  get_github_repos,
  get_overdue_tasks,
  get_projects,
  get_tasks,
  get_transactions,
} from '../src/services/tools/index.ts';
import { getGitHubAuthorizeUrl } from '../src/services/githubService.ts';

async function runTests() {
  console.log('Running StudioOS v0.1 verification suite...');

  // 1. Reset to clean BGP Studios seed data
  const seedCounts = await StudioRepository.resetToSeedData();
  assert.equal(seedCounts.projects, 6, 'Should seed 6 BGP Studios projects');
  assert.ok(seedCounts.tasks >= 6, 'Should seed initial tasks');
  assert.ok(seedCounts.transactions >= 4, 'Should seed initial financial transactions');

  // 2. Verify seed projects match BGP Studios specification
  const projects = await get_projects(false);
  const projectNames = projects.map((p) => p.name);
  for (const expectedName of [
    'Caddlatch',
    'Pour Across America',
    'Mars Roofing',
    'Intro',
    'FAB',
    'SignalOS',
  ]) {
    assert.ok(
      projectNames.includes(expectedName),
      `Expected seed project "${expectedName}" to exist`
    );
  }

  // 3. Test Project CRUD (Create, Update, Archive)
  const createdProj = await StudioRepository.createProject({
    name: 'Test Internal Tool',
    status: ProjectStatus.Idea,
    priority: PriorityLevel.Low,
    next_action: 'Validate prototype',
  });
  assert.equal(createdProj.name, 'Test Internal Tool');

  const updatedProj = await StudioRepository.updateProject(createdProj.id, {
    status: ProjectStatus.Active,
    priority: PriorityLevel.High,
  });
  assert.equal(updatedProj?.status, ProjectStatus.Active);
  assert.equal(updatedProj?.priority, PriorityLevel.High);

  const archivedProj = await StudioRepository.archiveProject(createdProj.id);
  assert.equal(archivedProj?.status, ProjectStatus.Archived);

  // 4. Test Task CRUD & Overdue detection
  const overdueBefore = await get_overdue_tasks();
  assert.ok(overdueBefore.length >= 2, 'Should detect overdue tasks in seed data');

  const newTask = await StudioRepository.createTask({
    project_id: 'proj-caddlatch',
    title: 'Prepare v1.0.5 release notes',
    status: TaskStatus.Open,
    priority: PriorityLevel.Normal,
  });
  assert.equal(newTask.title, 'Prepare v1.0.5 release notes');
  assert.equal(newTask.completed_at, null);

  const completedTask = await StudioRepository.updateTask(newTask.id, {
    status: TaskStatus.Completed,
  });
  assert.equal(completedTask?.status, TaskStatus.Completed);
  assert.ok(completedTask?.completed_at, 'Completing task should set completed_at timestamp');

  const deletedTask = await StudioRepository.deleteTask(newTask.id);
  assert.equal(deletedTask, true);

  // 5. Test Financial Transactions CRUD & Dashboard Totals
  const txListBefore = await get_transactions();
  const createdTx = await StudioRepository.createTransaction({
    project_id: 'proj-mars-roofing',
    type: TransactionType.Income,
    amount: 500,
    category: 'Client Development',
    description: 'Emergency landing page update',
    client: 'Mars Roofing & Exteriors',
  });
  assert.equal(createdTx.amount, 500);

  const summary = await StudioRepository.getDashboardSummary();
  assert.ok(summary.income_this_month >= 5250, 'Monthly income should include new transaction');
  assert.ok(summary.needs_attention.length > 0, 'Needs Attention should surface top items');

  await StudioRepository.deleteTransaction(createdTx.id);
  const txListAfter = await get_transactions();
  assert.equal(txListAfter.length, txListBefore.length);

  // 6. Test Future Tool Stubs are safely disabled in v0.1
  const emailStub = await draft_email({
    to: 'test@example.com',
    subject: 'Test',
    body: 'Hello',
  });
  assert.equal(emailStub.status, 'disabled_in_v0_1');

  const calendarStub = await get_calendar();
  assert.equal(calendarStub.status, 'disabled_in_v0_1');

  // 6B. Test GitHub Repository Status & OAuth URL helper
  const ghRepos = await get_github_repos();
  assert.ok(ghRepos.length >= 6, 'Should return BGP Studios repositories');
  assert.ok(
    ghRepos.some((r) => r.linked_project_name === 'Caddlatch'),
    'Should link Caddlatch repository to Caddlatch project'
  );
  const authUrlInfo = getGitHubAuthorizeUrl();
  assert.ok(
    authUrlInfo.callbackUrl.endsWith('/auth/github/callback'),
    'GitHub OAuth callback URL must end with /auth/github/callback'
  );

  // 7. Test Ask StudioOS Agent Service
  const agentRes = await askStudioOS('What should I work on?');
  assert.equal(agentRes.question, 'What should I work on?');
  assert.ok(Array.isArray(agentRes.facts) && agentRes.facts.length > 0, 'Should return facts');
  assert.ok(
    Array.isArray(agentRes.priorities) &&
      agentRes.priorities.length > 0 &&
      agentRes.priorities.length <= 3,
    'Should return up to 3 top priorities'
  );
  for (const p of agentRes.priorities) {
    assert.ok(p.project_or_area, 'Priority must include project_or_area');
    assert.ok(p.why_it_matters, 'Priority must include why_it_matters');
    assert.ok(p.recommended_next_action, 'Priority must include recommended_next_action');
  }

  // Restore clean seed state after test run
  await StudioRepository.resetToSeedData();
  console.log('All StudioOS v0.1 tests passed successfully.');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
