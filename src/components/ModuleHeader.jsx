import React from 'react';

const ModuleHeader = ({ eyebrow, title, description, actions = null }) => (
  <div className="flex flex-wrap items-start justify-between gap-2 wp-module-header py-2 sm:py-3">
    <div className="min-w-0">
      <p className="hidden text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1f6197] sm:block">{eyebrow}</p>
      <h2 className="mt-0.5 text-lg font-semibold text-slate-900 sm:text-[26px]">{title}</h2>
      {description ? <p className="mt-1 hidden max-w-3xl text-sm text-slate-500 sm:block">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export default ModuleHeader;
