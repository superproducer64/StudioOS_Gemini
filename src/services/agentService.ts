import { GoogleGenAI, Type } from '@google/genai';
import {
  AgentPriorityRecommendation,
  AgentResponse,
  PriorityLevel,
  ProjectStatus,
  TaskStatus,
} from '../types/studioos.ts';
import {
  get_github_repos,
  get_overdue_tasks,
  get_projects,
  get_tasks,
  get_transactions,
} from './tools/index.ts';
import { StudioRepository } from '../server/repository.ts';

export const STUDIOOS_SYSTEM_INSTRUCTION = `You are StudioOS, the operating assistant for BGP Studios.

Your role is to help the owner understand what deserves attention.

Review the supplied projects, tasks, deadlines, and financial information.

Prioritize based on urgency, deadlines, money, blocked work, client obligations, and project importance.

Give clear, practical recommendations.

Do not overwhelm the user.

When asked what should be worked on, return no more than three primary priorities unless the user asks for more.

For each priority provide:

Project or area
Why it matters
Recommended next action

Separate facts from recommendations.

Never claim an action was completed unless the system confirms it.

IMPORTANT VERSION 0.1 READ-ONLY RULES:
- You are strictly read-only in version 0.1.
- You CANNOT send emails, delete data, modify financial records automatically, publish websites, make purchases, send payments, change calendar events, or perform destructive operations.
- If the user asks you to perform a write or external action, explicitly state that StudioOS v0.1 is read-only and provide the exact recommended manual next step instead.`;

interface StructuredOperationalContext {
  current_date: string;
  active_and_planned_projects: Array<{
    name: string;
    status: string;
    priority: string;
    client: string | null;
    revenue_model: string | null;
    unbilled_amount: number;
    next_action: string | null;
    due_date: string | null;
  }>;
  overdue_tasks: Array<{
    title: string;
    project_name: string | null;
    priority: string;
    status: string;
    due_date: string | null;
  }>;
  open_and_waiting_tasks: Array<{
    title: string;
    project_name: string | null;
    priority: string;
    status: string;
    due_date: string | null;
  }>;
  upcoming_deadlines: Array<{
    type: string;
    title: string;
    project_name: string | null;
    priority: string;
    due_date: string;
    days_remaining: number;
  }>;
  financial_snapshot: {
    income_this_month: number;
    expenses_this_month: number;
    net_income_this_month: number;
    unbilled_work_total: number;
    recent_transactions: Array<{
      date: string;
      type: string;
      amount: number;
      category: string;
      client: string | null;
      project_name: string | null;
      description: string;
      notes: string | null;
    }>;
  };
  github_repositories: Array<{
    full_name: string;
    linked_project_name: string | null;
    ci_status: string;
    open_issues_count: number;
    open_prs_count: number;
    latest_commit_message: string | null;
    pushed_at: string;
  }>;
}

export async function collectOperationalContext(): Promise<StructuredOperationalContext> {
  const [projects, allTasks, overdueTasks, transactions, dashboard, githubRepos] =
    await Promise.all([
      get_projects(false),
      get_tasks(),
      get_overdue_tasks(),
      get_transactions(),
      StudioRepository.getDashboardSummary(),
      get_github_repos(),
    ]);

  const openTasks = allTasks.filter((t) => t.status !== TaskStatus.Completed);

  return {
    current_date: new Date().toISOString().split('T')[0],
    active_and_planned_projects: projects.map((p) => ({
      name: p.name,
      status: p.status,
      priority: p.priority,
      client: p.client,
      revenue_model: p.revenue_model,
      unbilled_amount: Number(p.unbilled_amount || 0),
      next_action: p.next_action,
      due_date: p.due_date,
    })),
    overdue_tasks: overdueTasks.map((t) => ({
      title: t.title,
      project_name: t.project_name || null,
      priority: t.priority,
      status: t.status,
      due_date: t.due_date,
    })),
    open_and_waiting_tasks: openTasks.map((t) => ({
      title: t.title,
      project_name: t.project_name || null,
      priority: t.priority,
      status: t.status,
      due_date: t.due_date,
    })),
    upcoming_deadlines: dashboard.upcoming_deadlines.map((d) => ({
      type: d.type,
      title: d.title,
      project_name: d.project_name,
      priority: d.priority,
      due_date: d.due_date,
      days_remaining: d.days_remaining,
    })),
    financial_snapshot: {
      income_this_month: dashboard.income_this_month,
      expenses_this_month: dashboard.expenses_this_month,
      net_income_this_month: dashboard.net_income_this_month,
      unbilled_work_total: dashboard.unbilled_work_total,
      recent_transactions: transactions.slice(0, 8).map((tx) => ({
        date: tx.transaction_date,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        client: tx.client,
        project_name: tx.project_name || null,
        description: tx.description,
        notes: tx.notes,
      })),
    },
    github_repositories: githubRepos.map((r) => ({
      full_name: r.full_name,
      linked_project_name: r.linked_project_name,
      ci_status: r.ci_status,
      open_issues_count: r.open_issues_count,
      open_prs_count: r.open_prs_count,
      latest_commit_message: r.latest_commit?.message || null,
      pushed_at: r.pushed_at,
    })),
  };
}

