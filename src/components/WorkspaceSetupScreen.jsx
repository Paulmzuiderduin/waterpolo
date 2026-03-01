import React from 'react';
import { Plus } from 'lucide-react';

const WorkspaceSetupScreen = ({
  seasons,
  selectedSeason,
  selectedSeasonId,
  selectedTeamId,
  setSelectedSeasonId,
  setSelectedTeamId,
  seasonForm,
  setSeasonForm,
  teamForm,
  setTeamForm,
  createSeason,
  createTeam,
  promptAction,
  renameSeason,
  deleteSeason,
  renameTeam,
  deleteTeam,
  openFeatureRequestDialog,
  setActiveTab,
  renderUtilityDock,
  overlays
}) => (
  <div className="min-h-screen px-6 py-8">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-cyan-700">Water Polo Platform</p>
        <h1 className="text-3xl font-semibold">Seasons & Teams</h1>
        <p className="mt-2 text-sm text-slate-500">Select a season and team, or create new folders.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Seasons</h2>
          <div className="mt-3 space-y-2">
            {seasons.length === 0 && <div className="text-sm text-slate-500">No seasons yet.</div>}
            {seasons.map((season) => (
              <div
                key={season.id}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedSeasonId === season.id
                    ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                    : 'border-slate-100 text-slate-600'
                }`}
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => {
                    setSelectedSeasonId(season.id);
                    setSelectedTeamId('');
                  }}
                >
                  <span className="font-medium">{season.name}</span>
                </button>
                <span className="mr-3 text-xs text-slate-400">{season.teams?.length || 0} teams</span>
                <button
                  className="text-xs font-semibold text-slate-500"
                  onClick={async () => {
                    const next = await promptAction('New season name', season.name);
                    if (next != null) renameSeason(season.id, next);
                  }}
                >
                  Rename
                </button>
                <button
                  className="ml-2 text-xs font-semibold text-red-500"
                  onClick={() => deleteSeason(season.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="New season"
              value={seasonForm}
              onChange={(event) => setSeasonForm(event.target.value)}
            />
            <button
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              onClick={createSeason}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Teams</h2>
            {selectedSeason ? (
              <div className="mt-3 space-y-2">
                {(selectedSeason.teams || []).length === 0 && (
                  <div className="text-sm text-slate-500">No teams in this season.</div>
                )}
                {(selectedSeason.teams || []).map((team) => (
                  <div
                    key={team.id}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                      selectedTeamId === team.id
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                        : 'border-slate-100 text-slate-600'
                    }`}
                  >
                    <button className="flex-1 text-left" onClick={() => setSelectedTeamId(team.id)}>
                      <span className="font-medium">{team.name}</span>
                    </button>
                    <button
                      className="text-xs font-semibold text-slate-500"
                      onClick={async () => {
                        const next = await promptAction('New team name', team.name);
                        if (next != null) renameTeam(selectedSeason.id, team.id, next);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className="ml-2 text-xs font-semibold text-red-500"
                      onClick={() => deleteTeam(selectedSeason.id, team.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500">Select a season first.</div>
            )}
            <div className="mt-4 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder={selectedSeason ? 'New team' : 'Select season first'}
                value={teamForm}
                onChange={(event) => setTeamForm(event.target.value)}
                disabled={!selectedSeason}
              />
              <button
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={createTeam}
                disabled={!selectedSeason}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Getting started</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Create a season on the left.</li>
              <li>Select the season and create a team.</li>
              <li>Open Roster to add players.</li>
              <li>Create a match in Matches, then open Shotmap to start tracking shots.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
    <footer className="mx-auto mt-8 max-w-5xl px-6 pb-8 text-xs text-slate-500">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
        <span>© {new Date().getFullYear()} Waterpolo Shotmap & Analytics</span>
        <div className="flex items-center gap-4">
          <button
            className="font-semibold text-cyan-700 underline decoration-transparent transition hover:decoration-current"
            onClick={openFeatureRequestDialog}
          >
            Request Feature
          </button>
          <button
            className="font-semibold text-slate-700 underline decoration-transparent transition hover:decoration-current"
            onClick={() => setActiveTab('privacy')}
          >
            Privacy
          </button>
        </div>
      </div>
    </footer>
    {renderUtilityDock()}
    {overlays}
  </div>
);

export default WorkspaceSetupScreen;
