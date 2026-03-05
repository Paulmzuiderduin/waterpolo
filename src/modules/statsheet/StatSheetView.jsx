import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import ModuleHeader from '../../components/ModuleHeader';
import ModuleEmptyState from '../../components/ModuleEmptyState';
import ToolbarButton from '../../components/ToolbarButton';
import { buildStatSheet, exportStatSheetCsv } from '../../lib/waterpolo/statSheet';
import { normalizeScoringEventType } from '../../lib/waterpolo/scoring';

const getMatchId = (match) => match.id || match.info?.id || '';
const getMatchName = (match) => match.name || match.info?.name || 'Match';
const getMatchOpponent = (match) => match.opponent_name || match.info?.opponent_name || match.info?.opponent || '';
const getMatchDate = (match) => match.date || match.info?.date || '';

const StatSheetView = ({ teamId, loadData, onOpenModule, toast }) => {
  const [roster, setRoster] = useState([]);
  const [matches, setMatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scope, setScope] = useState('season');
  const [matchId, setMatchId] = useState('');

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    const load = async () => {
      try {
        const payload = await loadData(teamId);
        if (!active) return;
        setRoster(payload.roster || []);
        setMatches(payload.matches || []);
        setEvents(
          (payload.events || []).map((evt) => ({
            ...evt,
            event_type: normalizeScoringEventType(evt.event_type)
          }))
        );
        const sorted = [...(payload.matches || [])].sort((a, b) => {
          const ad = getMatchDate(a) ? new Date(getMatchDate(a)).getTime() : 0;
          const bd = getMatchDate(b) ? new Date(getMatchDate(b)).getTime() : 0;
          return bd - ad;
        });
        setMatchId(getMatchId(sorted[0]) || '');
        setError('');
      } catch (e) {
        if (active) setError('Could not load stat sheet data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [teamId, loadData]);

  const sortedMatches = useMemo(
    () =>
      [...matches].sort((a, b) => {
        const ad = getMatchDate(a) ? new Date(getMatchDate(a)).getTime() : 0;
        const bd = getMatchDate(b) ? new Date(getMatchDate(b)).getTime() : 0;
        return bd - ad;
      }),
    [matches]
  );

  const sheet = useMemo(
    () =>
      buildStatSheet({
        roster,
        matches,
        events,
        scope,
        matchId: scope === 'match' ? matchId : ''
      }),
    [events, matchId, matches, roster, scope]
  );

  const handleExport = () => {
    if (!sheet.rows.length) {
      toast?.('No stat sheet rows to export.', 'error');
      return;
    }
    const scopeLabel =
      scope === 'match'
        ? `Match ${sortedMatches.find((match) => getMatchId(match) === matchId)?.name || ''}`.trim()
        : 'Season';
    const csv = exportStatSheetCsv({
      rows: sheet.rows,
      total: sheet.total,
      scopeLabel
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `waterpolo-stat-sheet-${scopeLabel.toLowerCase().replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-10 text-slate-700">Loading...</div>;

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="Stat Sheet"
        title="Match & Season Stat Sheet"
        description="Summary table built from scoring events for match review and season-level player reporting."
        actions={
          <ToolbarButton variant="primary" onClick={handleExport} disabled={!sheet.rows.length}>
            <Download size={16} />
            Export CSV
          </ToolbarButton>
        }
      />

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {matches.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <ModuleEmptyState
            title="No matches yet"
            description="Create a match first, then record events in Scoring to populate the stat sheet."
            actions={[
              { label: 'Open Matches', onClick: () => onOpenModule?.('matches') },
              { label: 'Open Scoring', onClick: () => onOpenModule?.('scoring') }
            ]}
          />
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-600">
                <button
                  className={`rounded-full px-3 py-1 ${scope === 'match' ? 'bg-white text-slate-900' : ''}`}
                  onClick={() => setScope('match')}
                >
                  Match
                </button>
                <button
                  className={`rounded-full px-3 py-1 ${scope === 'season' ? 'bg-white text-slate-900' : ''}`}
                  onClick={() => setScope('season')}
                >
                  Season
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 sm:flex sm:items-center sm:gap-4">
                <span>Events: {sheet.summary.events}</span>
                <span>Shots: {sheet.summary.shots}</span>
                <span>Personal fouls: {sheet.summary.personalFouls}</span>
                <span>Timeouts: {sheet.summary.timeouts}</span>
              </div>
            </div>

            {scope === 'match' && (
              <div className="mt-3">
                <label className="text-xs font-semibold text-slate-500">Selected match</label>
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={matchId}
                  onChange={(event) => setMatchId(event.target.value)}
                >
                  {sortedMatches.map((match) => (
                    <option key={getMatchId(match)} value={getMatchId(match)}>
                      {getMatchName(match)}
                      {getMatchOpponent(match) ? ` vs ${getMatchOpponent(match)}` : ''} · {getMatchDate(match)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            {sheet.rows.length === 0 ? (
              <ModuleEmptyState
                title="No scoring events for this scope"
                description={
                  scope === 'match'
                    ? 'Use the Scoring module to log events for this match.'
                    : 'Use the Scoring module to log events across the season.'
                }
                actions={[{ label: 'Open Scoring', onClick: () => onOpenModule?.('scoring') }]}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1120px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Player</th>
                      <th className="px-3 py-2 text-right">Matches</th>
                      <th className="px-3 py-2 text-right">Events</th>
                      <th className="px-3 py-2 text-right">Shots</th>
                      <th className="px-3 py-2 text-right">Goals</th>
                      <th className="px-3 py-2 text-right">Saved</th>
                      <th className="px-3 py-2 text-right">Missed</th>
                      <th className="px-3 py-2 text-right">Shot %</th>
                      <th className="px-3 py-2 text-right">Excl F</th>
                      <th className="px-3 py-2 text-right">Pen F</th>
                      <th className="px-3 py-2 text-right">Pers F</th>
                      <th className="px-3 py-2 text-right">Ord F</th>
                      <th className="px-3 py-2 text-right">TO Won</th>
                      <th className="px-3 py-2 text-right">TO Lost</th>
                      <th className="px-3 py-2 text-right">Misconduct</th>
                      <th className="px-3 py-2 text-right">Violent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.map((row) => (
                      <tr key={row.playerId || row.capNumber} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-700">{row.name}</td>
                        <td className="px-3 py-2 text-right">{row.matches}</td>
                        <td className="px-3 py-2 text-right">{row.totalEvents}</td>
                        <td className="px-3 py-2 text-right">{row.shots}</td>
                        <td className="px-3 py-2 text-right">{row.shotGoals}</td>
                        <td className="px-3 py-2 text-right">{row.shotSaved}</td>
                        <td className="px-3 py-2 text-right">{row.shotMissed}</td>
                        <td className="px-3 py-2 text-right">{row.shotPct}%</td>
                        <td className="px-3 py-2 text-right">{row.exclusionFouls}</td>
                        <td className="px-3 py-2 text-right">{row.penaltyFouls}</td>
                        <td className="px-3 py-2 text-right">{row.personalFouls}</td>
                        <td className="px-3 py-2 text-right">{row.ordinaryFouls}</td>
                        <td className="px-3 py-2 text-right">{row.turnoversWon}</td>
                        <td className="px-3 py-2 text-right">{row.turnoversLost}</td>
                        <td className="px-3 py-2 text-right">{row.misconducts}</td>
                        <td className="px-3 py-2 text-right">{row.violentActions}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-800">
                      <td className="px-3 py-2">Team total</td>
                      <td className="px-3 py-2 text-right">{sheet.total.matches}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.totalEvents}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.shots}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.shotGoals}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.shotSaved}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.shotMissed}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.shotPct}%</td>
                      <td className="px-3 py-2 text-right">{sheet.total.exclusionFouls}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.penaltyFouls}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.personalFouls}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.ordinaryFouls}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.turnoversWon}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.turnoversLost}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.misconducts}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.violentActions}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default StatSheetView;
