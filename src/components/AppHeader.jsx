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
  onOpenWorkspace,
  onSignOut
}) => (
  <header className="wp-surface wp-border sticky top-0 z-40 border-b px-4 py-2.5 sm:px-6 sm:py-3">
    <div className="mx-auto flex max-w-7xl flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="wp-primary-text text-xs font-semibold uppercase tracking-[0.2em]">Waterpolo Hub</p>
        <h1 className="mt-0.5 text-lg font-bold text-slate-900 sm:text-2xl lg:text-3xl">{activeModuleLabel}</h1>
        <p className="mt-1 hidden max-w-2xl text-sm text-slate-600 md:block">{activeModuleDescription}</p>
        <div className="mt-2 hidden flex-wrap items-center gap-2 text-xs lg:flex">
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
      <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:max-w-md lg:min-w-[22rem]">
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
        {(onOpenWorkspace || onSignOut) && (
          <div className="col-span-2 flex items-center gap-2 pt-1">
            {onOpenWorkspace && (
              <button
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                onClick={onOpenWorkspace}
              >
                Manage teams
              </button>
            )}
            {onSignOut && (
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                onClick={onSignOut}
              >
                Sign out
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  </header>
);

export default AppHeader;
