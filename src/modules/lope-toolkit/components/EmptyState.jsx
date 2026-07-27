import React from 'react';

const EmptyState = ({ title, description, action }) => {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
};

export default EmptyState;
