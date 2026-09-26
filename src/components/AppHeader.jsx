import React from 'react';

const AppHeader = ({
  seasons, selectedSeasonId, onSelectSeason, teamOptions, selectedTeamId, onSelectTeam,
  matches, selectedMatchId, onSelectMatch, onOpenSetup, onSignOut
}) => (
  <header className="wp-topbar sticky top-0 z-40 px-3 py-2 sm:px-4">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <p className="text-xs font-semibold text-slate-300">Waterpolo Hub</p>
        <h1 className="text-base font-semibold text-white">Shotmap</h1>
      </div>
      <div className="order-last grid w-full grid-cols-3 gap-1.5 sm:order-none sm:flex sm:w-auto sm:flex-1 sm:justify-end">
        <select aria-label="Season" className="min-w-0 rounded border border-slate-200 bg-white py-1.5 pl-2 pr-8 text-xs text-slate-700 sm:max-w-[9rem]" value={selectedSeasonId} onChange={(event) => onSelectSeason(event.target.value)}>
          {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
        </select>
        <select aria-label="Team" className="min-w-0 rounded border border-slate-200 bg-white py-1.5 pl-2 pr-8 text-xs text-slate-700 sm:max-w-[9rem]" value={selectedTeamId} onChange={(event) => onSelectTeam(event.target.value)}>
          {teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
        <select aria-label="Active match" className="min-w-0 rounded border border-[#b9cbd9] bg-[#edf3f7] py-1.5 pl-2 pr-8 text-xs font-semibold text-cyan-900 sm:max-w-[12rem]" value={selectedMatchId || ''} onChange={(event) => onSelectMatch(event.target.value)}>
          <option value="">Select match</option>
          {matches.map((match) => <option key={match.info.id} value={match.info.id}>{match.info.name}</option>)}
        </select>
      </div>
      <details className="relative">
        <summary className="cursor-pointer rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600">Workspace</summary>
        <div className="absolute right-0 z-50 mt-2 grid w-48 gap-1 rounded border border-slate-200 bg-white p-2 shadow-lg">
          <button className="rounded px-3 py-2 text-left text-sm text-[#1f6197]" onClick={onOpenSetup}>Seasons &amp; teams</button>
          <button className="rounded px-3 py-2 text-left text-sm text-slate-600" onClick={() => window.resetAnalyticsPreferences?.()}>Analytics preferences</button>
          <button className="rounded px-3 py-2 text-left text-sm text-slate-600" onClick={onSignOut}>Sign out</button>
        </div>
      </details>
    </div>
  </header>
);

export default AppHeader;
