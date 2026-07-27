import React from 'react';

const ModuleHeader = ({ eyebrow, title, description, actions = null }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">{eyebrow}</p>
      <h2 className="mt-0.5 text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h2>
      {description ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export default ModuleHeader;
