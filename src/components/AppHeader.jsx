import React from 'react';

const AppHeader = ({
  selectedSeasonName,
  selectedTeamName,
  userEmail,
  seasons,
  selectedSeasonId,
  onSelectSeason,
  teamOptions,
  selectedTeamId,
  onSelectTeam
}) => (
  <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 px-6 py-4 backdrop-blur-md">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Water Polo Platform</p>
        <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">Good evening, Paul</h1>
        <p className="text-xs text-slate-500">
          {selectedSeasonName} · {selectedTeamName} · {userEmail}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <select
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
          value={selectedSeasonId}
          onChange={(event) => onSelectSeason(event.target.value)}
        >
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
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
      </div>
    </div>
  </header>
);

export default AppHeader;
