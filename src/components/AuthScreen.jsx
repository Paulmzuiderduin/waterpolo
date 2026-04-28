import React from 'react';

const AuthScreen = ({
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authMessage,
  onPasswordSignIn,
  onPasswordSignUp,
  onSendMagicLink,
  overlays
}) => (
  <div className="min-h-screen px-6 py-8">
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-cyan-700">Waterpolo Hub</p>
        <h1 className="text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-slate-500">
          Sign in to create a season, set a lineup, and score live.
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
          <label className="mt-4 block text-xs font-semibold text-slate-500">Password</label>
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="password"
            placeholder="Enter your password"
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={onPasswordSignIn}
            >
              Sign in
            </button>
            <button
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={onPasswordSignUp}
            >
              Create account
            </button>
          </div>
          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>or use a magic link</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <button
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
            onClick={onSendMagicLink}
          >
            Send magic link
          </button>
          {authMessage && <div className="mt-3 text-sm text-slate-500">{authMessage}</div>}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">How it works</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-slate-600">
              <li>
                Use your password or request a magic link.
              </li>
              <li>Sign in once, then continue straight to seasons, teams, and scoring.</li>
            </ol>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">What you can do here</h2>
          <ul className="mt-3 space-y-3 text-sm text-slate-600">
            <li>Create or choose a season.</li>
            <li>Add teams and players.</li>
            <li>Create a match, set the lineup, and score live.</li>
          </ul>
        </div>
      </div>
    </div>
    {overlays}
  </div>
);

export default AuthScreen;
