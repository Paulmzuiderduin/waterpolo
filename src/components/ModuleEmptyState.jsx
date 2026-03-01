import React from 'react';

const ModuleEmptyState = ({ title, description, actions = [], compact = false }) => (
  <div
    className={`rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 ${
      compact ? 'px-4 py-4' : 'px-5 py-5'
    }`}
  >
    <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
    <p className="mt-1 text-sm text-slate-600">{description}</p>
    {actions.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              action.variant === 'secondary'
                ? 'border border-slate-200 bg-white text-slate-700'
                : 'bg-slate-900 text-white'
            }`}
            onClick={action.onClick}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

export default ModuleEmptyState;
