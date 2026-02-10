import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Upload, X, BarChart2 } from 'lucide-react';
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

const HEAT_TYPES = [
  { key: 'count', label: 'Aantal', metric: 'count', color: 'redToGreen' },
  { key: 'success', label: '% Raak', metric: 'success', color: 'redToGreen' },
  { key: 'save', label: '% Redding', metric: 'save', color: 'greenToRed' },
  { key: 'miss', label: '% Mis', metric: 'miss', color: 'greenToRed' },
  { key: 'distance', label: '📏 Afstand', metric: 'distance', color: 'none' }
];

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

const notifyDataUpdated = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('waterpolo-data-updated'));
};

const dataKey = (seasonId, teamId, key) => `waterpolo_${seasonId}_${teamId}_${key}`;

const loadShotmapData = async (seasonId, teamId) => {
  if (!seasonId || !teamId) return { roster: [], matches: [] };
  const roster = (await storageGet(dataKey(seasonId, teamId, 'roster'))) || [];
  const matchList = (await storageGet(dataKey(seasonId, teamId, 'match_list'))) || [];
  const matches = matchList.length
    ? await Promise.all(
        matchList.map(async (info) => {
          const match = await storageGet(dataKey(seasonId, teamId, `match_${info.id}`));
          return match || { info, shots: [] };
        })
      )
    : [];
  return { roster, matches };
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

const formatShotTime = () => '7:00';

const normalizeTime = (value) => {
  if (!value) return '7:00';
  const parts = value.split(':');
  const minutes = Math.min(7, Math.max(0, Number(parts[0] || 0)));
  const seconds = Math.min(59, Math.max(0, Number(parts[1] || 0)));
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const splitTimeParts = (value) => {
  const normalized = normalizeTime(value);
  const [min, sec] = normalized.split(':');
  return { minutes: Number(min), seconds: Number(sec) };
};

const timeToSeconds = (value) => {
  const normalized = normalizeTime(value);
  const [min, sec] = normalized.split(':').map(Number);
  return min * 60 + sec;
};

const distanceMeters = (shot) => {
  const x = (shot.x / 100) * FIELD_WIDTH;
  const y = (shot.y / 100) * FIELD_HEIGHT;
  return Math.sqrt((x - 7.5) ** 2 + y ** 2);
};

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

const valueToColor = (value, max, scheme) => {
  if (value == null || max === 0) return 'rgba(255,255,255,0)';
  const ratio = Math.min(value / max, 1);
  const clamp = (val) => Math.max(0, Math.min(255, Math.round(val)));
  let r = 0;
  let g = 0;
  if (scheme === 'redToGreen') {
    r = clamp(255 - ratio * 155);
    g = clamp(80 + ratio * 175);
  } else {
    r = clamp(80 + ratio * 175);
    g = clamp(255 - ratio * 155);
  }
  return `rgba(${r}, ${g}, 90, 0.45)`;
};

const App = () => {
  const [activeTab, setActiveTab] = useState('shotmap');
  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [seasonForm, setSeasonForm] = useState('');
  const [teamForm, setTeamForm] = useState('');
  const [loadingSeasons, setLoadingSeasons] = useState(true);

  useEffect(() => {
    const loadSeasons = async () => {
      const stored = (await storageGet('waterpolo_seasons')) || [];
      setSeasons(stored);
      setLoadingSeasons(false);
    };
    loadSeasons();
  }, []);

  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId);
  const selectedTeam = selectedSeason?.teams?.find((team) => team.id === selectedTeamId);

  const createSeason = async () => {
    if (!seasonForm.trim()) return;
    const newSeason = { id: `season_${Date.now()}`, name: seasonForm.trim(), teams: [] };
    const nextSeasons = [...seasons, newSeason];
    setSeasons(nextSeasons);
    setSeasonForm('');
    await storageSet('waterpolo_seasons', nextSeasons);
    setSelectedSeasonId(newSeason.id);
    setSelectedTeamId('');
  };

  const createTeam = async () => {
    if (!teamForm.trim() || !selectedSeason) return;
    const newTeam = { id: `team_${Date.now()}`, name: teamForm.trim() };
    const nextSeasons = seasons.map((season) =>
      season.id === selectedSeason.id
        ? { ...season, teams: [...(season.teams || []), newTeam] }
        : season
    );
    setSeasons(nextSeasons);
    setTeamForm('');
    await storageSet('waterpolo_seasons', nextSeasons);
    setSelectedTeamId(newTeam.id);
  };

  const renameSeason = async (seasonId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const nextSeasons = seasons.map((season) =>
      season.id === seasonId ? { ...season, name: trimmed } : season
    );
    setSeasons(nextSeasons);
    await storageSet('waterpolo_seasons', nextSeasons);
  };

  const deleteSeason = async (seasonId) => {
    if (!window.confirm('Seizoen verwijderen? Alle teams en data verdwijnen.')) return;
    const nextSeasons = seasons.filter((season) => season.id !== seasonId);
    setSeasons(nextSeasons);
    await storageSet('waterpolo_seasons', nextSeasons);
    if (selectedSeasonId === seasonId) {
      setSelectedSeasonId('');
      setSelectedTeamId('');
    }
  };

  const renameTeam = async (seasonId, teamId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const nextSeasons = seasons.map((season) => {
      if (season.id !== seasonId) return season;
      const teams = (season.teams || []).map((team) =>
        team.id === teamId ? { ...team, name: trimmed } : team
      );
      return { ...season, teams };
    });
    setSeasons(nextSeasons);
    await storageSet('waterpolo_seasons', nextSeasons);
  };

  const deleteTeam = async (seasonId, teamId) => {
    if (!window.confirm('Team verwijderen? Alle data voor dit team verdwijnen.')) return;
    const nextSeasons = seasons.map((season) => {
      if (season.id !== seasonId) return season;
      return { ...season, teams: (season.teams || []).filter((team) => team.id !== teamId) };
    });
    setSeasons(nextSeasons);
    await storageSet('waterpolo_seasons', nextSeasons);
    if (selectedTeamId === teamId) {
      setSelectedTeamId('');
    }
  };

  if (loadingSeasons) {
    return <div className="p-10 text-slate-700">Laden...</div>;
  }

  if (!selectedSeason || !selectedTeam) {
    return (
      <div className="min-h-screen px-6 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-cyan-700">Waterpolo Platform</p>
            <h1 className="text-3xl font-semibold">Seizoenen & Teams</h1>
            <p className="mt-2 text-sm text-slate-500">
              Kies een seizoen en team, of maak nieuwe folders aan.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700">Seizoenen</h2>
              <div className="mt-3 space-y-2">
                {seasons.length === 0 && (
                  <div className="text-sm text-slate-500">Nog geen seizoenen.</div>
                )}
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
                    <span className="mr-3 text-xs text-slate-400">
                      {season.teams?.length || 0} teams
                    </span>
                    <button
                      className="text-xs font-semibold text-slate-500"
                      onClick={() => {
                        const next = window.prompt('Nieuwe seizoennaam', season.name);
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
                  placeholder="Nieuw seizoen"
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

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700">Teams</h2>
              {selectedSeason ? (
                <div className="mt-3 space-y-2">
                  {(selectedSeason.teams || []).length === 0 && (
                    <div className="text-sm text-slate-500">Nog geen teams in dit seizoen.</div>
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
                        onClick={() => {
                          const next = window.prompt('Nieuwe teamnaam', team.name);
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
                <div className="mt-3 text-sm text-slate-500">Kies eerst een seizoen.</div>
              )}
              <div className="mt-4 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder={selectedSeason ? 'Nieuw team' : 'Selecteer seizoen eerst'}
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Waterpolo Platform</p>
            <h1 className="text-3xl font-semibold">Shotmap & Analytics</h1>
            <p className="text-xs text-slate-500">
              {selectedSeason.name} · {selectedTeam.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
              value={selectedSeasonId}
              onChange={(event) => {
                const nextSeasonId = event.target.value;
                const nextSeason = seasons.find((season) => season.id === nextSeasonId);
                setSelectedSeasonId(nextSeasonId);
                setSelectedTeamId(nextSeason?.teams?.[0]?.id || '');
              }}
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
              onChange={(event) => setSelectedTeamId(event.target.value)}
              disabled={(selectedSeason.teams || []).length === 0}
            >
              {(selectedSeason.teams || []).map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <button
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === 'shotmap' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setActiveTab('shotmap')}
            >
              Shotmap
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === 'analytics' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart2 size={16} />
              Analytics
            </button>
            <button
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
              onClick={() => {
                setSelectedSeasonId('');
                setSelectedTeamId('');
              }}
            >
              Wissel team
            </button>
          </div>
        </header>

        {activeTab === 'shotmap' ? (
          <ShotmapView seasonId={selectedSeasonId} teamId={selectedTeamId} />
        ) : (
          <AnalyticsView seasonId={selectedSeasonId} teamId={selectedTeamId} />
        )}
      </div>
    </div>
  );
};

const ShotmapView = ({ seasonId, teamId }) => {
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
        const storedRoster = (await storageGet(dataKey(seasonId, teamId, 'roster'))) || [];
        const matchList = (await storageGet(dataKey(seasonId, teamId, 'match_list'))) || [];
        let loadedMatches = [];
        if (matchList.length) {
          loadedMatches = await Promise.all(
            matchList.map(async (info) => {
              const match = await storageGet(dataKey(seasonId, teamId, `match_${info.id}`));
              return match || { info, shots: [] };
            })
          );
        }
        const storedCurrent = await storageGet(dataKey(seasonId, teamId, 'current_match'));
        let currentId = storedCurrent?.info?.id || loadedMatches[0]?.info?.id;
        if (!currentId) {
          const fresh = DEFAULT_MATCH();
          loadedMatches = [fresh];
          currentId = fresh.info.id;
          await storageSet(dataKey(seasonId, teamId, `match_${fresh.info.id}`), fresh);
          await storageSet(dataKey(seasonId, teamId, 'match_list'), [fresh.info]);
          await storageSet(dataKey(seasonId, teamId, 'current_match'), fresh);
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
  }, [seasonId, teamId]);

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
    await storageSet(dataKey(seasonId, teamId, 'match_list'), list);
    const current = nextMatches.find((match) => match.info.id === nextCurrentId) || nextMatches[0];
    if (current) {
      await storageSet(dataKey(seasonId, teamId, 'current_match'), current);
    }
    await Promise.all(
      nextMatches.map((match) =>
        storageSet(dataKey(seasonId, teamId, `match_${match.info.id}`), match)
      )
    );
    notifyDataUpdated();
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
      ...pendingShot,
      time: normalizeTime(pendingShot.time)
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
    await storageSet(dataKey(seasonId, teamId, 'roster'), nextRoster);
    notifyDataUpdated();
  };

  const removeRosterPlayer = async (playerId) => {
    const nextRoster = roster.filter((player) => player.id !== playerId);
    setRoster(nextRoster);
    await storageSet(dataKey(seasonId, teamId, 'roster'), nextRoster);
    notifyDataUpdated();
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
    await storageDelete(dataKey(seasonId, teamId, `match_${matchId}`));
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

  const displayShots = useMemo(() => {
    return [...filteredShots].sort((a, b) => {
      const periodA = PERIODS.indexOf(a.period);
      const periodB = PERIODS.indexOf(b.period);
      if (periodA !== periodB) return periodA - periodB;
      return timeToSeconds(b.time) - timeToSeconds(a.time);
    });
  }, [filteredShots]);

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
      await storageSet(dataKey(seasonId, teamId, 'roster'), nextRoster);
      await persistMatches(nextMatches, nextMatches[0]?.info?.id || '');
      notifyDataUpdated();
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

  if (loading) {
    return <div className="p-10 text-slate-700">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Waterpolo Shotmap</p>
          <h2 className="text-2xl font-semibold">Shot Tracking & Registratie</h2>
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
      </div>

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
                className="relative h-[600px] w-full max-w-[720px] cursor-crosshair overflow-hidden rounded-2xl bg-gradient-to-b from-[#4aa3d6] via-[#2c7bb8] to-[#1f639a]"
                onClick={handleFieldClick}
              >
                <div className="absolute left-0 top-[48%] h-[2px] w-full bg-yellow-300" />
                <div className="absolute left-[40%] top-0 h-[6%] w-[20%] border-2 border-white bg-white/10" />

                {ZONES.map((zone) => (
                  <div
                    key={zone.id}
                    className={`absolute border border-white/40 ${zone.id === 14 ? 'bg-slate-900/40' : ''}`}
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

                {filteredShots.map((shot) => {
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
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="7"
                          className="w-20 rounded-lg border border-slate-200 px-3 py-2"
                          value={splitTimeParts(pendingShot.time).minutes}
                          onChange={(event) => {
                            const minutes = Math.min(7, Math.max(0, Number(event.target.value)));
                            const seconds = splitTimeParts(pendingShot.time).seconds;
                            setPendingShot((prev) => ({
                              ...prev,
                              time: `${minutes}:${String(seconds).padStart(2, '0')}`
                            }));
                          }}
                        />
                        <span className="text-sm font-semibold text-slate-500">min</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className="w-20 rounded-lg border border-slate-200 px-3 py-2"
                          value={splitTimeParts(pendingShot.time).seconds}
                          onChange={(event) => {
                            const minutes = splitTimeParts(pendingShot.time).minutes;
                            const seconds = Math.min(59, Math.max(0, Number(event.target.value)));
                            setPendingShot((prev) => ({
                              ...prev,
                              time: `${minutes}:${String(seconds).padStart(2, '0')}`
                            }));
                          }}
                        />
                        <span className="text-sm font-semibold text-slate-500">sec</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {['7:00', '6:00', '5:00'].map((preset) => (
                          <button
                            key={preset}
                            className="rounded-full border border-slate-200 px-2 py-1"
                            onClick={() => setPendingShot((prev) => ({ ...prev, time: preset }))}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
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
              {displayShots.length === 0 && (
                <div className="text-slate-500">Geen schoten geregistreerd.</div>
              )}
              {displayShots.map((shot) => (
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
  );
};

const AnalyticsView = ({ seasonId, teamId }) => {
  const [data, setData] = useState({ roster: [], matches: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [heatType, setHeatType] = useState('count');
  const [showShots, setShowShots] = useState(true);
  const [filters, setFilters] = useState({
    matches: [],
    players: [],
    results: [],
    periods: [],
    attackTypes: []
  });
  const fieldRef = useRef(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const payload = await loadShotmapData(seasonId, teamId);
        if (active) {
          setData(payload);
          setError('');
        }
      } catch (e) {
        if (active) setError('Kon analytics data niet laden.');
      } finally {
        if (active) setLoading(false);
      }
    };
    const handleUpdate = () => load();
    load();
    window.addEventListener('waterpolo-data-updated', handleUpdate);
    return () => {
      active = false;
      window.removeEventListener('waterpolo-data-updated', handleUpdate);
    };
  }, [seasonId, teamId]);

  const matches = data.matches || [];
  const roster = data.roster || [];

  const filteredShots = useMemo(() => {
    const selectedMatches = filters.matches.length
      ? matches.filter((match) => filters.matches.includes(match.info.id))
      : matches;
    const allShots = selectedMatches.flatMap((match) => match.shots || []);
    return allShots.filter((shot) => {
      if (filters.players.length && !filters.players.includes(shot.playerCap)) return false;
      if (filters.results.length && !filters.results.includes(shot.result)) return false;
      if (filters.periods.length && !filters.periods.includes(shot.period)) return false;
      if (filters.attackTypes.length && !filters.attackTypes.includes(shot.attackType)) return false;
      return true;
    });
  }, [matches, filters]);

  const analyticsShots = useMemo(() => {
    if (heatType === 'distance') {
      return filteredShots.filter((shot) => shot.attackType !== 'strafworp');
    }
    return filteredShots;
  }, [filteredShots, heatType]);

  const zoneStats = useMemo(() => {
    const stats = {};
    for (const zone of ZONES) {
      stats[zone.id] = { total: 0, success: 0, save: 0, miss: 0, distanceSum: 0, distanceCount: 0 };
    }
    analyticsShots.forEach((shot) => {
      const zone = shot.zone;
      if (!stats[zone]) return;
      stats[zone].total += 1;
      if (shot.result === 'raak') stats[zone].success += 1;
      if (shot.result === 'redding') stats[zone].save += 1;
      if (shot.result === 'mis') stats[zone].miss += 1;
      if (heatType === 'distance') {
        stats[zone].distanceSum += distanceMeters(shot);
        stats[zone].distanceCount += 1;
      }
    });
    return stats;
  }, [analyticsShots, heatType]);

  const zoneValues = useMemo(() => {
    const values = {};
    ZONES.forEach((zone) => {
      if (zone.id === 14) return;
      const stat = zoneStats[zone.id];
      if (!stat) return;
      if (heatType === 'count') values[zone.id] = stat.total;
      if (heatType === 'success') values[zone.id] = stat.total ? (stat.success / stat.total) * 100 : null;
      if (heatType === 'save') values[zone.id] = stat.total ? (stat.save / stat.total) * 100 : null;
      if (heatType === 'miss') values[zone.id] = stat.total ? (stat.miss / stat.total) * 100 : null;
      if (heatType === 'distance')
        values[zone.id] = stat.distanceCount ? stat.distanceSum / stat.distanceCount : null;
    });
    return values;
  }, [zoneStats, heatType]);

  const maxValue = useMemo(() => {
    if (heatType === 'distance') return 0;
    const vals = Object.values(zoneValues).filter((value) => value != null);
    return vals.length ? Math.max(...vals) : 0;
  }, [zoneValues, heatType]);

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
      ctx.fillText(`Waterpolo Analytics - ${HEAT_TYPES.find((t) => t.key === heatType)?.label}`, 40, 64);
      ctx.drawImage(canvas, 0, 100, 1440, 1200);
      const url = output.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `heatmap_${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
    } catch (e) {
      setError('PNG export mislukt.');
    }
  };

  const zone14Stats = zoneStats[14];
  const penaltyShots = analyticsShots.filter((shot) => shot.attackType === 'strafworp');

  const distanceByResult = useMemo(() => {
    if (heatType !== 'distance') return null;
    const buckets = {
      raak: { total: 0, count: 0 },
      redding: { total: 0, count: 0 },
      mis: { total: 0, count: 0 }
    };
    analyticsShots.forEach((shot) => {
      const bucket = buckets[shot.result];
      if (!bucket) return;
      bucket.total += distanceMeters(shot);
      bucket.count += 1;
    });
    const format = (bucket) => (bucket.count ? (bucket.total / bucket.count).toFixed(1) : '—');
    return {
      raak: format(buckets.raak),
      redding: format(buckets.redding),
      mis: format(buckets.mis)
    };
  }, [analyticsShots, heatType]);

  if (loading) {
    return <div className="p-10 text-slate-700">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Waterpolo Analytics</p>
          <h2 className="text-2xl font-semibold">Heatmaps & Analyse</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={downloadPNG}
          >
            <Download size={16} />
            Download PNG
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {HEAT_TYPES.map((type) => (
                  <button
                    key={type.key}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      heatType === type.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                    onClick={() => setHeatType(type.key)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              {heatType !== 'distance' && (
                <button
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
                  onClick={() => setShowShots((prev) => !prev)}
                >
                  👁️ {showShots ? 'Verberg schoten' : 'Toon schoten'}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Heatmap veld</h3>
            <div className="mt-4 flex justify-center">
              <div
                ref={fieldRef}
                className="relative h-[600px] w-full max-w-[720px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#4aa3d6] via-[#2c7bb8] to-[#1f639a]"
              >
                <div className="absolute left-0 top-[48%] h-[2px] w-full bg-yellow-300" />
                <div className="absolute left-[40%] top-0 h-[6%] w-[20%] border-2 border-white bg-white/10" />

                {ZONES.map((zone) => {
                  const value = zoneValues[zone.id];
                  const colorScheme = HEAT_TYPES.find((t) => t.key === heatType)?.color;
                  const fillColor =
                    zone.id === 14 || heatType === 'distance' || colorScheme === 'none'
                      ? 'transparent'
                      : valueToColor(value, maxValue, colorScheme);
                  return (
                    <div
                      key={zone.id}
                      className={`absolute border border-white/40 ${zone.id === 14 ? 'bg-slate-900/40' : ''}`}
                      style={{
                        left: `${zone.left}%`,
                        top: `${zone.top}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`,
                        backgroundColor: fillColor
                      }}
                    >
                      <div className="absolute left-2 top-2 text-xs font-semibold text-white/70">
                        {zone.label}
                      </div>
                      {zone.id === 14 && (
                        <div className="absolute bottom-2 left-2 text-[10px] text-white/70">Strafworpen</div>
                      )}
                      {heatType === 'distance' && zone.id !== 14 && zoneValues[zone.id] != null && (
                        <div className="absolute bottom-2 right-2 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-slate-700">
                          Ø {zoneValues[zone.id].toFixed(1)}m
                        </div>
                      )}
                      {heatType !== 'distance' && zone.id !== 14 && value != null && (
                        <div className="absolute bottom-2 right-2 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-slate-700">
                          {heatType === 'count' ? value : `${value.toFixed(0)}%`}
                        </div>
                      )}
                    </div>
                  );
                })}

                {heatType !== 'distance' && showShots &&
                  analyticsShots.map((shot) => {
                    const isPenalty = shot.attackType === 'strafworp';
                    const position = isPenalty
                      ? penaltyPosition(penaltyShots.findIndex((item) => item.id === shot.id))
                      : { x: shot.x, y: shot.y };
                    return (
                    <div
                      key={shot.id}
                      className={`absolute flex h-4 w-4 items-center justify-center rounded-full border border-white/80 text-[9px] font-semibold text-white ${
                        shot.result === 'raak'
                          ? 'bg-green-500/80'
                          : shot.result === 'redding'
                          ? 'bg-orange-400/80'
                          : 'bg-red-500/80'
                      }`}
                      style={{
                        left: `calc(${position.x}% - 8px)`,
                        top: `calc(${position.y}% - 8px)`
                      }}
                    >
                      {shot.playerCap}
                    </div>
                    );
                  })}

                {heatType === 'distance' &&
                  analyticsShots.map((shot) => {
                    const isPenalty = shot.attackType === 'strafworp';
                    const position = isPenalty
                      ? penaltyPosition(penaltyShots.findIndex((item) => item.id === shot.id))
                      : { x: shot.x, y: shot.y };
                    return (
                    <div
                      key={shot.id}
                      className="absolute flex flex-col items-center text-[10px] font-semibold text-white"
                      style={{
                        left: `calc(${position.x}% - 12px)`,
                        top: `calc(${position.y}% - 20px)`
                      }}
                    >
                      <div className="rounded-full bg-blue-100/80 px-2 py-1 text-[10px] text-slate-700">
                        #{shot.playerCap}
                      </div>
                      <div className="mt-1 rounded-full bg-amber-100/90 px-2 py-1 text-[10px] text-amber-900">
                        {distanceMeters(shot).toFixed(1)}m
                      </div>
                    </div>
                    );
                  })}
              </div>
            </div>
            {heatType !== 'distance' && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <div className="font-semibold text-slate-700">Legenda</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500/60" />
                    Laag
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-amber-400/60" />
                    Midden
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-green-500/60" />
                    Hoog
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  Kleurverloop gebaseerd op hoogste waarde in zones 1-13.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Filters</h3>
            <div className="mt-3 space-y-3">
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

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Zone 14 statistieken</h3>
            <div className="mt-3 text-sm text-slate-600">
              {zone14Stats?.total ? (
                <div className="space-y-1">
                  <div>Totaal: {zone14Stats.total}</div>
                  <div>Raak: {zone14Stats.success}</div>
                  <div>Redding: {zone14Stats.save}</div>
                  <div>Mis: {zone14Stats.miss}</div>
                </div>
              ) : (
                <div>Geen strafworpen in selectie.</div>
              )}
            </div>
          </div>

          {heatType === 'distance' && distanceByResult && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Gemiddelde afstand</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span>Raak</span>
                  <span className="font-semibold text-emerald-700">{distanceByResult.raak}m</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span>Redding</span>
                  <span className="font-semibold text-amber-700">{distanceByResult.redding}m</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span>Mis</span>
                  <span className="font-semibold text-red-700">{distanceByResult.mis}m</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
