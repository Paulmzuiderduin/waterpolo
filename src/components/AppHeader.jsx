import React from 'react';

const AppHeader = ({
  activeModuleLabel,
  selectedSeasonName,
  selectedTeamName,
  userEmail,
  seasons,
  selectedSeasonId,
  onSelectSeason,
  teamOptions,
  selectedTeamId,
  onSelectTeam,
  activeModule,
  onSelectModule,
  onSignOut,
  onManageWorkspace
}) => (
  <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-4">
    <div className="mx-auto flex max-w-7xl flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-700">
          Waterpolo Hub
        </p>
        <span className="text-xs text-slate-300">/</span>
        <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{activeModuleLabel}</h1>
      </div>
      <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
        <div className="flex flex-nowrap gap-1 rounded-2xl bg-slate-100 p-1 overflow-x-auto">
            {[
              { key: 'matches', label: 'Matches' },
              { key: 'roster', label: 'Roster' },
              { key: 'scoring', label: 'Scoring' },
              { key: 'shotmap', label: 'Shotmap' },
              { key: 'statsheet', label: 'Stat Sheet' }
            ].map((item) => (
              <button
                key={item.key}
                className={`whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
                  activeModule === item.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                onClick={() => onSelectModule?.(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 lg:min-w-[28rem] lg:justify-end">
          <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Season
            </span>
            <select
              className="max-w-[9.5rem] truncate bg-transparent text-sm font-medium text-slate-700 outline-none"
              value={selectedSeasonId}
              onChange={(event) => onSelectSeason(event.target.value)}
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Team
            </span>
            <select
              className="max-w-[9.5rem] truncate bg-transparent text-sm font-medium text-slate-700 outline-none"
              value={selectedTeamId}
              onChange={(event) => onSelectTeam(event.target.value)}
              disabled={teamOptions.length === 0}
            >
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
            {onManageWorkspace && (
              <button
                className="rounded-xl border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
                onClick={onManageWorkspace}
              >
                Seasons &amp; Teams
              </button>
            )}
            {onSignOut && (
              <button
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                onClick={onSignOut}
              >
                Sign out
              </button>
            )}
          </div>
        </div>
    </div>
  </header>
);

export default AppHeader;
