import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import html2canvas from 'html2canvas';

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

const HEAT_TYPES = [
  { key: 'count', label: 'Aantal', metric: 'count', color: 'redToGreen' },
  { key: 'success', label: '% Raak', metric: 'success', color: 'redToGreen' },
  { key: 'save', label: '% Redding', metric: 'save', color: 'greenToRed' },
  { key: 'miss', label: '% Mis', metric: 'miss', color: 'greenToRed' },
  { key: 'distance', label: '📏 Afstand', metric: 'distance', color: 'none' }
];

const PERIODS = ['1', '2', '3', '4', 'OT'];
const ATTACK_TYPES = ['6vs6', '6vs5', '6vs4', 'strafworp'];

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

const distanceMeters = (shot) => {
  const x = (shot.x / 100) * 15;
  const y = (shot.y / 100) * 12.5;
  return Math.sqrt((x - 7.5) ** 2 + y ** 2);
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
  return `rgba(${r}, ${g}, 90, 0.7)`;
};

const App = () => {
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
    const load = async () => {
      try {
        const stored = await storageGet('waterpolo_analytics_data');
        if (stored) setData(stored);
      } catch (e) {
        setError('Kon analytics data niet laden.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.matches) throw new Error('Invalid');
      const payload = { roster: parsed.roster || [], matches: parsed.matches || [] };
      setData(payload);
      await storageSet('waterpolo_analytics_data', payload);
      setError('');
    } catch (e) {
      setError('Import mislukt.');
    }
  };

  const downloadPNG = async () => {
    if (!fieldRef.current) return;
    try {
      const canvas = await html2canvas(fieldRef.current, {
        backgroundColor: heatType === 'distance' ? '#0b4a7a' : '#0b4a7a',
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

  if (loading) {
    return <div className="p-10 text-slate-700">Laden...</div>;
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Waterpolo Analytics</p>
            <h1 className="text-3xl font-semibold">Heatmaps & Analyse</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={downloadPNG}
            >
              <Download size={16} />
              Download PNG
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-cyan-700">
              <Upload size={16} />
              Import JSON
              <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
            </label>
          </div>
        </header>

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
                        heatType === type.key
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
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
                  className={`relative h-[600px] w-full max-w-[720px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#0c5d98] via-[#0b4a7a] to-[#0a3b62] ${
                    heatType === 'distance' ? '' : ''
                  }`}
                >
                  <div className="absolute left-0 top-0 h-full w-[20%] bg-red-600/20" />
                  <div className="absolute right-0 top-0 h-full w-[20%] bg-red-600/20" />
                  <div className="absolute left-0 top-[50%] h-[2px] w-full bg-yellow-300" />

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
                          <div className="absolute bottom-2 left-2 text-[10px] text-white/70">
                            Strafworpen
                          </div>
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
                    analyticsShots.map((shot) => (
                      <div
                        key={shot.id}
                        className="absolute flex h-4 w-4 items-center justify-center rounded-full border border-white/70 bg-white/80 text-[9px] font-semibold text-slate-700"
                        style={{
                          left: `calc(${shot.x}% - 8px)`,
                          top: `calc(${shot.y}% - 8px)`
                        }}
                      >
                        {shot.playerCap}
                      </div>
                    ))}

                  {heatType === 'distance' &&
                    analyticsShots.map((shot) => (
                      <div
                        key={shot.id}
                        className="absolute flex flex-col items-center text-[10px] font-semibold text-white"
                        style={{
                          left: `calc(${shot.x}% - 12px)`,
                          top: `calc(${shot.y}% - 20px)`
                        }}
                      >
                        <div className="rounded-full bg-blue-100/80 px-2 py-1 text-[10px] text-slate-700">
                          #{shot.playerCap}
                        </div>
                        <div className="mt-1 rounded-full bg-white/80 px-2 py-1 text-[10px] text-slate-700">
                          {distanceMeters(shot).toFixed(1)}m
                        </div>
                      </div>
                    ))}
                </div>
              </div>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
