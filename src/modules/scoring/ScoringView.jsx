import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatShotTime, normalizeTime, splitTimeParts, timeToSeconds } from '../../utils/time';

const SCORING_EVENTS = [
  { key: 'goal', label: 'Goal', player: true, color: 'bg-emerald-600' },
  { key: 'exclusion', label: 'Exclusion', player: true, color: 'bg-amber-500' },
  { key: 'foul', label: 'Foul', player: true, color: 'bg-orange-500' },
  { key: 'turnover_won', label: 'Turnover won', player: true, color: 'bg-sky-600' },
  { key: 'turnover_lost', label: 'Turnover lost', player: true, color: 'bg-rose-500' },
  { key: 'penalty', label: 'Penalty', player: true, color: 'bg-indigo-600' },
  { key: 'timeout', label: 'Timeout', player: false, color: 'bg-slate-700' }
];

const ScoringView = ({
  seasonId,
  teamId,
  userId,
  confirmAction,
  toast,
  loadData,
  onDataUpdated,
  periods,
  periodOrder
}) => {
  const [roster, setRoster] = useState([]);
  const [matches, setMatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentMatchId, setCurrentMatchId] = useState('');
  const [statsMatchId, setStatsMatchId] = useState('');
  const [editingEventId, setEditingEventId] = useState(null);
  const [form, setForm] = useState({
    type: 'goal',
    playerCap: '',
    period: '1',
    time: formatShotTime()
  });
  const [videoUrl, setVideoUrl] = useState('');
  const [videoName, setVideoName] = useState('');
  const [lastEventMeta, setLastEventMeta] = useState(() => ({
    period: '1',
    time: formatShotTime()
  }));
  const videoInputRef = useRef(null);
  const videoElementRef = useRef(null);

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
        setEvents(
          (payload.events || []).map((evt) => ({
            id: evt.id,
            matchId: evt.match_id,
            type: evt.event_type,
            teamSide: evt.team_side,
            playerCap: evt.player_cap || '',
            period: evt.period,
            time: evt.time,
            createdAt: evt.created_at
          }))
        );
        setCurrentMatchId(payload.matches?.[0]?.id || '');
        setStatsMatchId('');
        setError('');
      } catch (e) {
        if (active) setError('Could not load scoring data.');
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

  const filteredEvents = useMemo(() => {
    if (!statsMatchId) return events;
    return events.filter((evt) => evt.matchId === statsMatchId);
  }, [events, statsMatchId]);

  const sortedEvents = useMemo(() => {
    const matchFiltered = currentMatchId
      ? filteredEvents.filter((evt) => evt.matchId === currentMatchId)
      : filteredEvents;
    return [...matchFiltered].sort((a, b) => {
      const periodDiff = (periodOrder[b.period] || 0) - (periodOrder[a.period] || 0);
      if (periodDiff !== 0) return periodDiff;
      return timeToSeconds(b.time) - timeToSeconds(a.time);
    });
  }, [filteredEvents, currentMatchId]);

  const matchEventsSorted = useMemo(() => {
    if (!currentMatchId) return [];
    return [...events]
      .filter((evt) => evt.matchId === currentMatchId)
      .sort((a, b) => {
        const periodDiff = (periodOrder[b.period] || 0) - (periodOrder[a.period] || 0);
        if (periodDiff !== 0) return periodDiff;
        return timeToSeconds(b.time) - timeToSeconds(a.time);
      });
  }, [events, currentMatchId]);

  const stats = useMemo(() => {
    const totals = {
      goal: 0,
      exclusion: 0,
      foul: 0,
      turnover_won: 0,
      turnover_lost: 0,
      penalty: 0,
      timeout: 0
    };
    const playerStats = {};
    filteredEvents.forEach((evt) => {
      if (evt.type in totals) totals[evt.type] += 1;
      if (evt.playerCap) {
        if (!playerStats[evt.playerCap]) {
          playerStats[evt.playerCap] = {
            goals: 0,
            exclusions: 0,
            fouls: 0,
            turnoversWon: 0,
            turnoversLost: 0,
            penalties: 0
          };
        }
        if (evt.type === 'goal') playerStats[evt.playerCap].goals += 1;
        if (evt.type === 'exclusion') playerStats[evt.playerCap].exclusions += 1;
        if (evt.type === 'foul') playerStats[evt.playerCap].fouls += 1;
        if (evt.type === 'turnover_won') playerStats[evt.playerCap].turnoversWon += 1;
        if (evt.type === 'turnover_lost') playerStats[evt.playerCap].turnoversLost += 1;
        if (evt.type === 'penalty') playerStats[evt.playerCap].penalties += 1;
      }
    });
    const manUp = totals.exclusion ? ((totals.goal / totals.exclusion) * 100).toFixed(1) : '—';
    return { totals, playerStats, manUp };
  }, [filteredEvents]);

  const resetForm = (keepTime = true) => {
    setForm((prev) => ({
      ...prev,
      period: keepTime ? prev.period : lastEventMeta.period,
      time: keepTime ? prev.time : lastEventMeta.time,
      playerCap: prev.playerCap || roster[0]?.capNumber || ''
    }));
    setEditingEventId(null);
  };

  useEffect(() => {
    resetForm(true);
  }, [roster]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const openVideoPicker = () => {
    videoInputRef.current?.click();
  };

  const handleVideoFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const nextUrl = URL.createObjectURL(file);
    setVideoUrl(nextUrl);
    setVideoName(file.name);
    setError('');
    event.target.value = '';
  };

  const clearVideo = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl('');
    setVideoName('');
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'Space') return;
      const target = event.target;
      const tagName = target?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON') {
        return;
      }
      if (target?.isContentEditable) return;
      const video = videoElementRef.current;
      if (!video) return;
      event.preventDefault();
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [videoUrl]);

  const setTimeFromTotalSeconds = (nextTotal) => {
    const clamped = Math.max(0, Math.min(7 * 60, nextTotal));
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    setForm((prev) => ({ ...prev, time: `${minutes}:${String(seconds).padStart(2, '0')}` }));
  };

  const adjustMinutes = (delta) => {
    const parts = splitTimeParts(form.time);
    setTimeFromTotalSeconds(parts.minutes * 60 + parts.seconds + delta * 60);
  };

  const adjustSeconds = (delta) => {
    const parts = splitTimeParts(form.time);
    setTimeFromTotalSeconds(parts.minutes * 60 + parts.seconds + delta);
  };

  const saveEvent = async (eventType = form.type) => {
    if (!currentMatch) {
      setError('Create or select a match first.');
      return;
    }
    const requiresPlayer = SCORING_EVENTS.find((item) => item.key === eventType)?.player;
    if (requiresPlayer && !form.playerCap) {
      setError('Select a player.');
      return;
    }
    const payload = {
      user_id: userId,
      season_id: seasonId,
      team_id: teamId,
      match_id: currentMatch.id,
      event_type: eventType,
      team_side: 'for',
      player_cap: requiresPlayer ? form.playerCap : null,
      period: form.period,
      time: normalizeTime(form.time)
    };
    let data;
    if (editingEventId) {
      const { data: updated, error: updateError } = await supabase
        .from('scoring_events')
        .update(payload)
        .eq('id', editingEventId)
        .select('*')
        .single();
      if (updateError) {
        setError('Failed to update event.');
        return;
      }
      data = updated;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('scoring_events')
        .insert(payload)
        .select('*')
        .single();
      if (insertError) {
        setError('Failed to save event.');
        return;
      }
      data = inserted;
    }
    const nextEvent = {
      id: data.id,
      matchId: data.match_id,
      type: data.event_type,
      teamSide: data.team_side || 'for',
      playerCap: data.player_cap || '',
      period: data.period,
      time: data.time,
      createdAt: data.created_at
    };
    setEvents((prev) => {
      if (editingEventId) {
        return prev.map((evt) => (evt.id === editingEventId ? nextEvent : evt));
      }
      return [...prev, nextEvent];
    });
    setLastEventMeta({ period: form.period, time: normalizeTime(form.time) });
    setError('');
    setEditingEventId(null);
    onDataUpdated?.();
  };

  const deleteEvent = async (eventId) => {
    if (!(await confirmAction('Delete event?'))) return;
    const { error: deleteError } = await supabase.from('scoring_events').delete().eq('id', eventId);
    if (deleteError) {
      setError('Failed to delete event.');
      toast('Failed to delete event.', 'error');
      return;
    }
    setEvents((prev) => prev.filter((evt) => evt.id !== eventId));
    onDataUpdated?.();
    toast('Event deleted.', 'success');
  };

  const undoLastEvent = async () => {
    if (!currentMatchId) return;
    const matchEvents = events.filter((evt) => evt.matchId === currentMatchId);
    if (matchEvents.length === 0) return;
    const last = [...matchEvents].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    })[0];
    if (!last) return;
    if (!(await confirmAction('Undo last event?'))) return;
    await deleteEvent(last.id);
  };

  if (loading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Scoring & Stats</p>
          <h2 className="text-2xl font-semibold">Match Events</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleVideoFileChange}
          />
          <button
            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            onClick={openVideoPicker}
          >
            {videoUrl ? 'Change video' : 'Select video (optional)'}
          </button>
          {videoUrl && (
            <button
              className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
              onClick={clearVideo}
            >
              Remove video
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-[260px] flex-1">
                <label className="text-xs font-semibold text-slate-500">Selected match</label>
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={currentMatchId}
                  onChange={(event) => setCurrentMatchId(event.target.value)}
                >
                  {matches.length === 0 && <option value="">No matches</option>}
                  {matches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.name}
                      {match.opponent_name ? ` vs ${match.opponent_name}` : ''} · {match.date}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={undoLastEvent}
                disabled={!currentMatchId}
              >
                Undo last
              </button>
            </div>
            {matches.length === 0 && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                No matches found. Create one in the `Matches` tab.
              </div>
            )}
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[180px_1fr]">
              <div>
                <label className="text-xs font-semibold text-slate-500">Period</label>
                <select
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={form.period}
                  onChange={(event) => setForm((prev) => ({ ...prev, period: event.target.value }))}
                >
                  {periods.map((period) => (
                    <option key={period} value={period}>
                      P{period}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Time</label>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-1">
                      <button
                        className="h-9 w-9 rounded-lg border border-slate-200 bg-slate-50 text-base font-bold text-slate-700"
                        onClick={() => adjustMinutes(1)}
                      >
                        ▲
                      </button>
                      <button
                        className="h-9 w-9 rounded-lg border border-slate-200 bg-slate-50 text-base font-bold text-slate-700"
                        onClick={() => adjustMinutes(-1)}
                      >
                        ▼
                      </button>
                    </div>
                    <div className="w-16 rounded-lg border border-slate-200 bg-white py-2 text-center text-lg font-semibold">
                      {String(splitTimeParts(form.time).minutes).padStart(2, '0')}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-500">:</span>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-1">
                      <button
                        className="h-9 w-9 rounded-lg border border-slate-200 bg-slate-50 text-base font-bold text-slate-700"
                        onClick={() => adjustSeconds(1)}
                      >
                        ▲
                      </button>
                      <button
                        className="h-9 w-9 rounded-lg border border-slate-200 bg-slate-50 text-base font-bold text-slate-700"
                        onClick={() => adjustSeconds(-1)}
                      >
                        ▼
                      </button>
                    </div>
                    <div className="w-16 rounded-lg border border-slate-200 bg-white py-2 text-center text-lg font-semibold">
                      {String(splitTimeParts(form.time).seconds).padStart(2, '0')}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-[11px] font-semibold text-slate-600">
                    {['7:00', '6:00', '5:00', '4:00', '3:00', '2:00', '1:00'].map((preset) => (
                      <button
                        key={preset}
                        className="rounded-full border border-slate-200 px-2 py-1"
                        onClick={() => setForm((prev) => ({ ...prev, time: preset }))}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Player</h3>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-4">
                  <button
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                      form.playerCap === '' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, playerCap: '' }))}
                  >
                    Team
                  </button>
                  {roster.map((player) => (
                    <button
                      key={player.id}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                        form.playerCap === player.capNumber
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                      onClick={() => setForm((prev) => ({ ...prev, playerCap: player.capNumber }))}
                    >
                      #{player.capNumber}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Action</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {SCORING_EVENTS.map((evt) => (
                    <button
                      key={evt.key}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold text-white ${evt.color}`}
                      onClick={() => saveEvent(evt.key)}
                    >
                      + {evt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {editingEventId && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                Editing event ·
                <button className="font-semibold text-slate-700" onClick={resetForm}>
                  Cancel edit
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {videoUrl && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-700">Video assist</h3>
                <div className="max-w-[60%] truncate text-xs text-slate-500">{videoName}</div>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-black">
                <video
                  ref={videoElementRef}
                  className="h-auto max-h-[340px] w-full object-contain"
                  controls
                  playsInline
                  src={videoUrl}
                />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Video stays local in your browser session and is not uploaded.
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">Event log (selected match)</h3>
            </div>
            <div
              className={`mt-3 space-y-2 overflow-y-auto pr-1 text-sm text-slate-600 ${
                videoUrl ? 'max-h-[300px]' : 'max-h-[420px]'
              }`}
            >
              {matchEventsSorted.length === 0 && <div>No events logged yet.</div>}
              {matchEventsSorted.map((evt) => {
                const matchData = matches.find((match) => match.id === evt.matchId);
                const matchName = matchData?.name || 'Match';
                const matchOpponent = matchData?.opponent_name ? ` vs ${matchData.opponent_name}` : '';
                const playerLabel = evt.playerCap ? `#${evt.playerCap}` : 'Team';
                const typeLabel = SCORING_EVENTS.find((item) => item.key === evt.type)?.label || evt.type;
                return (
                  <div key={evt.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <div>
                      <div className="font-semibold text-slate-700">
                        {typeLabel} · {playerLabel}
                      </div>
                      <div className="text-xs text-slate-500">
                        {matchName}
                        {matchOpponent} · P{evt.period} · {evt.time}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <button
                        className="text-slate-500"
                        onClick={() => {
                          setEditingEventId(evt.id);
                          setForm({
                            type: evt.type,
                            playerCap: evt.playerCap,
                            period: evt.period,
                            time: evt.time
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button className="text-red-500" onClick={() => deleteEvent(evt.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Stats scope</h3>
            <label className="mt-3 block text-xs font-semibold text-slate-500">Match selection</label>
            <select
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={statsMatchId}
              onChange={(event) => setStatsMatchId(event.target.value)}
            >
              <option value="">All matches</option>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.name}
                  {match.opponent_name ? ` vs ${match.opponent_name}` : ''} · {match.date}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Team stats</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Goals <span className="font-semibold text-slate-900">{stats.totals.goal}</span>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Exclusions <span className="font-semibold text-slate-900">{stats.totals.exclusion}</span>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Fouls <span className="font-semibold text-slate-900">{stats.totals.foul}</span>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Turnovers won <span className="font-semibold text-slate-900">{stats.totals.turnover_won}</span>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Turnovers lost <span className="font-semibold text-slate-900">{stats.totals.turnover_lost}</span>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Penalties <span className="font-semibold text-slate-900">{stats.totals.penalty}</span>
              </div>
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Timeouts <span className="font-semibold text-slate-900">{stats.totals.timeout}</span>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Man-up conversion ≈ goals / exclusions.
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div className="rounded-lg border border-slate-100 px-3 py-2">
                Man-up % <span className="font-semibold text-emerald-700">{stats.manUp}%</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Player stats</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {Object.keys(stats.playerStats).length === 0 && <div>No player events logged.</div>}
              {Object.entries(stats.playerStats).map(([cap, data]) => (
                <div key={cap} className="rounded-lg border border-slate-100 px-3 py-2">
                  <div className="font-semibold text-slate-700">#{cap}</div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <span>Goals: {data.goals}</span>
                    <span>Exclusions: {data.exclusions}</span>
                    <span>Fouls: {data.fouls}</span>
                    <span>Won: {data.turnoversWon}</span>
                    <span>Lost: {data.turnoversLost}</span>
                    <span>Penalties: {data.penalties}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoringView;
