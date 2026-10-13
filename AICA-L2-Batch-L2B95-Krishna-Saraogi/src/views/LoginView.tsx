/**
 * OneHR Payroll Manager - Sign-in screen
 */

import React, { useEffect, useState } from 'react';
import { ShieldCheck, LogIn } from 'lucide-react';
import { api, SessionUser } from '../services/api';

interface Props {
  onSignedIn: (user: SessionUser) => void;
}

export const LoginView: React.FC<Props> = ({ onSignedIn }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoUsers, setDemoUsers] = useState<Array<{ username: string; password: string; role: string }>>([]);

  useEffect(() => {
    api.getDemoInfo().then(info => setDemoUsers(info.users || [])).catch(() => setDemoUsers([]));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.login(username, password);
      onSignedIn(res.user);
    } catch (err: any) {
      setError(err.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-900 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-950 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-100 text-base tracking-tight">OneHR Payroll Manager</h1>
            <p className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">Indian Payroll & Statutory • FY 2026-27</p>
          </div>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="username">Username</label>
            <input
              id="username"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

          <button
            type="submit"
            disabled={busy || !username || !password}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-semibold transition"
          >
            <LogIn className="w-4 h-4" />
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {demoUsers.length > 0 && (
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="font-semibold text-slate-800">Demo sign-ins (fictional data only)</div>
              <table className="w-full">
                <tbody>
                  {demoUsers.map(u => (
                    <tr key={u.username} className="border-t border-slate-200">
                      <td className="py-1 font-mono">{u.username}</td>
                      <td className="py-1 font-mono">{u.password}</td>
                      <td className="py-1 text-slate-500">{u.role}</td>
                      <td className="py-1 text-right">
                        <button
                          type="button"
                          onClick={() => { setUsername(u.username); setPassword(u.password); }}
                          className="text-emerald-700 font-semibold hover:underline"
                        >
                          Use
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
