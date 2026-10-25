import React, { useState } from 'react';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { isBrowserSupabaseConfigured, supabaseBrowserClient } from '../lib/supabaseClient.ts';

interface LoginViewProps {
  onLoginSuccess: (email: string, password?: string) => Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('bgp.studios.hou@gmail.com');
  const [password, setPassword] = useState('bgp-studio-01');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isBrowserSupabaseConfigured && supabaseBrowserClient) {
        const { error: sbError } = await supabaseBrowserClient.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (sbError) {
          // Fall through to server auth validation if local dev credentials used
          console.warn('Supabase client sign-in notice:', sbError.message);
        }
      }
      await onLoginSuccess(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">StudioOS</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              BGP Studios · Internal Operating System &amp; Chief of Staff
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">v0.1</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Primary Owner Sign In</h2>
            <p className="text-sm text-slate-600 mt-1">
              Authenticate via Supabase Auth to access projects, tasks, financial activity, and Ask StudioOS.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Owner Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                placeholder="bgp.studios.hou@gmail.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password / Studio Access Key
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                placeholder="••••••••••••"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{loading ? 'Signing in...' : 'Sign In to StudioOS'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <p>Single-user configuration for BGP Studios (Version 0.1).</p>
            <p className="font-mono tabular-nums">
              Auth mode: {isBrowserSupabaseConfigured ? 'Supabase Auth (Live)' : 'Supabase Auth Ready (Local Owner Session)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
