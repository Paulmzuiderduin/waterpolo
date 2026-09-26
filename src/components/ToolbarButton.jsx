import React from 'react';

const STYLES = {
  primary:
    'border border-[#1f6197] bg-[#1f6197] text-white hover:bg-[#194f7c] disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400',
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400',
  dark:
    'border border-[#1f6197] bg-[#1f6197] text-white hover:bg-[#194f7c] disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400'
};

const ToolbarButton = ({
  children,
  className = '',
  type = 'button',
  variant = 'secondary',
  ...props
}) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold transition ${STYLES[variant] || STYLES.secondary} ${className}`}
    {...props}
  >
    {children}
  </button>
);

export default ToolbarButton;
