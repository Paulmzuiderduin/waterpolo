import React from 'react';

const entries = [
  {
    date: '2026-03-08',
    items: [
      'Added stat sheet CSV import with preview, warnings, and import report.',
      'Added mobile live scoring redesign and live mode controls.',
      'Added SEO landing pages for scoring, statistics, and shotmap searches.'
    ]
  },
  {
    date: '2026-03-07',
    items: [
      'Added stat sheet architecture and separated scoring-driven team stats.',
      'Improved request feature flow and workspace persistence.'
    ]
  },
  {
    date: '2026-03-01',
    items: ['Refined shotmap entry workflow and feedback options.']
  }
];

const ChangelogView = () => (
  <div className="space-y-6">
    <div>
      <p className="text-sm font-semibold text-cyan-700">Changelog</p>
      <h2 className="text-2xl font-semibold text-slate-900">Product Updates</h2>
      <p className="mt-2 text-sm text-slate-500">
        Recent feature releases and important fixes for Waterpolo Hub.
      </p>
    </div>

    <div className="space-y-4">
      {entries.map((entry) => (
        <section key={entry.date} className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{entry.date}</div>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {entry.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  </div>
);

export default ChangelogView;
