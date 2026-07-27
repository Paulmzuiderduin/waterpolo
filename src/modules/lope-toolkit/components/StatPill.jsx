import React from 'react';

const StatPill = ({ label, value, tone = 'default' }) => {
  const toneClasses = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
    info: 'bg-sky-100 text-sky-700'
  };

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
      <span>{label}</span>
      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold">{value}</span>
    </span>
  );
};

export default StatPill;
