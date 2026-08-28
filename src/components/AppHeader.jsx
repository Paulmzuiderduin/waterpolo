import React from 'react';

const AppHeader = ({
  seasons,
  selectedSeasonId,
  onSelectSeason,
  teamOptions,
  selectedTeamId,
  onSelectTeam,
  matches,
  selectedMatchId,
  onSelectMatch,
  onOpenSetup,
  onSignOut
}) => (
  <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-4">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-700">Waterpolo Hub</p>
        <span className="text-xs text-slate-300">/</span>
        <h1 className="truncate text-base font-semibold text-slate-900">Shotmap</h1>
      </div>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
        <select aria-label="Season" className="max-w-[8.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700" value={selectedSeasonId} onChange={(event) => onSelectSeason(event.target.value)}>
          {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
        </select>
        <select aria-label="Team" className="max-w-[8.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700" value={selectedTeamId} onChange={(event) => onSelectTeam(event.target.value)}>
          {teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
        <select aria-label="Active match" className="max-w-[10rem] rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1.5 text-xs font-semibold text-cyan-900" value={selectedMatchId || ''} onChange={(event) => onSelectMatch(event.target.value)}>
          <option value="">Select match</option>
          {matches.map((match) => <option key={match.info.id} value={match.info.id}>{match.info.name}</option>)}
        </select>
        <button className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-xs font-semibold text-cyan-800" onClick={onOpenSetup}>Setup</button>
        <button className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  </header>
);

export default AppHeader;
