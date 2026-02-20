import React from 'react';

const SettingsView = ({
  moduleConfig,
  moduleVisibility,
  onToggle,
  onReset,
  preferences,
  onSetPreference
}) => (
  <div className="space-y-6">
    <div>
      <p className="text-sm font-semibold text-cyan-700">Settings</p>
      <h2 className="text-2xl font-semibold text-slate-900">Workspace Preferences</h2>
      <p className="mt-2 text-sm text-slate-500">Choose which modules you want to see in the sidebar.</p>
    </div>

    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Module visibility</h3>
        <button
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
          onClick={onReset}
        >
          Reset to default
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {moduleConfig
          .filter((item) => !item.alwaysVisible)
          .map((item) => {
            const enabled = moduleVisibility[item.key] !== false;
            return (
              <label
                key={item.key}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  {item.icon}
                  {item.label}
                </span>
                <input type="checkbox" checked={enabled} onChange={() => onToggle(item.key)} />
              </label>
            );
          })}
      </div>
    </div>

    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">General</h3>
      <div className="mt-4 space-y-3">
        <label className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Remember last opened module</span>
          <input
            type="checkbox"
            checked={Boolean(preferences.rememberLastTab)}
            onChange={(event) => onSetPreference('rememberLastTab', event.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Show Hub workflow tips</span>
          <input
            type="checkbox"
            checked={Boolean(preferences.showHubTips)}
            onChange={(event) => onSetPreference('showHubTips', event.target.checked)}
          />
        </label>
      </div>
    </div>
  </div>
);

export default SettingsView;
