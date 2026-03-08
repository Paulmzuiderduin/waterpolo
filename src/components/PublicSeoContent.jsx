import React from 'react';

const PublicSeoContent = () => (
  <section className="rounded-2xl bg-white p-6 shadow-sm">
    <h2 className="text-xl font-semibold text-slate-900">Waterpolo Hub for Coaches and Teams</h2>
    <p className="mt-2 text-sm text-slate-600">
      Waterpolo Hub combines shot tracking, scoring logs, possession mapping, player reports, and local video analysis
      in one workflow. Data is organized per season and team for practical match preparation.
    </p>
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-800">Shotmap & Analytics</h3>
        <p className="mt-1 text-xs text-slate-600">
          Track shots on a water polo field and analyze outcomes, zones, and distances with filters.
        </p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-800">Scoring & Possessions</h3>
        <p className="mt-1 text-xs text-slate-600">
          Log match events and pass sequences to evaluate team decision-making and performance trends.
        </p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-800">Video Analysis</h3>
        <p className="mt-1 text-xs text-slate-600">
          Clip local MP4 footage, add tactical drawings, and export snippets without cloud video storage.
        </p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-semibold text-slate-800">Player Reports</h3>
        <p className="mt-1 text-xs text-slate-600">
          Generate player-focused summaries from shot and scoring data across selected matches.
        </p>
      </article>
    </div>
    <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
      <a
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-cyan-700"
        href="/water-polo-scoring-app.html"
      >
        Water polo scoring app
      </a>
      <a
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-cyan-700"
        href="/water-polo-statistics-app.html"
      >
        Water polo statistics app
      </a>
      <a
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-cyan-700"
        href="/water-polo-shotmap-app.html"
      >
        Water polo shotmap app
      </a>
    </div>
    <a
      className="mt-3 inline-block text-xs font-semibold text-cyan-700 underline"
      href="/docs/waterpolo-quickstart.html"
      target="_blank"
      rel="noreferrer"
    >
      Read quickstart guide (3 minutes)
    </a>
  </section>
);

export default PublicSeoContent;
