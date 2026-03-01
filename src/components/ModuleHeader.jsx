import React from 'react';

const ModuleHeader = ({ eyebrow, title, description, actions = null }) => (
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div>
      <p className="text-sm font-semibold text-cyan-700">{eyebrow}</p>
      <h2 className="text-2xl font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export default ModuleHeader;
