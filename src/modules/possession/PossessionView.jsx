import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const PossessionView = ({
  seasonId,
  teamId,
  userId,
  confirmAction,
  toast,
  loadData,
  onDataUpdated,
  outcomes
}) => {
  const [roster, setRoster] = useState([]);
  const [matches, setMatches] = useState([]);
  const [possessions, setPossessions] = useState([]);
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentMatchId, setCurrentMatchId] = useState('');
  const [activePossessionId, setActivePossessionId] = useState('');
  const [passDraft, setPassDraft] = useState({
    fromPlayer: '',
    toPlayer: '',
    fromPos: null,
    toPos: null
  });
  const [playerPicker, setPlayerPicker] = useState(null);
  const [viewMode, setViewMode] = useState('field');
  const fieldRef = useRef(null);

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    const load = async () => {
      try {
        const payload = await loadData(teamId);
        if (!active) return;
        const mappedRoster = payload.roster.map((player) => ({
          id: player.id,
          name: player.name,
          capNumber: player.cap_number
        }));
        setRoster(mappedRoster);
        setMatches(payload.matches || []);
        setPossessions(
          (payload.possessions || []).map((pos) => ({
            id: pos.id,
            matchId: pos.match_id,
            outcome: pos.outcome || null,
            createdAt: pos.created_at
          }))
        );
        setPasses(
          (payload.passes || []).map((pass) => ({
            id: pass.id,
            possessionId: pass.possession_id,
            matchId: pass.match_id,
            fromPlayer: pass.from_player_cap,
            toPlayer: pass.to_player_cap,
            fromX: Number(pass.from_x),
            fromY: Number(pass.from_y),
            toX: Number(pass.to_x),
            toY: Number(pass.to_y),
            sequence: pass.sequence
          }))
        );
        setCurrentMatchId(payload.matches?.[0]?.id || '');
        setError('');
      } catch (e) {
        if (active) setError('Could not load possession data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [teamId]);

  const currentMatch = matches.find((match) => match.id === currentMatchId);

  const activePossession = possessions.find((pos) => pos.id === activePossessionId);

  const matchPossessions = possessions.filter((pos) => pos.matchId === currentMatchId);
  const activePasses = passes
    .filter((pass) => pass.possessionId === activePossessionId)
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const possessionLabelMap = useMemo(() => {
    const rows = [...matchPossessions].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });
    const map = {};
    rows.forEach((pos, idx) => {
      map[pos.id] = `Possession ${idx + 1}`;
    });
    return map;
  }, [matchPossessions]);

  const handleFieldClick = (event) => {
    if (!activePossessionId) return;
    if (!fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (!passDraft.fromPos) {
      setPassDraft((prev) => ({ ...prev, fromPos: { x, y } }));
      setPlayerPicker('from');
    } else if (!passDraft.toPos) {
      setPassDraft((prev) => ({ ...prev, toPos: { x, y } }));
      setPlayerPicker('to');
    } else {
      setPassDraft({ fromPlayer: '', toPlayer: '', fromPos: { x, y }, toPos: null });
      setPlayerPicker('from');
    }
  };

  const startPossession = async () => {
    if (!currentMatch) {
      setError('Select a match first.');
      return;
    }
    const { data, error: insertError } = await supabase
      .from('possessions')
      .insert({
        user_id: userId,
        season_id: seasonId,
        team_id: teamId,
        match_id: currentMatch.id,
        outcome: null
      })
      .select('*')
      .single();
    if (insertError) {
      setError('Failed to start possession.');
      return;
    }
    const fresh = { id: data.id, matchId: data.match_id, outcome: data.outcome, createdAt: data.created_at };
    setPossessions((prev) => [...prev, fresh]);
    setActivePossessionId(fresh.id);
    setPassDraft({ fromPlayer: '', toPlayer: '', fromPos: null, toPos: null });
  };

  const endPossession = async (outcome) => {
    if (!activePossessionId) return;
    const { error: updateError } = await supabase
      .from('possessions')
      .update({ outcome })
      .eq('id', activePossessionId);
    if (updateError) {
      setError('Failed to end possession.');
      return;
    }
    setPossessions((prev) =>
      prev.map((pos) => (pos.id === activePossessionId ? { ...pos, outcome } : pos))
    );
    setActivePossessionId('');
  };

  const deletePossession = async (possessionId) => {
    if (!(await confirmAction('Delete this possession and its passes?'))) return;
    const { error: deleteError } = await supabase.from('possessions').delete().eq('id', possessionId);
    if (deleteError) {
      setError('Failed to delete possession.');
      toast('Failed to delete possession.', 'error');
      return;
    }
    setPossessions((prev) => prev.filter((pos) => pos.id !== possessionId));
    setPasses((prev) => prev.filter((pass) => pass.possessionId !== possessionId));
    if (activePossessionId === possessionId) {
      setActivePossessionId('');
      setPassDraft({ fromPlayer: '', toPlayer: '', fromPos: null, toPos: null });
    }
    onDataUpdated?.();
    toast('Possession deleted.', 'success');
  };

  const addPass = async (override = null) => {
    const draft = override || passDraft;
    if (!activePossessionId) {
      setError('Start a possession first.');
      return;
    }
    if (!draft.fromPlayer || !draft.toPlayer) {
      setError('Select from and to players.');
      return;
    }
    if (!draft.fromPos || !draft.toPos) {
      setError('Click start and end positions on the field.');
      return;
    }
    const sequence = activePasses.length + 1;
    const { data, error: insertError } = await supabase
      .from('passes')
      .insert({
        user_id: userId,
        season_id: seasonId,
        team_id: teamId,
        match_id: currentMatchId,
        possession_id: activePossessionId,
        from_player_cap: draft.fromPlayer,
        to_player_cap: draft.toPlayer,
        from_x: draft.fromPos.x,
        from_y: draft.fromPos.y,
        to_x: draft.toPos.x,
        to_y: draft.toPos.y,
        sequence
      })
      .select('*')
      .single();
    if (insertError) {
      setError('Failed to save pass.');
      return;
    }
    setPasses((prev) => [
      ...prev,
      {
        id: data.id,
        possessionId: data.possession_id,
        matchId: data.match_id,
        fromPlayer: data.from_player_cap,
        toPlayer: data.to_player_cap,
        fromX: Number(data.from_x),
        fromY: Number(data.from_y),
        toX: Number(data.to_x),
        toY: Number(data.to_y),
        sequence: data.sequence
      }
    ]);
    setPassDraft((prev) => ({
      ...prev,
      fromPos: null,
      toPos: null,
      fromPlayer: draft.toPlayer || prev.fromPlayer,
      toPlayer: ''
    }));
    setError('');
  };

  const deletePass = async (passId) => {
    const { error: deleteError } = await supabase.from('passes').delete().eq('id', passId);
    if (deleteError) {
      setError('Failed to delete pass.');
      return;
    }
    setPasses((prev) => prev.filter((pass) => pass.id !== passId));
  };

  const connectionStats = useMemo(() => {
    const counts = {};
    activePasses.forEach((pass) => {
      const key = `${pass.fromPlayer}->${pass.toPlayer}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([key, count]) => {
        const [from, to] = key.split('->');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count);
  }, [activePasses]);

  if (loading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Passing & Possession</p>
          <h2 className="text-2xl font-semibold">Possession Mapping</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
            onClick={() => setViewMode('field')}
          >
            Field
          </button>
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
            onClick={() => setViewMode('network')}
          >
            Network
          </button>
          <button
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
            onClick={() => setViewMode('replay')}
          >
            Replay
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500">Match</label>
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={currentMatchId}
                  onChange={(event) => setCurrentMatchId(event.target.value)}
                >
                  {matches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.name}
                      {match.opponent_name ? ` vs ${match.opponent_name}` : ''} · {match.date}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
                onClick={startPossession}
              >
                <Plus size={14} />
                Start possession
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              Click to set start location → choose passer. Click again → choose receiver.
            </div>
            {activePossessionId && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">End possession:</span>
                {outcomes.map((outcome) => (
                  <button
                    key={outcome.key}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold"
                    onClick={() => endPossession(outcome.key)}
                  >
                    {outcome.label}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
                onClick={() => setPassDraft({ fromPlayer: '', toPlayer: '', fromPos: null, toPos: null })}
              >
                Reset pass
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Possession field</h3>
            <div className="mt-4 flex justify-center">
              <div
                ref={fieldRef}
                onClick={handleFieldClick}
                className="relative h-[700px] w-full max-w-[720px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#4aa3d6] via-[#2c7bb8] to-[#1f639a]"
              >
                <div className="absolute left-0 top-1/2 h-[2px] w-full bg-white/90" />
                <div className="absolute left-0 top-[24%] h-[2px] w-full bg-yellow-300/90" />
                <div className="absolute left-0 top-[20%] h-[2px] w-full bg-red-400/90" />
                <div className="absolute left-0 top-[76%] h-[2px] w-full bg-yellow-300/90" />
                <div className="absolute left-0 top-[80%] h-[2px] w-full bg-red-400/90" />

                <div className="absolute left-[26.67%] top-0 h-[8%] w-[46.66%] border-2 border-red-400/90" />
                <div className="absolute left-[26.67%] bottom-0 h-[8%] w-[46.66%] border-2 border-red-400/90" />

                <div className="absolute left-[40%] top-0 h-[4%] w-[20%] border-2 border-white bg-white/10" />
                <div className="absolute left-[40%] bottom-0 h-[4%] w-[20%] border-2 border-white bg-white/10" />

                {activePasses.map((pass) => (
                  <svg
                    key={pass.id}
                    className="absolute left-0 top-0 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <marker
                        id={`arrow-${pass.id}`}
                        markerWidth="4"
                        markerHeight="4"
                        refX="3.5"
                        refY="2"
                        orient="auto"
                      >
                        <path d="M0,0 L4,2 L0,4 Z" fill="rgba(255,255,255,0.8)" />
                      </marker>
                    </defs>
                    <line
                      x1={pass.fromX}
                      y1={pass.fromY}
                      x2={pass.toX}
                      y2={pass.toY}
                      stroke="rgba(255,255,255,0.75)"
                      strokeWidth="0.6"
                      markerEnd={`url(#arrow-${pass.id})`}
                    />
                  </svg>
                ))}

                {activePasses.map((pass) => (
                  <div
                    key={`${pass.id}-seq`}
                    className="absolute flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-[9px] font-semibold text-slate-700"
                    style={{
                      left: `calc(${(pass.fromX + pass.toX) / 2}% - 8px)`,
                      top: `calc(${(pass.fromY + pass.toY) / 2}% - 8px)`
                    }}
                  >
                    {pass.sequence}
                  </div>
                ))}

                {activePasses.map((pass) => (
                  <div
                    key={`${pass.id}-from`}
                    className="absolute flex h-4 w-4 items-center justify-center rounded-full bg-white/80 text-[9px] font-semibold text-slate-700"
                    style={{
                      left: `calc(${pass.fromX}% - 8px)`,
                      top: `calc(${pass.fromY}% - 8px)`
                    }}
                  >
                    {pass.fromPlayer}
                  </div>
                ))}

                {activePasses.map((pass) => (
                  <div
                    key={`${pass.id}-to`}
                    className="absolute flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/80 text-[9px] font-semibold text-white"
                    style={{
                      left: `calc(${pass.toX}% - 8px)`,
                      top: `calc(${pass.toY}% - 8px)`
                    }}
                  >
                    {pass.toPlayer}
                  </div>
                ))}

                {passDraft.fromPos && (
                  <div
                    className="absolute h-3 w-3 rounded-full bg-white/90"
                    style={{
                      left: `calc(${passDraft.fromPos.x}% - 6px)`,
                      top: `calc(${passDraft.fromPos.y}% - 6px)`
                    }}
                  />
                )}
                {passDraft.toPos && (
                  <div
                    className="absolute h-3 w-3 rounded-full bg-emerald-300/90"
                    style={{
                      left: `calc(${passDraft.toPos.x}% - 6px)`,
                      top: `calc(${passDraft.toPos.y}% - 6px)`
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Possessions</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {matchPossessions.length === 0 && <div>No possessions yet.</div>}
              {matchPossessions.map((pos) => (
                <div
                  key={pos.id}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                    pos.id === activePossessionId
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                      : 'border-slate-100 text-slate-600'
                  }`}
                >
                  <button className="flex-1 text-left" onClick={() => setActivePossessionId(pos.id)}>
                    {possessionLabelMap[pos.id] || 'Possession'} ·{' '}
                    {pos.outcome ? pos.outcome.replace('_', ' ') : 'open'}
                  </button>
                  <button
                    className="text-xs font-semibold text-red-500"
                    onClick={() => deletePossession(pos.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          {viewMode === 'network' && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Passing network</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {connectionStats.length === 0 && <div>No passes yet.</div>}
                {connectionStats.map((row) => (
                  <div key={`${row.from}-${row.to}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <span>
                      #{row.from} → #{row.to}
                    </span>
                    <span className="font-semibold">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'replay' && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Replay</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {activePasses.length === 0 && <div>No passes yet.</div>}
                {activePasses.map((pass) => (
                  <div key={pass.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                    <div>
                      <div className="font-semibold text-slate-700">
                        #{pass.fromPlayer} → #{pass.toPlayer}
                      </div>
                      <div className="text-xs text-slate-500">Pass {pass.sequence}</div>
                    </div>
                    <button
                      className="text-xs font-semibold text-red-500"
                      onClick={() => deletePass(pass.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {playerPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                Choose {playerPicker === 'from' ? 'from' : 'to'} player
              </h3>
              <button className="text-xs font-semibold text-slate-500" onClick={() => setPlayerPicker(null)}>
                Close
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {roster.map((player) => (
                  <button
                    key={player.id}
                    className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    onClick={() => {
                      if (playerPicker === 'from') {
                        setPassDraft((prev) => ({ ...prev, fromPlayer: player.capNumber }));
                        setPlayerPicker(null);
                      } else {
                        const nextDraft = { ...passDraft, toPlayer: player.capNumber };
                        setPassDraft(nextDraft);
                        setPlayerPicker(null);
                        addPass(nextDraft);
                      }
                    }}
                  >
                  #{player.capNumber} {player.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PossessionView;