function buildDeterministicPriorities(
  question: string,
  ctx: StructuredOperationalContext
): Omit<AgentResponse, 'provider' | 'generated_at' | 'context_summary'> {
  const facts: string[] = [
    `Active/Review projects: ${
      ctx.active_and_planned_projects.filter(
        (p) => p.status === ProjectStatus.Active || p.status === ProjectStatus.Review
      ).length
    } (${ctx.active_and_planned_projects.length} total non-archived projects).`,
    `Open tasks: ${ctx.open_and_waiting_tasks.length} total, with ${ctx.overdue_tasks.length} overdue and ${
      ctx.open_and_waiting_tasks.filter((t) => t.status === TaskStatus.Waiting).length
    } waiting on external input.`,
    `Monthly cash flow: $${ctx.financial_snapshot.income_this_month.toLocaleString()} income vs. $${ctx.financial_snapshot.expenses_this_month.toLocaleString()} expenses (Net: $${ctx.financial_snapshot.net_income_this_month.toLocaleString()}).`,
    `Unbilled / outstanding work tracked across active projects: $${ctx.financial_snapshot.unbilled_work_total.toLocaleString()}.`,
  ];

  const priorities: AgentPriorityRecommendation[] = [];

  // Priority 1: Overdue / Unbilled high-priority client work (e.g. Pour Across America)
  const paa = ctx.active_and_planned_projects.find((p) =>
    p.name.toLowerCase().includes('pour across america')
  );
  if (paa || ctx.financial_snapshot.unbilled_work_total > 0) {
    priorities.push({
      rank: 1,
      project_or_area: paa ? `${paa.name} (Client: ${paa.client || 'Diana'})` : 'Unbilled Client Work & Overdue Tasks',
      why_it_matters: paa
        ? `High-priority active client project with $${paa.unbilled_amount.toLocaleString()} in unbilled development hours and an overdue task to reconcile sprint hours.`
        : `There is $${ctx.financial_snapshot.unbilled_work_total.toLocaleString()} in unbilled work that directly impacts studio cash flow and client billing clarity.`,
      recommended_action_helper: undefined,
      recommended_next_action:
        paa?.next_action || 'Review unbilled development hours and prepare summary for Diana.',
      urgency_tag: 'Money & Overdue Deadline',
    } as AgentPriorityRecommendation);
  }

  // Priority 2: High-priority app release in Review (e.g. Caddlatch)
  const caddlatch = ctx.active_and_planned_projects.find((p) =>
    p.name.toLowerCase().includes('caddlatch')
  );
  if (caddlatch) {
    priorities.push({
      rank: priorities.length + 1,
      project_or_area: `${caddlatch.name} (${caddlatch.status})`,
      why_it_matters: `High-priority product ($2.99 app purchase model) currently in App Store review with an overdue review-check task that could block launch revenue if Apple requested metadata changes.`,
      recommended_next_action:
        caddlatch.next_action || 'Check App Store Connect review status and Resolution Center.',
      urgency_tag: 'Release Blocker · High Priority',
    });
  }

  // Priority 3: Recurring Client Obligation (e.g. Mars Roofing) or remaining top active project
  const mars = ctx.active_and_planned_projects.find((p) =>
    p.name.toLowerCase().includes('mars roofing')
  );
  if (mars && priorities.length < 3) {
    priorities.push({
      rank: priorities.length + 1,
      project_or_area: `${mars.name} (Client: ${mars.client || 'Mars Roofing & Exteriors'})`,
      why_it_matters: `Active recurring monthly service client ($1,250/mo retainer + $${mars.unbilled_amount.toLocaleString()} unbilled update) with an upcoming deadline to deliver the monthly maintenance report.`,
      recommended_next_action:
        mars.next_action || 'Prepare and review the monthly maintenance report.',
      urgency_tag: 'Client Retention · Upcoming Deadline',
    });
  }

  // Fill up to 3 if user modified or archived the defaults
  for (const proj of ctx.active_and_planned_projects) {
    if (priorities.length >= 3) break;
    if (priorities.some((pr) => pr.project_or_area.includes(proj.name))) continue;
    priorities.push({
      rank: priorities.length + 1,
      project_or_area: `${proj.name} (${proj.status})`,
      why_it_matters: `Marked ${proj.priority} priority${
        proj.due_date ? ` with due date ${proj.due_date}` : ''
      }.`,
      recommended_next_action: proj.next_action || 'Define and execute next action.',
      urgency_tag: `${proj.priority} Priority`,
    });
  }

  return {
    question,
    facts,
    priorities: priorities.slice(0, 3),
    additional_notes:
      'Lower-urgency planning initiatives (FAB and SignalOS) and Intro beta feedback remain queued after immediate revenue, overdue tasks, and App Store review items are cleared.',
    read_only_notice:
      'StudioOS v0.1 is read-only. No records, emails, or financial entries were modified automatically.',
  };
}

