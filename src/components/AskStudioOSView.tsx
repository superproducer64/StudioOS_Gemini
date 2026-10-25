import React, { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { AgentResponse } from '../types/studioos.ts';
import { studioApi } from '../lib/supabaseClient.ts';

interface AskStudioOSViewProps {
  initialQuestion?: string;
}

const SUGGESTED_QUESTIONS = [
  'What should I work on?',
  'Which client obligations and unbilled hours need immediate attention?',
  'What are my overdue tasks and release blockers this week?',
  'How are our monthly cash flow and unbilled revenue looking?',
];

export const AskStudioOSView: React.FC<AskStudioOSViewProps> = ({
  initialQuestion,
}) => {
  const [question, setQuestion] = useState(
    initialQuestion || 'What should I work on?'
  );
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async (promptToAsk: string) => {
    const cleanPrompt = promptToAsk.trim() || 'What should I work on?';
    setQuestion(cleanPrompt);
    setLoading(true);
    setError(null);
    try {
      const res = await studioApi.askStudioOS(cleanPrompt);
      setResponse(res);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze studio priorities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis(initialQuestion || 'What should I work on?');
  }, [initialQuestion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runAnalysis(question);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ask StudioOS</h2>
          <p className="text-sm text-slate-600">
            AI Chief-of-Staff analysis across BGP Studios projects, tasks, deadlines, and finances.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Read-Only Advisory Mode (v0.1)</span>
        </div>
      </div>

      {/* Prompt Input Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label
            htmlFor="studioos-question-input"
            className="block text-xs font-semibold text-slate-700"
          >
            Ask your operating question
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="studioos-question-input"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What should I work on?"
              className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing Studio Data...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Ask StudioOS</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Suggested Prompts */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-500">Suggested:</span>
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => runAnalysis(q)}
              disabled={loading}
              className="text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 animate-pulse">
          <div className="h-4 w-48 bg-slate-200 rounded" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-100 rounded" />
            <div className="h-3 w-5/6 bg-slate-100 rounded" />
          </div>
          <div className="h-32 w-full bg-slate-100 rounded-lg" />
        </div>
      )}

      {/* Structured Agent Response */}
      {!loading && response && (
        <div className="space-y-6">
          {/* Section 1: Verified Facts (Separated from Recommendations) */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  1. Verified Studio Facts (Live Data Snapshot)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Objective operational facts separated from recommendations
                </p>
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500">
                {response.context_summary.active_projects_evaluated} active projects ·{' '}
                {response.context_summary.open_tasks_evaluated} open tasks ·{' '}
                {response.context_summary.overdue_tasks_evaluated} overdue
              </div>
            </div>

            <div className="p-6">
              <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside">
                {response.facts.map((fact, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Section 2: Top Priorities & Recommended Next Actions */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  2. Top Recommended Priorities
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ranked by urgency, deadlines, cash/unbilled impact, client obligations, and blockers
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                Question: &ldquo;{response.question}&rdquo;
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {response.priorities.map((item, idx) => (
                <div key={idx} className="p-6 space-y-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-sm font-mono tabular-nums font-bold text-slate-900">
                        0{item.rank || idx + 1}.
                      </span>
                      <h4 className="text-base font-semibold text-slate-900">
                        {item.project_or_area}
                      </h4>
                    </div>
                    <span className="text-xs font-medium text-amber-800">
                      {item.urgency_tag}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-500">
                        Why it matters
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {item.why_it_matters}
                      </p>
                    </div>

                    <div className="space-y-1 bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
                      <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
                        <span>Recommended next action</span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 leading-relaxed">
                        {item.recommended_next_action}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Chief-of-Staff Summary & Read-Only Confirmation */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            {response.additional_notes && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 mb-1">
                  Additional Operational Guidance
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {response.additional_notes}
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
              <span>{response.read_only_notice}</span>
              <span className="font-mono tabular-nums">
                Generated {new Date(response.generated_at).toLocaleTimeString()}
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
