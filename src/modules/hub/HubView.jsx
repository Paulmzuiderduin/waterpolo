import React from 'react';

const HubView = ({ showTips }) => (
  <div className="space-y-6">
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-cyan-700">Waterpolo Hub</p>
      <h2 className="mt-1 text-2xl font-semibold text-slate-900">Welcome</h2>
      <p className="mt-3 max-w-3xl text-sm text-slate-600">
        Waterpolo Hub is your central workspace for tracking matches and building insights across shotmap, analytics,
        scoring, possession, and player reporting.
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Use the sidebar to open a module. The Hub page stays focused on onboarding and workflow guidance.
      </p>
    </div>

    <div className={`grid grid-cols-1 gap-4 ${showTips ? 'lg:grid-cols-[1.4fr_1fr]' : ''}`}>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Getting Started</h3>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>Create or select a season and team.</li>
          <li>Open `Roster` and add players first.</li>
          <li>Create a match in `Matches`, then track events in `Shotmap`, `Scoring`, or `Possession`.</li>
          <li>Use `Analytics` and `Players` to review performance and export reports.</li>
        </ol>
      </div>

      {showTips && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Workflow Tips</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Track one match at a time for clean event logs.</li>
              <li>Keep player birthdays and dominant hand updated in `Roster`.</li>
              <li>Use filters in analytics and report cards before exporting.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Need definitions for zones, event types, and color legends? Open `Help` in the sidebar.
          </div>
        </div>
      )}
    </div>
  </div>
);

export default HubView;
