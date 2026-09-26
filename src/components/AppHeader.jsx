import React from 'react';

const AppHeader = ({
  seasons, selectedSeasonId, onSelectSeason, teamOptions, selectedTeamId, onSelectTeam,
  activeTab, onSelectTab, onOpenSetup, onSignOut
}) => (
  <header className="wp-topbar sticky top-0 z-40 px-3 py-2 sm:px-4">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
        <p className="hidden text-xs font-semibold text-slate-300 lg:block">Waterpolo Hub</p>
        <nav aria-label="Workspace tabs" className="flex gap-1">
          {['shotmap', 'matches', 'roster', 'analytics'].map((tab) => (
            <button key={tab} aria-current={activeTab === tab ? 'page' : undefined}
              className={`rounded px-2 py-2 text-sm font-semibold ${activeTab === tab ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
              onClick={() => onSelectTab(tab)}>{tab === 'shotmap' ? 'Shotmap' : tab[0].toUpperCase() + tab.slice(1)}</button>
          ))}
        </nav>
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:flex sm:justify-end">
        <select aria-label="Season" className="min-w-0 rounded border border-slate-200 bg-white py-1.5 pl-2 pr-8 text-xs text-slate-700 sm:max-w-[9rem]" value={selectedSeasonId} onChange={(event) => onSelectSeason(event.target.value)}>
          {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
        </select>
        <select aria-label="Team" className="min-w-0 rounded border border-slate-200 bg-white py-1.5 pl-2 pr-8 text-xs text-slate-700 sm:max-w-[9rem]" value={selectedTeamId} onChange={(event) => onSelectTeam(event.target.value)}>
          {teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
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