export async function askStudioOS(userQuestion?: string): Promise<AgentResponse> {
  const question = (userQuestion || 'What should I work on?').trim();
  const ctx = await collectOperationalContext();

  const contextSummary: AgentResponse['context_summary'] = {
    active_projects_evaluated: ctx.active_and_planned_projects.filter(
      (p) => p.status === ProjectStatus.Active || p.status === ProjectStatus.Review
    ).length,
    open_tasks_evaluated: ctx.open_and_waiting_tasks.length,
    overdue_tasks_evaluated: ctx.overdue_tasks.length,
    monthly_net_income: ctx.financial_snapshot.net_income_this_month,
    unbilled_work_total: ctx.financial_snapshot.unbilled_work_total,
  };

  const promptPayload = JSON.stringify(
    {
      owner_question: question,
      studio_operational_data: ctx,
    },
    null,
    2
  );

  // 1. Try OpenAI API if a real OPENAI_API_KEY is configured in environment
  const openAiKey = process.env.OPENAI_API_KEY;
  if (
    openAiKey &&
    openAiKey.startsWith('sk-') &&
    !openAiKey.includes('your-openai-api-key')
  ) {
    try {
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `${STUDIOOS_SYSTEM_INSTRUCTION}\n\nRespond strictly with a valid JSON object containing:\n- "facts": string[] (3-5 concise factual statements from the supplied data)\n- "priorities": Array<{ "rank": number, "project_or_area": string, "why_it_matters": string, "recommended_next_action": string, "urgency_tag": string }> (no more than 3 unless user explicitly asked for more)\n- "additional_notes": string (brief practical note or direct answer to the user's question)\n- "read_only_notice": string (confirmation that no actions were autonomously executed)`,
            },
            {
              role: 'user',
              content: promptPayload,
            },
          ],
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as any;
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            question,
            generated_at: new Date().toISOString(),
            provider: 'openai',
            facts: Array.isArray(parsed.facts) ? parsed.facts : [],
            priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
            additional_notes: parsed.additional_notes || '',
            read_only_notice:
              parsed.read_only_notice ||
              'StudioOS v0.1 is read-only. No actions were executed automatically.',
            context_summary: contextSummary,
          };
        }
      }
    } catch (err) {
      console.error('OpenAI request failed, falling back to Gemini / local analyzer:', err);
    }
  }

  // 2. Use Server-Side Gemini API (@google/genai) if GEMINI_API_KEY is available
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: promptPayload,
            config: {
              systemInstruction: STUDIOOS_SYSTEM_INSTRUCTION,
              temperature: 0.2,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  facts: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description:
                      '3 to 5 concise, objective factual observations directly verified from the supplied projects, tasks, deadlines, and financial data.',
                  },
                  priorities: {
                    type: Type.ARRAY,
                    description:
                      'Top priorities (maximum 3 unless the user explicitly asked for more).',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        rank: { type: Type.INTEGER },
                        project_or_area: {
                          type: Type.STRING,
                          description: 'Name of the project or studio area.',
                        },
                        why_it_matters: {
                          type: Type.STRING,
                          description:
                            'Clear explanation of urgency, deadline, financial/unbilled impact, client obligation, or blocker.',
                        },
                        recommended_next_action: {
                          type: Type.STRING,
                          description: 'Concrete, actionable next step for the owner.',
                        },
                        urgency_tag: {
                          type: Type.STRING,
                          description:
                            'Short urgency descriptor such as "Overdue · Unbilled Revenue" or "High Priority · App Store Review".',
                        },
                      },
                      required: [
                        'rank',
                        'project_or_area',
                        'why_it_matters',
                        'recommended_next_action',
                        'urgency_tag',
                      ],
                    },
                  },
                  additional_notes: {
                    type: Type.STRING,
                    description:
                      'Brief closing guidance or direct answer to any specific question asked by the owner.',
                  },
                  read_only_notice: {
                    type: Type.STRING,
                    description:
                      'Confirmation that StudioOS v0.1 is read-only and has not claimed or executed any unconfirmed actions.',
                  },
                },
                required: ['facts', 'priorities', 'additional_notes', 'read_only_notice'],
              },
            },
          });

          if (response.text) {
            const parsed = JSON.parse(response.text.trim());
            return {
              question,
              generated_at: new Date().toISOString(),
              provider: 'gemini',
              facts: Array.isArray(parsed.facts) ? parsed.facts : [],
              priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
              additional_notes: parsed.additional_notes || '',
              read_only_notice:
                parsed.read_only_notice ||
                'StudioOS v0.1 is read-only. No actions were executed automatically.',
              context_summary: contextSummary,
            };
          }
        } catch (modelErr: any) {
          if (modelName === candidateModels[candidateModels.length - 1]) {
            throw modelErr;
          }
        }
      }
    } catch (err) {
      console.error('Gemini API call failed, using deterministic analyzer fallback:', err);
    }
  }

  // 3. Deterministic structured fallback
  const fallback = buildDeterministicPriorities(question, ctx);
  return {
    ...fallback,
    generated_at: new Date().toISOString(),
    provider: 'deterministic-fallback',
    context_summary: contextSummary,
  };
}
