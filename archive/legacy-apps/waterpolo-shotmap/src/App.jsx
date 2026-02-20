import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Upload, X } from 'lucide-react';
import html2canvas from 'html2canvas';

const FIELD_WIDTH = 15;
const FIELD_HEIGHT = 12.5;

const ZONES = [
  { id: 1, label: '1', left: 0, top: 0, width: 26.67, height: 16 },
  { id: 2, label: '2', left: 26.67, top: 0, width: 46.66, height: 16 },
  { id: 3, label: '3', left: 73.33, top: 0, width: 26.67, height: 16 },
  { id: 4, label: '4', left: 0, top: 16, width: 20, height: 32 },
  { id: 5, label: '5', left: 20, top: 16, width: 20, height: 32 },
  { id: 6, label: '6', left: 40, top: 16, width: 20, height: 32 },
  { id: 7, label: '7', left: 60, top: 16, width: 20, height: 32 },
  { id: 8, label: '8', left: 80, top: 16, width: 20, height: 32 },
  { id: 9, label: '9', left: 0, top: 48, width: 20, height: 52 },
  { id: 10, label: '10', left: 20, top: 48, width: 20, height: 52 },
  { id: 11, label: '11', left: 40, top: 48, width: 20, height: 52 },
  { id: 12, label: '12', left: 60, top: 48, width: 20, height: 52 },
  { id: 13, label: '13', left: 80, top: 48, width: 20, height: 27 },
  { id: 14, label: '14', left: 80, top: 75, width: 20, height: 25 }
];

const RESULT_COLORS = {
  raak: 'bg-green-500',
  redding: 'bg-orange-400',
  mis: 'bg-red-500'
};

const ATTACK_TYPES = ['6vs6', '6vs5', '6vs4', 'strafworp'];
const PERIODS = ['1', '2', '3', '4', 'OT'];

const DEFAULT_MATCH = () => ({
  info: {
    id: `match_${Date.now()}`,
    name: 'Nieuwe wedstrijd',
    date: new Date().toISOString().slice(0, 10)
  },
  shots: []
});

const storageGet = async (key) => {
  if (window.storage?.get) {
    const result = await window.storage.get(key);
    if (!result?.value) return null;
    return JSON.parse(result.value);
  }
  const raw = window.localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
};

const storageSet = async (key, value) => {
  const payload = JSON.stringify(value);
  if (window.storage?.set) {
    await window.storage.set(key, payload);
    return;
  }
  window.localStorage.setItem(key, payload);
};

const storageDelete = async (key) => {
  if (window.storage?.delete) {
    await window.storage.delete(key);
    return;
  }
  window.localStorage.removeItem(key);
};

const detectZone = (x, y) => {
  if (x >= 80 && y >= 75) return 14;
  for (const zone of ZONES) {
    if (zone.id === 14) continue;
    if (x >= zone.left && x <= zone.left + zone.width && y >= zone.top && y <= zone.top + zone.height) {
      return zone.id;
    }
  }
  return null;
};

const formatShotTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const App = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roster, setRoster] = useState([]);
  const [matches, setMatches] = useState([]);
  const [currentMatchId, setCurrentMatchId] = useState('');
  const [pendingShot, setPendingShot] = useState(null);
  const [seasonMode, setSeasonMode] = useState(false);
  const [filters, setFilters] = useState({
    players: [],
    results: [],
    periods: [],
    attackTypes: [],
    matches: []
  });
  const [rosterForm, setRosterForm] = useState({ name: '', capNumber: '' });
  const fieldRef = useRef(null);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const storedRoster = (await storageGet('waterpolo_roster')) || [];
        const matchList = (await storageGet('waterpolo_match_list')) || [];
        let loadedMatches = [];
        if (matchList.length) {
          loadedMatches = await Promise.all(
            matchList.map(async (info) => {
              const match = await storageGet(`waterpolo_match_${info.id}`);
              return match || { info, shots: [] };
            })
          );
        }
        const storedCurrent = await storageGet('waterpolo_current_match');
        let currentId = storedCurrent?.info?.id || loadedMatches[0]?.info?.id;
        if (!currentId) {
          const fresh = DEFAULT_MATCH();
          loadedMatches = [fresh];
          currentId = fresh.info.id;
          await storageSet(`waterpolo_match_${fresh.info.id}`, fresh);
          await storageSet('waterpolo_match_list', [fresh.info]);
          await storageSet('waterpolo_current_match', fresh);
        }
        setRoster(storedRoster);
        setMatches(loadedMatches);
        setCurrentMatchId(currentId);
      } catch (e) {
        setError('Kon opslag niet laden.');
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const currentMatch = useMemo(
    () => matches.find((match) => match.info.id === currentMatchId) || matches[0],
    [matches, currentMatchId]
  );

  useEffect(() => {
    if (!currentMatch) return;
    setCurrentMatchId(currentMatch.info.id);
  }, [currentMatch]);

  const persistMatches = async (nextMatches, nextCurrentId) => {
    const list = nextMatches.map((match) => match.info);
    await storageSet('waterpolo_match_list', list);
    const current = nextMatches.find((match) => match.info.id === nextCurrentId) || nextMatches[0];
    if (current) {
      await storageSet('waterpolo_current_match', current);
    }
    await Promise.all(
      nextMatches.map((match) => storageSet(`waterpolo_match_${match.info.id}`, match))
    );
  };

  const handleFieldClick = (event) => {
    if (!fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (x >= 80 && y >= 75) return;
    const zone = detectZone(x, y);
    if (!zone) return;
    setPendingShot({
      x,
      y,
      zone,
      attackType: '6vs6',
      result: 'raak',
      playerCap: roster[0]?.capNumber || '',
      period: '1',
      time: formatShotTime()
    });
  };

  const handlePenaltyClick = () => {
    setPendingShot({
      x: 90,
      y: 87.5,
      zone: 14,
      attackType: 'strafworp',
      result: 'raak',
      playerCap: roster[0]?.capNumber || '',
      period: '1',
      time: formatShotTime()
    });
  };

  const addShot = async () => {
    if (!pendingShot || !currentMatch) return;
    if (!pendingShot.playerCap) {
      setError('Selecteer een speler.');
      return;
    }
    const shot = {
      id: `shot_${Date.now()}`,
      ...pendingShot
    };
    const nextMatches = matches.map((match) =>
      match.info.id === currentMatch.info.id
        ? { ...match, shots: [...match.shots, shot] }
        : match
    );
    setMatches(nextMatches);
    setPendingShot(null);
    setError('');
    await persistMatches(nextMatches, currentMatch.info.id);
  };

  const deleteShot = async (shotId) => {
    if (!currentMatch) return;
    const nextMatches = matches.map((match) =>
      match.info.id === currentMatch.info.id
        ? { ...match, shots: match.shots.filter((shot) => shot.id !== shotId) }
        : match
    );
    setMatches(nextMatches);
    await persistMatches(nextMatches, currentMatch.info.id);
  };

  const handleRosterAdd = async () => {
    if (!rosterForm.name || !rosterForm.capNumber) {
      setError('Vul naam en cap nummer in.');
      return;
    }
    const nextRoster = [
      ...roster,
      { id: `player_${Date.now()}`, name: rosterForm.name, capNumber: rosterForm.capNumber }
    ];
    setRoster(nextRoster);
    setRosterForm({ name: '', capNumber: '' });
    setError('');
    await storageSet('waterpolo_roster', nextRoster);
  };

  const removeRosterPlayer = async (playerId) => {
    const nextRoster = roster.filter((player) => player.id !== playerId);
    setRoster(nextRoster);
    await storageSet('waterpolo_roster', nextRoster);
  };

  const addMatch = async () => {
    const fresh = DEFAULT_MATCH();
    const nextMatches = [...matches, fresh];
    setMatches(nextMatches);
    setCurrentMatchId(fresh.info.id);
    await persistMatches(nextMatches, fresh.info.id);
  };

  const deleteMatch = async (matchId) => {
    const nextMatches = matches.filter((match) => match.info.id !== matchId);
    if (!nextMatches.length) return;
    setMatches(nextMatches);
    setCurrentMatchId(nextMatches[0].info.id);
    await storageDelete(`waterpolo_match_${matchId}`);
    await persistMatches(nextMatches, nextMatches[0].info.id);
  };

  const updateMatchInfo = async (field, value) => {
    if (!currentMatch) return;
    const nextMatches = matches.map((match) =>
      match.info.id === currentMatch.info.id
        ? { ...match, info: { ...match.info, [field]: value } }
        : match
    );
    setMatches(nextMatches);
    await persistMatches(nextMatches, currentMatch.info.id);
  };

  const filteredShots = useMemo(() => {
    const relevantMatches = seasonMode
      ? matches.filter((match) =>
          filters.matches.length ? filters.matches.includes(match.info.id) : true
        )
      : currentMatch
      ? [currentMatch]
      : [];
    const shots = relevantMatches.flatMap((match) => match.shots);
    return shots.filter((shot) => {
      if (seasonMode) {
        if (filters.players.length && !filters.players.includes(shot.playerCap)) return false;
        if (filters.results.length && !filters.results.includes(shot.result)) return false;
        if (filters.periods.length && !filters.periods.includes(shot.period)) return false;
        if (filters.attackTypes.length && !filters.attackTypes.includes(shot.attackType)) return false;
      }
      return true;
    });
  }, [seasonMode, matches, currentMatch, filters]);

  const exportJSON = async () => {
    try {
      const payload = {
        roster,
        matches: matches.map((match) => ({ info: match.info, shots: match.shots })),
        exportDate: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `waterpolo_shotmap_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError('Export mislukt.');
    }
  };

  const importJSON = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data?.matches) throw new Error('Invalid');
      const nextRoster = data.roster || [];
      const nextMatches = data.matches.map((match) => ({
        info: match.info,
        shots: match.shots || []
      }));
      setRoster(nextRoster);
      setMatches(nextMatches);
      setCurrentMatchId(nextMatches[0]?.info?.id || '');
      await storageSet('waterpolo_roster', nextRoster);
      await persistMatches(nextMatches, nextMatches[0]?.info?.id || '');
      setError('');
    } catch (e) {
      setError('Import mislukt. Controleer het JSON bestand.');
    }
  };

  const downloadPNG = async () => {
    if (!fieldRef.current) return;
    try {
      const canvas = await html2canvas(fieldRef.current, {
        backgroundColor: '#0b4a7a',
        scale: 2
      });
      const output = document.createElement('canvas');
      output.width = 1440;
      output.height = 1450;
      const ctx = output.getContext('2d');
      ctx.fillStyle = '#f8fbff';
      ctx.fillRect(0, 0, output.width, output.height);
      ctx.fillStyle = '#0b1c2c';
      ctx.font = '600 36px Space Grotesk, sans-serif';
      const title = seasonMode ? 'Waterpolo Shotmap (Seizoen)' : `Waterpolo Shotmap - ${currentMatch?.info?.name || ''}`;
      ctx.fillText(title, 40, 64);
      ctx.drawImage(canvas, 0, 100, 1440, 1200);
      const url = output.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `shotmap_${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
    } catch (e) {
      setError('PNG export mislukt.');
    }
  };

  const penaltyShots = filteredShots.filter((shot) => shot.attackType === 'strafworp');

  const penaltyPosition = (index) => {
    const colCount = 3;
    const col = index % colCount;
    const row = Math.floor(index / colCount);
    const zone = ZONES.find((z) => z.id === 14);
    const cellWidth = zone.width / colCount;
    const cellHeight = zone.height / 4;
    return {
      x: zone.left + cellWidth * col + cellWidth / 2,
      y: zone.top + cellHeight * row + cellHeight / 2
    };
  };

  if (loading) {
    return <div className="p-10 text-slate-700">Laden...</div>;
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Waterpolo Shotmap</p>
            <h1 className="text-3xl font-semibold">Shot Tracking & Registratie</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={downloadPNG}
            >
              <Download size={16} />
              Download PNG
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
              onClick={exportJSON}
            >
              <Download size={16} />
              Export JSON
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-cyan-700">
              <Upload size={16} />
              Import
              <input type="file" accept="application/json" className="hidden" onChange={importJSON} />
            </label>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    seasonMode ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-white'
                  }`}
                  onClick={() => setSeasonMode(false)}
                >
                  Wedstrijd modus
                </button>
                <button
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    seasonMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                  onClick={() => setSeasonMode(true)}
                >
                  Seizoen modus
                </button>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
                onClick={addMatch}
              >
                <Plus size={16} />
                Nieuwe wedstrijd
              </button>
            </div>

            {!seasonMode && currentMatch && (
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-500">Wedstrijdnaam</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={currentMatch.info.name}
                      onChange={(event) => updateMatchInfo('name', event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Datum</label>
                    <input
                      type="date"
                      className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={currentMatch.info.date}
                      onChange={(event) => updateMatchInfo('date', event.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {matches.map((match) => (
                    <button
                      key={match.info.id}
                      className={`rounded-full px-3 py-1 ${
                        match.info.id === currentMatch.info.id
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                      onClick={() => setCurrentMatchId(match.info.id)}
                    >
                      {match.info.name}
                    </button>
                  ))}
                  {matches.length > 1 && (
                    <button
                      className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-red-500"
                      onClick={() => deleteMatch(currentMatch.info.id)}
                    >
                      <X size={14} />
                      Verwijder wedstrijd
                    </button>
                  )}
                </div>
              </div>
            )}

            {seasonMode && (
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700">Seizoen filters</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Wedstrijden</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {matches.map((match) => (
                        <button
                          key={match.info.id}
                          className={`rounded-full px-3 py-1 text-xs ${
                            filters.matches.includes(match.info.id)
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              matches: prev.matches.includes(match.info.id)
                                ? prev.matches.filter((id) => id !== match.info.id)
                                : [...prev.matches, match.info.id]
                            }))
                          }
                        >
                          {match.info.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Spelers</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {roster.map((player) => (
                        <button
                          key={player.id}
                          className={`rounded-full px-3 py-1 text-xs ${
                            filters.players.includes(player.capNumber)
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              players: prev.players.includes(player.capNumber)
                                ? prev.players.filter((cap) => cap !== player.capNumber)
                                : [...prev.players, player.capNumber]
                            }))
                          }
                        >
                          #{player.capNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Uitkomst</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['raak', 'redding', 'mis'].map((result) => (
                        <button
                          key={result}
                          className={`rounded-full px-3 py-1 text-xs ${
                            filters.results.includes(result)
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              results: prev.results.includes(result)
                                ? prev.results.filter((value) => value !== result)
                                : [...prev.results, result]
                            }))
                          }
                        >
                          {result}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Periode</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PERIODS.map((period) => (
                        <button
                          key={period}
                          className={`rounded-full px-3 py-1 text-xs ${
                            filters.periods.includes(period)
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              periods: prev.periods.includes(period)
                                ? prev.periods.filter((value) => value !== period)
                                : [...prev.periods, period]
                            }))
                          }
                        >
                          P{period}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Aanval type</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ATTACK_TYPES.map((type) => (
                        <button
                          key={type}
                          className={`rounded-full px-3 py-1 text-xs ${
                            filters.attackTypes.includes(type)
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              attackTypes: prev.attackTypes.includes(type)
                                ? prev.attackTypes.filter((value) => value !== type)
                                : [...prev.attackTypes, type]
                            }))
                          }
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Interactief veld</h3>
                <div className="text-xs text-slate-500">Klik om schot toe te voegen</div>
              </div>
              <div className="mt-4 flex justify-center">
                <div
                  ref={fieldRef}
                  className="relative h-[600px] w-full max-w-[720px] cursor-crosshair overflow-hidden rounded-2xl bg-gradient-to-b from-[#0c5d98] via-[#0b4a7a] to-[#0a3b62]"
                  onClick={handleFieldClick}
                >
                  <div className="absolute left-0 top-0 h-full w-[20%] bg-red-600/20" />
                  <div className="absolute right-0 top-0 h-full w-[20%] bg-red-600/20" />
                  <div className="absolute left-0 top-[50%] h-[2px] w-full bg-yellow-300" />

                  {ZONES.map((zone) => (
                    <div
                      key={zone.id}
                      className={`absolute border border-white/40 ${
                        zone.id === 14 ? 'bg-slate-900/40' : ''
                      }`}
                      style={{
                        left: `${zone.left}%`,
                        top: `${zone.top}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`
                      }}
                    >
                      <div className="absolute left-2 top-2 text-xs font-semibold text-white/70">
                        {zone.label}
                      </div>
                      {zone.id === 14 && (
                        <div className="absolute inset-0 grid grid-cols-3 place-items-center gap-1 p-2">
                          <button
                            className="col-span-3 rounded-lg bg-yellow-400 px-2 py-1 text-xs font-semibold text-slate-900"
                            onClick={(event) => {
                              event.stopPropagation();
                              handlePenaltyClick();
                            }}
                          >
                            + Strafworp
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {filteredShots.map((shot, index) => {
                    const isPenalty = shot.attackType === 'strafworp';
                    const position = isPenalty
                      ? penaltyPosition(penaltyShots.findIndex((item) => item.id === shot.id))
                      : { x: shot.x, y: shot.y };
                    return (
                      <div
                        key={shot.id}
                        className={`absolute flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg ${
                          RESULT_COLORS[shot.result]
                        } ${isPenalty ? 'rounded-md' : ''}`}
                        style={{
                          left: `calc(${position.x}% - 14px)`,
                          top: `calc(${position.y}% - 14px)`
                        }}
                        title={`${shot.playerCap} - ${shot.result}`}
                      >
                        {isPenalty ? `P${shot.playerCap}` : shot.playerCap}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Schot toevoegen</h3>
              {pendingShot ? (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Zone {pendingShot.zone} · {pendingShot.attackType}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Speler</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={pendingShot.playerCap}
                      onChange={(event) =>
                        setPendingShot((prev) => ({ ...prev, playerCap: event.target.value }))
                      }
                    >
                      <option value="">Selecteer speler</option>
                      {roster.map((player) => (
                        <option key={player.id} value={player.capNumber}>
                          #{player.capNumber} {player.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Resultaat</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                        value={pendingShot.result}
                        onChange={(event) =>
                          setPendingShot((prev) => ({ ...prev, result: event.target.value }))
                        }
                      >
                        <option value="raak">Raak</option>
                        <option value="redding">Redding</option>
                        <option value="mis">Mis</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Aanval</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                        value={pendingShot.attackType}
                        onChange={(event) =>
                          setPendingShot((prev) => ({ ...prev, attackType: event.target.value }))
                        }
                        disabled={pendingShot.zone === 14}
                      >
                        {ATTACK_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Periode</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                        value={pendingShot.period}
                        onChange={(event) =>
                          setPendingShot((prev) => ({ ...prev, period: event.target.value }))
                        }
                      >
                        {PERIODS.map((period) => (
                          <option key={period} value={period}>
                            P{period}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Tijd</label>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                        value={pendingShot.time}
                        onChange={(event) =>
                          setPendingShot((prev) => ({ ...prev, time: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      onClick={addShot}
                    >
                      Opslaan
                    </button>
                    <button
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                      onClick={() => setPendingShot(null)}
                    >
                      Annuleer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">Klik op het veld om een schot toe te voegen.</div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Roster</h3>
              <div className="mt-3 grid grid-cols-[1fr_110px] gap-2">
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Naam"
                  value={rosterForm.name}
                  onChange={(event) => setRosterForm((prev) => ({ ...prev, name: event.target.value }))}
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Cap #"
                  value={rosterForm.capNumber}
                  onChange={(event) =>
                    setRosterForm((prev) => ({ ...prev, capNumber: event.target.value }))
                  }
                />
              </div>
              <button
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
                onClick={handleRosterAdd}
              >
                <Plus size={16} />
                Voeg speler toe
              </button>
              <div className="mt-3 space-y-2">
                {roster.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <span>
                      #{player.capNumber} {player.name}
                    </span>
                    <button
                      className="text-xs font-semibold text-red-500"
                      onClick={() => removeRosterPlayer(player.id)}
                    >
                      Verwijder
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Schoten</h3>
              <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
                {filteredShots.length === 0 && (
                  <div className="text-slate-500">Geen schoten geregistreerd.</div>
                )}
                {filteredShots.map((shot) => (
                  <div
                    key={shot.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <div>
                      <div className="font-semibold text-slate-700">
                        Zone {shot.zone} · #{shot.playerCap}
                      </div>
                      <div className="text-xs text-slate-500">
                        {shot.result} · {shot.attackType} · P{shot.period} · {shot.time}
                      </div>
                    </div>
                    <button
                      className="text-xs font-semibold text-red-500"
                      onClick={() => deleteShot(shot.id)}
                    >
                      Verwijder
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
