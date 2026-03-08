import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { createTeamBackupBundle, downloadBackupBundle } from '../../lib/waterpolo/backup';

const SettingsView = ({
  moduleConfig,
  moduleVisibility,
  onToggle,
  onReset,
  preferences,
  onSetPreference,
  teamId,
  seasonName,
  teamName,
  userId,
  loadTeamData,
  loadTeamScoring,
  loadTeamPossessions,
  toast
}) => {
  const coreModules = moduleConfig.filter((item) => !item.alwaysVisible && !item.advanced);
  const advancedModules = moduleConfig.filter((item) => item.advanced);
  const [backupBusy, setBackupBusy] = useState(false);
  const [members, setMembers] = useState([]);
  const [memberRole, setMemberRole] = useState('assistant');
  const [memberUserId, setMemberUserId] = useState('');
  const [memberError, setMemberError] = useState('');

  const lastBackupLabel = useMemo(() => {
    if (!preferences.lastBackupAt) return 'Never';
    const stamp = new Date(preferences.lastBackupAt);
    if (Number.isNaN(stamp.getTime())) return 'Never';
    return stamp.toLocaleString();
  }, [preferences.lastBackupAt]);

  useEffect(() => {
    let active = true;
    const loadMembers = async () => {
      if (!teamId) return;
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });
      if (!active) return;
      if (error) {
        setMembers([]);
        setMemberError('Team sharing SQL migration not applied yet.');
        return;
      }
      setMemberError('');
      setMembers(data || []);
    };
    loadMembers();
    return () => {
      active = false;
    };
  }, [teamId]);

  const handleCreateBackup = async () => {
    if (!teamId) return;
    setBackupBusy(true);
    try {
      const [teamData, scoringData, possessionData] = await Promise.all([
        loadTeamData(teamId),
        loadTeamScoring(teamId),
        loadTeamPossessions(teamId)
      ]);
      const bundle = createTeamBackupBundle({
        seasonName,
        teamName,
        roster: teamData.roster || [],
        matches: scoringData.matches || [],
        shots: scoringData.shots || [],
        events: scoringData.events || [],
        possessions: possessionData.possessions || [],
        passes: possessionData.passes || []
      });
      downloadBackupBundle(bundle);
      onSetPreference('lastBackupAt', new Date().toISOString());
      toast?.('Backup exported.', 'success');
    } catch {
      toast?.('Failed to export backup.', 'error');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleAddMember = async () => {
    if (!teamId || !userId || !memberUserId.trim()) return;
    setMemberError('');
    const payload = {
      team_id: teamId,
      owner_user_id: userId,
      member_user_id: memberUserId.trim(),
      role: memberRole
    };
    const { data, error } = await supabase.from('team_members').insert(payload).select('*').single();
    if (error) {
      setMemberError('Could not add team member. Ensure SQL migration is applied and user id is valid.');
      return;
    }
    setMembers((prev) => [...prev, data]);
    setMemberUserId('');
  };

  const handleRemoveMember = async (id) => {
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) {
      setMemberError('Could not remove team member.');
      return;
    }
    setMembers((prev) => prev.filter((row) => row.id !== id));
  };

  const renderModuleToggle = (item) => {
    const enabled = moduleVisibility[item.key] !== false;
    return (
      <label
        key={item.key}
        className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {item.icon}
          {item.label}
        </span>
        <input type="checkbox" checked={enabled} onChange={() => onToggle(item.key)} />
      </label>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-cyan-700">Settings</p>
        <h2 className="text-2xl font-semibold text-slate-900">Workspace Preferences</h2>
        <p className="mt-2 text-sm text-slate-500">
          Choose which core modules stay visible and whether advanced analysis tools should appear in the sidebar.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Module visibility</h3>
          <button
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
            onClick={onReset}
          >
            Reset to default
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Core modules</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">{coreModules.map(renderModuleToggle)}</div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Show advanced analysis</p>
                <p className="mt-1 text-xs text-slate-500">
                  Reveal optional modules like Video analysis and Possession mapping in the sidebar.
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(preferences.showAdvancedModules)}
                onChange={(event) => onSetPreference('showAdvancedModules', event.target.checked)}
              />
            </label>
            {preferences.showAdvancedModules && (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{advancedModules.map(renderModuleToggle)}</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">General</h3>
        <div className="mt-4 space-y-3">
          <label className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">Remember last opened module</span>
            <input
              type="checkbox"
              checked={Boolean(preferences.rememberLastTab)}
              onChange={(event) => onSetPreference('rememberLastTab', event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">Show Hub workflow tips</span>
            <input
              type="checkbox"
              checked={Boolean(preferences.showHubTips)}
              onChange={(event) => onSetPreference('showHubTips', event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">Show tooltips across modules</span>
            <input
              type="checkbox"
              checked={Boolean(preferences.showStatTooltips)}
              onChange={(event) => onSetPreference('showStatTooltips', event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">Show backup reminder on Hub</span>
            <input
              type="checkbox"
              checked={Boolean(preferences.showBackupReminder)}
              onChange={(event) => onSetPreference('showBackupReminder', event.target.checked)}
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Data Safety</h3>
        <p className="mt-2 text-sm text-slate-500">
          Export one full backup bundle (JSON + embedded CSV snapshots) for the selected season/team workspace.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={handleCreateBackup}
            disabled={backupBusy}
          >
            {backupBusy ? 'Exporting...' : 'Export backup bundle'}
          </button>
          <span className="text-xs text-slate-500">Last backup: {lastBackupLabel}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Team Access (Beta)</h3>
        <p className="mt-2 text-sm text-slate-500">
          Add collaborator by Supabase user id. Use role <span className="font-semibold">assistant</span> (read) or{' '}
          <span className="font-semibold">coach</span> (write). Requires SQL migration for team sharing.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_160px_auto]">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Collaborator user id"
            value={memberUserId}
            onChange={(event) => setMemberUserId(event.target.value)}
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={memberRole}
            onChange={(event) => setMemberRole(event.target.value)}
          >
            <option value="assistant">assistant</option>
            <option value="coach">coach</option>
          </select>
          <button
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            onClick={handleAddMember}
          >
            Add
          </button>
        </div>
        {memberError && <div className="mt-2 text-xs text-red-600">{memberError}</div>}
        <div className="mt-3 space-y-2">
          {members.length === 0 && <div className="text-xs text-slate-500">No collaborators yet.</div>}
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs">
              <span className="font-mono text-slate-700">{member.member_user_id}</span>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{member.role}</span>
                <button className="font-semibold text-red-600" onClick={() => handleRemoveMember(member.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
