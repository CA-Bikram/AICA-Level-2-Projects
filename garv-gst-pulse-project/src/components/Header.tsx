import React from 'react';
import { User } from 'firebase/auth';
import {
  FileText,
  ShieldCheck,
  HardDrive,
  Mail,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';
import { googleSignIn, logout, getPermanentConnectionDetails } from '../services/googleAuth';
import { GarvLogo } from './GarvLogo';

interface HeaderProps {
  user: User | null;
  accessToken: string | null;
  onAuthChange: (user: User | null, token: string | null) => void;
  taxtmiSynced: boolean;
  newsletterStatus: 'DRAFT' | 'VERIFIED' | 'DISPATCHED';
  driveSaved: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  accessToken,
  onAuthChange,
  taxtmiSynced,
  newsletterStatus,
  driveSaved,
}) => {
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [authNotice, setAuthNotice] = React.useState<string | null>(null);
  const [show403Modal, setShow403Modal] = React.useState(false);

  const permDetails = getPermanentConnectionDetails();
  const isConnected = (user !== null && accessToken !== null) || permDetails.isConnected;
  const displayEmail = user?.email || permDetails.email || 'anshumadocuments@gmail.com';
  const displayName = user?.displayName || displayEmail.split('@')[0];

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthNotice(null);
    try {
      const result = await googleSignIn();
      if (result) {
        onAuthChange(result.user, result.accessToken);
        setAuthNotice(null);
      } else {
        // User closed or dismissed the popup
        setAuthNotice('Sign-in cancelled. Click anytime to connect Google Drive & Gmail.');
        setTimeout(() => setAuthNotice(null), 5000);
      }
    } catch (e: any) {
      if (e.message === 'OAUTH_TESTING_MODE_ACCESS_DENIED') {
        setShow403Modal(true);
        setAuthNotice('Google Error 403: App is in Testing Mode. Click "Fix 403 Error" for steps.');
      } else {
        setAuthNotice(e.message || 'Unable to connect to Google. Please check popup permissions.');
        setTimeout(() => setAuthNotice(null), 7000);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    onAuthChange(null, null);
    setAuthNotice(null);
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Logo & Subtitle */}
          <div className="flex items-center space-x-3">
            <GarvLogo className="h-10" />
            <div className="hidden sm:block border-l border-slate-700 pl-3">
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold tracking-tight text-white">Garv GST Pulse</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Practitioner Automation
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Indirect Tax Intelligence • 2-Page Word (.docx) &amp; PDF • Google Drive &amp; Gmail Dispatch
              </p>
            </div>
          </div>

          {/* Integration Status Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                taxtmiSynced
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800'
              }`}
              title="Real-time statutory tax intelligence synchronization status"
            >
              <span className={`w-2 h-2 rounded-full ${taxtmiSynced ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>Tax Intelligence: {taxtmiSynced ? 'Live Synced' : 'Sync Needed'}</span>
            </div>

            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                driveSaved
                  ? 'bg-blue-950/60 text-blue-300 border-blue-800'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Drive: {driveSaved ? 'Synced in Drive' : 'Local Draft'}</span>
            </div>

            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                newsletterStatus === 'VERIFIED'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : newsletterStatus === 'DISPATCHED'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Status: {newsletterStatus}</span>
            </div>
          </div>

          {/* Google Workspace Authentication */}
          <div className="flex items-center space-x-3">
            {isConnected ? (
              <div className="flex items-center space-x-2 bg-slate-800/90 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-xs">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={displayName}
                    className="w-6 h-6 rounded-full border border-blue-400/50"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                    {(displayName || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col text-left">
                  <span className="font-medium text-slate-200 truncate max-w-[140px]" title={displayEmail}>
                    {displayEmail}
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center font-medium">
                    <ShieldCheck className="w-2.5 h-2.5 mr-0.5 text-emerald-400" /> Drive: Permanently Connected
                  </span>
                </div>
                <button
                  onClick={handleSignIn}
                  title="Refresh or switch Google Account"
                  className="px-2 py-0.5 bg-blue-900 hover:bg-blue-800 text-[10px] text-blue-200 hover:text-white rounded border border-blue-700 font-medium transition ml-1 cursor-pointer"
                >
                  Refresh
                </button>
                <button
                  onClick={handleSignOut}
                  title="Sign out of Google"
                  className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-end">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                    className="inline-flex items-center space-x-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg shadow transition-all border border-slate-300 active:scale-95 disabled:opacity-75"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>{isSigningIn ? 'Connecting...' : 'Connect Google Drive & Gmail'}</span>
                  </button>
                  <button
                    onClick={() => setShow403Modal(true)}
                    title="Fix 'Access blocked: Error 403 access_denied'"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-400/50 transition-colors flex items-center space-x-1 text-xs"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span className="hidden sm:inline text-[11px] font-medium">Fix 403 Error</span>
                  </button>
                </div>
                {authNotice && (
                  <span className="text-[10px] text-amber-300 mt-1 max-w-[280px] text-right font-medium">
                    {authNotice}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 403 Testing Mode Resolution Modal */}
      {show403Modal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-xl w-full text-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-800/90 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Resolving Google OAuth "Error 403: access_denied"
                  </h3>
                  <p className="text-xs text-slate-400">
                    Why <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded">garvassociatesnewsletter@gmail.com</code> was blocked
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShow403Modal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs font-sans">
              <div className="p-3.5 bg-blue-950/40 border border-blue-800/50 rounded-xl leading-relaxed text-blue-200">
                <strong>Why this error occurs:</strong> In Google Cloud projects (Project ID: <code className="text-white font-mono bg-blue-900/60 px-1.5 py-0.5 rounded">gen-lang-client-0153898364</code>), the OAuth Consent Screen is in <strong>Testing Mode</strong>. In testing mode, Google security blocks any Google account that has not been explicitly added as a <strong>Test User</strong>.
              </div>

              {/* Solution 1 */}
              <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-400">Option 1: Instant Sign-In (No Configuration Needed)</span>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded">Fastest</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Sign in with the Google Cloud project developer account:
                </p>
                <div className="p-2 bg-slate-950 rounded border border-slate-700 font-mono text-emerald-300 flex items-center justify-between">
                  <span>anshumadocuments@gmail.com</span>
                  <span className="text-[10px] text-slate-400">Pre-approved project owner</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  When clicking "Connect Google Drive & Gmail", choose <strong>anshumadocuments@gmail.com</strong>.
                </p>
              </div>

              {/* Solution 2 */}
              <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2.5">
                <span className="font-bold text-sm text-amber-400">
                  Option 2: Authorize <code className="text-white">garvassociatesnewsletter@gmail.com</code>
                </span>
                <p className="text-slate-300 leading-relaxed">
                  To sign in with your firm's email address, add it to the Google Cloud Console Test Users list:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-1 leading-relaxed">
                  <li>
                    Open the Google Cloud Console for project <strong className="text-white">gen-lang-client-0153898364</strong>.
                  </li>
                  <li>
                    Scroll down to the <strong>Test users</strong> section and click <strong>+ ADD USERS</strong>.
                  </li>
                  <li>
                    Add <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded">garvassociatesnewsletter@gmail.com</code> and click <strong>Save</strong>.
                  </li>
                </ol>
                <div className="pt-1">
                  <a
                    href="https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0153898364"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors"
                  >
                    <span>Open Google Cloud Console OAuth Screen</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Note on Google Verification warning */}
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                <strong className="text-slate-200">Note when logging in:</strong> Google may show <em>"Google hasn't verified this app"</em>. Click <strong>Advanced</strong> &gt; <strong>Go to gen-lang-client-0153898364 (unsafe)</strong> &gt; <strong>Continue</strong> to grant Drive &amp; Gmail permissions.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-800/90 px-6 py-3 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setShow403Modal(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Got It, Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
