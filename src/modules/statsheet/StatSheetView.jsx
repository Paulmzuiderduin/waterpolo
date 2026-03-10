import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ModuleHeader from '../../components/ModuleHeader';
import ModuleEmptyState from '../../components/ModuleEmptyState';
import ToolbarButton from '../../components/ToolbarButton';
import { buildStatSheet, exportStatSheetCsv, getStatSheetExportTable } from '../../lib/waterpolo/statSheet';
import {
  getStatSheetImportTemplateCsv,
  getStatSheetImportTemplateRows,
  parseStatSheetImportCsv,
  parseStatSheetImportRows
} from '../../lib/waterpolo/statSheetImport';
import { normalizeScoringEventType } from '../../lib/waterpolo/scoring';

const getMatchId = (match) => match.id || match.info?.id || '';
const getMatchName = (match) => match.name || match.info?.name || 'Match';
const getMatchOpponent = (match) => match.opponent_name || match.info?.opponent_name || match.info?.opponent || '';
const getMatchDate = (match) => match.date || match.info?.date || '';

const StatSheetView = ({ teamId, seasonId, userId, loadData, onOpenModule, toast }) => {
  const [roster, setRoster] = useState([]);
  const [matches, setMatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scope, setScope] = useState('season');
  const [matchId, setMatchId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const importInputRef = useRef(null);

  const reloadData = useCallback(async () => {
    if (!teamId) return;
    try {
      const payload = await loadData(teamId);
      setRoster(payload.roster || []);
      setMatches(payload.matches || []);
      setEvents(
        (payload.events || []).map((evt) => ({
          ...evt,
          event_type: normalizeScoringEventType(evt.event_type)
        }))
      );
      setShots(payload.shots || []);
      const sorted = [...(payload.matches || [])].sort((a, b) => {
        const ad = getMatchDate(a) ? new Date(getMatchDate(a)).getTime() : 0;
        const bd = getMatchDate(b) ? new Date(getMatchDate(b)).getTime() : 0;
        return bd - ad;
      });
      setMatchId((prev) => prev || getMatchId(sorted[0]) || '');
      setError('');
    } catch (e) {
      setError('Could not load stat sheet data.');
    } finally {
      setLoading(false);
    }
  }, [loadData, teamId]);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    reloadData();
  }, [teamId, reloadData]);

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
        shots,
        scope,
        matchId: scope === 'match' ? matchId : ''
      }),
    [events, matchId, matches, roster, scope, shots]
  );

  const getScopeLabel = () =>
    scope === 'match'
      ? `Match ${sortedMatches.find((match) => getMatchId(match) === matchId)?.name || ''}`.trim()
      : 'Season';

  const getExportFileName = (extension) => {
    const base = getScopeLabel().toLowerCase().replace(/\s+/g, '-');
    return `waterpolo-stat-sheet-${base}.${extension}`;
  };

  const handleExportCsv = () => {
    if (!sheet.rows.length) {
      toast?.('No stat sheet rows to export.', 'error');
      return;
    }
    const scopeLabel = getScopeLabel();
    const csv = exportStatSheetCsv({
      rows: sheet.rows,
      total: sheet.total,
      scopeLabel
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getExportFileName('csv');
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleExportXlsx = async () => {
    if (!sheet.rows.length) {
      toast?.('No stat sheet rows to export.', 'error');
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const scopeLabel = getScopeLabel();
      const table = getStatSheetExportTable({
        rows: sheet.rows,
        total: sheet.total,
        scopeLabel
      });
      const worksheet = XLSX.utils.aoa_to_sheet(table);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, scope === 'match' ? 'Match' : 'Season');
      const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([output], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = getExportFileName('xlsx');
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast?.('Excel export ready.', 'success');
    } catch {
      toast?.('Failed to export XLSX.', 'error');
    }
  };

  const handleDownloadTemplate = () => {
    const csv = getStatSheetImportTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'waterpolo-stat-sheet-import-template.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplateXlsx = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = getStatSheetImportTemplateRows();
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'template');
      const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([output], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'waterpolo-stat-sheet-import-template.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      toast?.('Failed to download XLSX template.', 'error');
    }
  };

  const processImportFile = async (file) => {
    if (!file || !teamId || !seasonId || !userId) return;
    setImporting(true);
    setError('');
    setImportReport(null);
    try {
      let parsed = { events: [], warnings: ['Unsupported file type. Use CSV or XLSX.'] };
      const fileName = String(file.name || '').toLowerCase();
      if (fileName.endsWith('.xlsx')) {
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const firstSheet = sheetName ? workbook.Sheets[sheetName] : null;
        const rows = firstSheet ? XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) : [];
        parsed = parseStatSheetImportRows(rows);
      } else if (fileName.endsWith('.csv')) {
        const text = await file.text();
        parsed = parseStatSheetImportCsv(text);
      }

      const { events: parsedEvents, warnings } = parsed;
      if (!parsedEvents.length) {
        setError('No importable events found in file.');
        setImportReport({
          status: 'error',
          fileName: file.name,
          importedEvents: 0,
          createdMatches: 0,
          warnings
        });
        toast?.('No importable events found.', 'error');
        if (warnings.length) toast?.(warnings[0], 'error');
        setImportPreview(null);
        return;
      }
      if (parsedEvents.length > 6000) {
        setError('CSV too large. Maximum 6000 expanded events per import.');
        setImportReport({
          status: 'error',
          fileName: file.name,
          importedEvents: 0,
          createdMatches: 0,
          warnings: ['CSV too large. Maximum 6000 expanded events per import.']
        });
        toast?.('Import too large. Max 6000 events.', 'error');
        setImportPreview(null);
        return;
      }
      const uniqueMatchKeys = new Set(
        parsedEvents.map(
          (item) =>
            `${String(item.matchName || '').toLowerCase()}|${item.matchDate || ''}|${String(
              item.opponentName || ''
            ).toLowerCase()}`
        )
      );
      setImportPreview({
        fileName: file.name,
        parsedEvents,
        warnings,
        uniqueMatches: uniqueMatchKeys.size
      });
      toast?.(`Preview ready: ${parsedEvents.length} events`, 'info');
    } catch {
      setError('Failed to import stat sheet file.');
      setImportReport({
        status: 'error',
        fileName: file.name,
        importedEvents: 0,
        createdMatches: 0,
        warnings: ['Unexpected import error. Check CSV format and try again.']
      });
      setImportPreview(null);
      toast?.('Failed to import stat sheet file.', 'error');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    await processImportFile(file);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    await processImportFile(file);
  };

  const handleConfirmImport = async () => {
    if (!importPreview || !teamId || !seasonId || !userId) return;
    setImporting(true);
    setError('');
    setImportReport(null);
    const createdMatchIds = [];
    const insertedEventIds = [];
    try {
      const matchesByKey = new Map();
      matches.forEach((match) => {
        const key = `${(getMatchName(match) || '').toLowerCase()}|${getMatchDate(match) || ''}|${(
          getMatchOpponent(match) || ''
        ).toLowerCase()}`;
        if (!matchesByKey.has(key)) matchesByKey.set(key, getMatchId(match));
      });

      let createdMatches = 0;
      const ensureMatchId = async ({ matchName, matchDate, opponentName }) => {
        const key = `${matchName.toLowerCase()}|${matchDate}|${opponentName.toLowerCase()}`;
        if (matchesByKey.has(key)) return matchesByKey.get(key);
        const { data, error: insertError } = await supabase
          .from('matches')
          .insert({
            name: matchName,
            date: matchDate,
            opponent_name: opponentName || '',
            season_id: seasonId,
            team_id: teamId,
            user_id: userId
          })
          .select('*')
          .single();
        if (insertError) throw insertError;
        matchesByKey.set(key, data.id);
        createdMatchIds.push(data.id);
        createdMatches += 1;
        return data.id;
      };

      const eventPayloads = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const imported of importPreview.parsedEvents) {
        // eslint-disable-next-line no-await-in-loop
        const matchForEvent = await ensureMatchId(imported);
        eventPayloads.push({
          user_id: userId,
          season_id: seasonId,
          team_id: teamId,
          match_id: matchForEvent,
          event_type: imported.eventType,
          player_cap: imported.playerCap || null,
          period: imported.period,
          time: imported.time
        });
      }

      const chunkSize = 500;
      for (let i = 0; i < eventPayloads.length; i += chunkSize) {
        const chunk = eventPayloads.slice(i, i + chunkSize);
        // eslint-disable-next-line no-await-in-loop
        const { data: insertedRows, error: insertError } = await supabase
          .from('scoring_events')
          .insert(chunk)
          .select('id');
        if (insertError) throw insertError;
        (insertedRows || []).forEach((item) => insertedEventIds.push(item.id));
      }

      await reloadData();
      setImportReport({
        status: 'success',
        fileName: importPreview.fileName,
        importedEvents: eventPayloads.length,
        createdMatches,
        warnings: importPreview.warnings
      });
      setImportPreview(null);
      toast?.(`Imported ${eventPayloads.length} events.`, 'success');
      if (importPreview.warnings.length) toast?.(`Imported with warnings: ${importPreview.warnings[0]}`, 'info');
    } catch {
      // best-effort rollback to avoid partial imports
      if (insertedEventIds.length) {
        await supabase.from('scoring_events').delete().in('id', insertedEventIds);
      }
      if (createdMatchIds.length) {
        await supabase.from('matches').delete().in('id', createdMatchIds);
      }
      setError('Failed to import stat sheet CSV. Rolled back partial data.');
      setImportReport({
        status: 'error',
        fileName: importPreview.fileName,
        importedEvents: 0,
        createdMatches: 0,
        warnings: ['Import failed and partial inserted data was rolled back.']
      });
      toast?.('Failed to import CSV. Partial writes rolled back.', 'error');
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <div className="p-10 text-slate-700">Loading...</div>;

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="Stat Sheet"
        title="Match & Season Stat Sheet"
        description="Summary table built from scoring events for match review and season-level player reporting."
        actions={
          <>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleImportFileChange}
            />
            <ToolbarButton
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="text-xs sm:text-sm"
            >
              <Upload size={16} />
              {importing ? 'Importing...' : 'Import file'}
            </ToolbarButton>
            <ToolbarButton onClick={handleDownloadTemplate} className="text-xs sm:text-sm">
              Template CSV
            </ToolbarButton>
            <ToolbarButton onClick={handleDownloadTemplateXlsx} className="text-xs sm:text-sm">
              Template XLSX
            </ToolbarButton>
            <ToolbarButton variant="primary" onClick={handleExportXlsx} disabled={!sheet.rows.length}>
              <Download size={16} />
              Export XLSX
            </ToolbarButton>
            <ToolbarButton onClick={handleExportCsv} disabled={!sheet.rows.length}>
              Export CSV
            </ToolbarButton>
          </>
        }
      />

      <div
        className={`rounded-2xl border-2 border-dashed p-4 transition ${
          dragActive ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 bg-white'
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(false);
        }}
        onDrop={handleDrop}
      >
        <div className="text-sm font-semibold text-slate-700">Import stat sheet file</div>
        <div className="mt-1 text-xs text-slate-500">
          Drag and drop <span className="font-semibold">.xlsx</span> or <span className="font-semibold">.csv</span>, or use Import CSV.
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {importReport && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            importReport.status === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <div className="font-semibold">
            Import report: {importReport.fileName}
          </div>
          <div className="mt-1">
            Events imported: {importReport.importedEvents} · Matches created: {importReport.createdMatches}
          </div>
          {importReport.status === 'success' && (
            <div className="mt-1 text-xs">
              Next: open <span className="font-semibold">Scoring</span> to verify events, then export a fresh season stat sheet.
            </div>
          )}
          {importReport.warnings?.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {importReport.warnings.slice(0, 6).map((warning, index) => (
                <li key={`${warning}_${index}`}>{warning}</li>
              ))}
              {importReport.warnings.length > 6 && (
                <li>...and {importReport.warnings.length - 6} more warnings</li>
              )}
            </ul>
          )}
        </div>
      )}

      {importPreview && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          <div className="font-semibold">Import preview: {importPreview.fileName}</div>
          <div className="mt-1">
            Events to import: {importPreview.parsedEvents.length} · Distinct matches in file:{' '}
            {importPreview.uniqueMatches}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white"
              onClick={handleConfirmImport}
              disabled={importing}
            >
              {importing ? 'Importing...' : 'Confirm import'}
            </button>
            <button
              className="rounded-lg border border-cyan-300 px-3 py-1.5 text-xs font-semibold text-cyan-800"
              onClick={() => setImportPreview(null)}
              disabled={importing}
            >
              Cancel
            </button>
          </div>
          {importPreview.warnings?.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {importPreview.warnings.slice(0, 6).map((warning, index) => (
                <li key={`${warning}_${index}`}>{warning}</li>
              ))}
              {importPreview.warnings.length > 6 && (
                <li>...and {importPreview.warnings.length - 6} more warnings</li>
              )}
            </ul>
          )}
        </div>
      )}

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
                <span>6v6 shots: {sheet.total.sixVsSixShots}</span>
                <span>6v5/6v4 shots: {sheet.total.manUpShots}</span>
                <span>Penalty shots: {sheet.total.penaltyShots}</span>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Import format (.csv/.xlsx): <span className="font-semibold">match_name, match_date, opponent_name, event_type, player_cap, period, time, count</span>.
              Missing period/time default to <span className="font-semibold">P1 · 7:00</span>.
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
                      <th className="px-3 py-2 text-right">G P1</th>
                      <th className="px-3 py-2 text-right">G P2</th>
                      <th className="px-3 py-2 text-right">G P3</th>
                      <th className="px-3 py-2 text-right">G P4</th>
                      <th className="px-3 py-2 text-right">G OT</th>
                      <th className="px-3 py-2 text-right">Shots 6v6</th>
                      <th className="px-3 py-2 text-right">Shots 6v5/6v4</th>
                      <th className="px-3 py-2 text-right">Shots Pen</th>
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
                        <td className="px-3 py-2 text-right">{row.goalP1}</td>
                        <td className="px-3 py-2 text-right">{row.goalP2}</td>
                        <td className="px-3 py-2 text-right">{row.goalP3}</td>
                        <td className="px-3 py-2 text-right">{row.goalP4}</td>
                        <td className="px-3 py-2 text-right">{row.goalOT}</td>
                        <td className="px-3 py-2 text-right">{row.sixVsSixShots}</td>
                        <td className="px-3 py-2 text-right">{row.manUpShots}</td>
                        <td className="px-3 py-2 text-right">{row.penaltyShots}</td>
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
                      <td className="px-3 py-2 text-right">{sheet.total.goalP1}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.goalP2}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.goalP3}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.goalP4}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.goalOT}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.sixVsSixShots}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.manUpShots}</td>
                      <td className="px-3 py-2 text-right">{sheet.total.penaltyShots}</td>
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
