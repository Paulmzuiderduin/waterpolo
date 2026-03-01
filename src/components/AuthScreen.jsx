import React from 'react';
import PublicSeoContent from './PublicSeoContent';

const AuthScreen = ({ authEmail, setAuthEmail, authMessage, onSendMagicLink, overlays }) => (
  <div className="min-h-screen px-6 py-8">
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-cyan-700">Water Polo Platform</p>
        <h1 className="text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-slate-500">
          Track water polo shotmaps, scoring events, possessions, and local video snippets.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.15fr]">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <label className="text-xs font-semibold text-slate-500">Email</label>
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="you@example.com"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
          />
          <button
            className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={onSendMagicLink}
          >
            Send magic link
          </button>
          <button
            className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            onClick={onSendMagicLink}
          >
            Resend link
          </button>
          {authMessage && <div className="mt-3 text-sm text-slate-500">{authMessage}</div>}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">How the magic link works</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-slate-600">
              <li>
                Enter your email address and click{' '}
                <span className="font-semibold text-slate-900">Send magic link</span>.
              </li>
              <li>You will receive a Supabase sign-in email.</li>
              <li>Open the email and click the confirmation link to sign in to Waterpolo Hub.</li>
            </ol>
            <div className="mt-4 space-y-1 text-xs text-slate-500">
              <div>
                <span className="font-semibold text-slate-700">Sender:</span> usually{' '}
                <span className="font-mono">Supabase Auth</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Subject:</span> usually{' '}
                <span className="font-mono">Confirm Your Signup</span>
              </div>
              <div>If you do not see the email, check your spam folder first.</div>
            </div>
          </div>
        </div>
        <PublicSeoContent />
      </div>
    </div>
    {overlays}
  </div>
);

export default AuthScreen;
