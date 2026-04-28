import React from 'react';

const AppHeader = ({
  activeModuleLabel,
  activeModuleDescription,
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
  onSignOut
}) => (
  <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
    <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Waterpolo Hub</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">{activeModuleLabel}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{activeModuleDescription}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700">
            Season: {selectedSeasonName}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700">
            Team: {selectedTeamName}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-500">
            {userEmail}
          </span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[34rem]">
        <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
          {[
            { key: 'scoring', label: 'Scoring' },
            { key: 'shotmap', label: 'Shotmap' },
            { key: 'statsheet', label: 'Stat Sheet' }
          ].map((item) => (
            <button
              key={item.key}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                activeModule === item.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => onSelectModule?.(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 lg:min-w-[22rem]">
        <label className="block">
          <span className="mb-1 hidden text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:block">
            Season
          </span>
          <select
            className="w-full truncate rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 sm:py-2.5"
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
        <label className="block">
          <span className="mb-1 hidden text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:block">
            Team
          </span>
          <select
            className="w-full truncate rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 sm:py-2.5"
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
        <div className="col-span-2 flex justify-end pt-1">
          {onSignOut && (
            <button
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              onClick={onSignOut}
            >
              Sign out
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  </header>
);

export default AppHeader;
