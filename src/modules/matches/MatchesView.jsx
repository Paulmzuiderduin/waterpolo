import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const MatchesView = ({
  seasonId,
  teamId,
  userId,
  confirmAction,
  toast,
  loadOverview,
  onDataUpdated
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState({
    name: 'New match',
    opponentName: '',
    date: new Date().toISOString().slice(0, 10)
  });
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState({ name: '', opponentName: '', date: '' });

  useEffect(() => {
    if (!seasonId || !teamId) return;
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const rows = await loadOverview(teamId);
        if (!active) return;
        setMatches(rows);
        setError('');
      } catch (e) {
        if (!active) return;
        setError('Could not load matches overview.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const handleUpdate = () => load();
    window.addEventListener('waterpolo-data-updated', handleUpdate);
    return () => {
      active = false;
      window.removeEventListener('waterpolo-data-updated', handleUpdate);
    };
  }, [seasonId, teamId]);

  const filteredMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((match) =>
      [match.name, match.opponentName, match.date].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [matches, query]);

  const totals = useMemo(
    () =>
      filteredMatches.reduce(
        (acc, match) => ({
          matches: acc.matches + 1,
          shots: acc.shots + match.shots,
          goals: acc.goals + match.goals,
          possessions: acc.possessions + match.possessions,
          passes: acc.passes + match.passes
        }),
        { matches: 0, shots: 0, goals: 0, possessions: 0, passes: 0 }
      ),
    [filteredMatches]
  );

  const createMatch = async () => {
    if (!creating.name.trim()) {
      setError('Match name is required.');
      return;
    }
    try {
      setSaving(true);
      const { data, error: insertError } = await supabase
        .from('matches')
        .insert({
          name: creating.name.trim(),
          date: creating.date || new Date().toISOString().slice(0, 10),
          opponent_name: creating.opponentName.trim(),
          season_id: seasonId,
          team_id: teamId,
          user_id: userId
        })
        .select('*')
        .single();
      if (insertError) throw insertError;
      setMatches((prev) => [
        {
          id: data.id,
          name: data.name,
          date: data.date,
          opponentName: data.opponent_name || '',
          shots: 0,
          shotGoals: 0,
          shotSaved: 0,
          shotMissed: 0,
          penalties: 0,
          events: 0,
          goals: 0,
          exclusions: 0,
          fouls: 0,
          turnoversWon: 0,
          turnoversLost: 0,
          possessions: 0,
          passes: 0
        },
        ...prev
      ]);
      setCreating({
        name: 'New match',
        opponentName: '',
        date: new Date().toISOString().slice(0, 10)
      });
      setError('');
      onDataUpdated?.();
    } catch {
      setError('Failed to create match.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (match) => {
    setEditingId(match.id);
    setEditForm({
      name: match.name || '',
      opponentName: match.opponentName || '',
      date: match.date || new Date().toISOString().slice(0, 10)
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.name.trim()) {
      setError('Match name is required.');
      return;
    }
    try {
      setSaving(true);
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          name: editForm.name.trim(),
          opponent_name: editForm.opponentName.trim(),
          date: editForm.date
        })
        .eq('id', editingId);
      if (updateError) throw updateError;
      setMatches((prev) =>
        prev.map((match) =>
          match.id === editingId
            ? {
                ...match,
                name: editForm.name.trim(),
                opponentName: editForm.opponentName.trim(),
                date: editForm.date
              }
            : match
        )
      );
      setEditingId('');
      setError('');
      onDataUpdated?.();
    } catch {
      setError('Failed to update match.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMatch = async (matchId) => {
    if (!(await confirmAction('Delete this match and all linked data?'))) return;
    try {
      setSaving(true);
      const { error: deleteError } = await supabase.from('matches').delete().eq('id', matchId);
      if (deleteError) throw deleteError;
      setMatches((prev) => prev.filter((match) => match.id !== matchId));
      if (editingId === matchId) setEditingId('');
      setError('');
      toast('Match deleted.', 'success');
      onDataUpdated?.();
    } catch {
      setError('Failed to delete match.');
      toast('Failed to delete match.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Matches</p>
          <h2 className="text-2xl font-semibold">Season Team Matches</h2>
          <p className="mt-1 text-sm text-slate-500">Overview of all matches for the current season and team.</p>
        </div>
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-72"
          placeholder="Search by match, opponent or date"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Create match</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_160px_auto]">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={creating.name}
            onChange={(event) => setCreating((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Match name"
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={creating.opponentName}
            onChange={(event) => setCreating((prev) => ({ ...prev, opponentName: event.target.value }))}
            placeholder="Opponent"
          />
          <input
            type="date"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={creating.date}
            onChange={(event) => setCreating((prev) => ({ ...prev, date: event.target.value }))}
          />
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={createMatch}
            disabled={saving}
          >
            <span className="inline-flex items-center gap-2">
              <Plus size={14} />
              Create
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Matches</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totals.matches}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Shots</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totals.shots}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Goals (Scoring)</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totals.goals}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Possessions</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totals.possessions}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Passes</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totals.passes}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Shots</th>
                <th className="px-4 py-3">Scoring Events</th>
                <th className="px-4 py-3">Possession</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    No matches found.
                  </td>
                </tr>
              )}
              {filteredMatches.map((match) => (
                <tr key={match.id} className="border-t border-slate-100 text-slate-700">
                  <td className="px-4 py-3">
                    {editingId === match.id ? (
                      <div className="space-y-2">
                        <input
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                          value={editForm.name}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                        <input
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                          value={editForm.opponentName}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, opponentName: event.target.value }))
                          }
                          placeholder="Opponent"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold text-slate-900">{match.name || 'Match'}</div>
                        <div className="text-xs text-slate-500">
                          {match.opponentName ? `vs ${match.opponentName}` : 'No opponent set'}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {editingId === match.id ? (
                      <input
                        type="date"
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        value={editForm.date}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, date: event.target.value }))}
                      />
                    ) : (
                      match.date || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>Total: {match.shots}</div>
                    <div>Goal: {match.shotGoals}</div>
                    <div>Saved: {match.shotSaved}</div>
                    <div>Miss: {match.shotMissed}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>Total: {match.events}</div>
                    <div>Goals: {match.goals}</div>
                    <div>Exclusions: {match.exclusions}</div>
                    <div>Fouls: {match.fouls}</div>
                    <div>
                      Turnovers: {match.turnoversWon}/{match.turnoversLost} (won/lost)
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>Possessions: {match.possessions}</div>
                    <div>Passes: {match.passes}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex items-center gap-2">
                      {editingId === match.id ? (
                        <>
                          <button
                            className="rounded-md bg-slate-900 px-2 py-1 font-semibold text-white disabled:opacity-50"
                            onClick={saveEdit}
                            disabled={saving}
                          >
                            Save
                          </button>
                          <button
                            className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-700"
                            onClick={() => setEditingId('')}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="rounded-md border border-slate-200 px-2 py-1 font-semibold text-slate-700"
                            onClick={() => startEdit(match)}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-md border border-red-200 px-2 py-1 font-semibold text-red-600"
                            onClick={() => deleteMatch(match.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MatchesView;
