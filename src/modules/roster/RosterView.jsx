import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { computeAge } from '../../utils/time';
import ModuleEmptyState from '../../components/ModuleEmptyState';
import StatTooltipLabel from '../../components/StatTooltipLabel';
import { PLAYER_PHOTO_BUCKET, withSignedRosterPhotos } from '../../lib/waterpolo/photos';

const ROSTER_TOOLTIPS = {
  details: 'Core player profile data used by report cards and filtering in other modules.',
  birthday: 'Birthdate is used to calculate age automatically.',
  dominantHand: 'Hand preference helps tactical analysis and matchup planning.',
  notes: 'Optional context such as role, strengths, or injury notes.',
  list: 'Roster is shared across all waterpolo modules for this team.'
};

const isMissingRelationError = (error) =>
  error?.code === '42P01' ||
  /relation .* does not exist/i.test(error?.message || '') ||
  /could not find .* in the schema cache/i.test(error?.message || '');

const emptyForm = {
  existingPlayerId: '',
  name: '',
  capNumber: '',
  birthday: '',
  heightCm: '',
  weightKg: '',
  dominantHand: '',
  notes: ''
};

const toNumberOrNull = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const RosterView = ({
  seasonId,
  teamId,
  userId,
  confirmAction,
  toast,
  loadData,
  onDataUpdated,
  showTooltips = true
}) => {
  const [roster, setRoster] = useState([]);
  const [knownPlayers, setKnownPlayers] = useState([]);
  const [usesTeamPlayers, setUsesTeamPlayers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const availableKnownPlayers = useMemo(
    () => knownPlayers.filter((row) => !roster.some((player) => player.playerId === row.id)),
    [knownPlayers, roster]
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const loadKnownPlayers = async () => {
    const { data, error: playersError } = await supabase
      .from('players')
      .select('id,name')
      .order('name', { ascending: true });
    if (playersError) {
      if (isMissingRelationError(playersError)) {
        setKnownPlayers([]);
        return;
      }
      throw playersError;
    }
    setKnownPlayers(data || []);
  };

  const reloadRoster = async ({ showInitialLoader = false } = {}) => {
    if (showInitialLoader) setLoading(true);
    const payload = await loadData(teamId);
    const rosterWithPhotos = await withSignedRosterPhotos(payload.roster);
    const mappedRoster = rosterWithPhotos.map((player) => ({
      id: player.team_player_id || player.id,
      teamPlayerId: player.team_player_id || player.id,
      playerId: player.player_id || player.id,
      name: player.name,
      capNumber: player.cap_number,
      heightCm: player.height_cm || '',
      weightKg: player.weight_kg || '',
      dominantHand: player.dominant_hand || '',
      notes: player.notes || '',
      photoUrl: player.photo_url || '',
      photoPath: player.photo_path || '',
      birthday: player.birthday || ''
    }));
    setRoster(mappedRoster);
    const teamPlayersEnabled = Boolean(payload.usesTeamPlayers);
    setUsesTeamPlayers(teamPlayersEnabled);
    if (teamPlayersEnabled) {
      await loadKnownPlayers();
    } else {
      setKnownPlayers([]);
    }
  };

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    const load = async () => {
      try {
        await reloadRoster({ showInitialLoader: true });
        if (!active) return;
        setError('');
      } catch {
        if (active) setError('Could not load roster.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [teamId]);

  const savePlayer = async () => {
    const nameRequired = !editingId && !form.existingPlayerId;
    if ((nameRequired && !form.name.trim()) || !String(form.capNumber).trim()) {
      setError('Enter cap number and player name (or choose an existing player).');
      return;
    }

    const profilePayload = {
      name: form.name.trim(),
      birthday: form.birthday || null,
      height_cm: toNumberOrNull(form.heightCm),
      weight_kg: toNumberOrNull(form.weightKg),
      dominant_hand: form.dominantHand || null,
      notes: form.notes || ''
    };

    try {
      if (usesTeamPlayers) {
        if (editingId) {
          const current = roster.find((player) => player.id === editingId);
          if (!current) throw new Error('Selected player was not found.');

          const { error: updatePlayerError } = await supabase
            .from('players')
            .update({
              ...profilePayload,
              name: form.name.trim() || current.name
            })
            .eq('id', current.playerId);
          if (updatePlayerError) throw updatePlayerError;

          const { error: updateLinkError } = await supabase
            .from('team_players')
            .update({ cap_number: String(form.capNumber).trim() })
            .eq('id', editingId);
          if (updateLinkError) throw updateLinkError;

          toast('Player updated.', 'success');
        } else {
          let playerId = form.existingPlayerId;
          if (!playerId) {
            const { data: insertedPlayer, error: insertPlayerError } = await supabase
              .from('players')
              .insert({
                ...profilePayload,
                user_id: userId,
                name: form.name.trim()
              })
              .select('id')
              .single();
            if (insertPlayerError) throw insertPlayerError;
            playerId = insertedPlayer.id;
          }

          const { error: insertTeamPlayerError } = await supabase
            .from('team_players')
            .insert({
              user_id: userId,
              team_id: teamId,
              player_id: playerId,
              cap_number: String(form.capNumber).trim(),
              is_active: true
            });
          if (insertTeamPlayerError) throw insertTeamPlayerError;
          toast('Player added to team.', 'success');
        }
      } else {
        const legacyPayload = {
          ...profilePayload,
          cap_number: String(form.capNumber).trim()
        };
        if (editingId) {
          const { error: updateError } = await supabase.from('roster').update(legacyPayload).eq('id', editingId);
          if (updateError) throw updateError;
          toast('Player updated.', 'success');
        } else {
          const { error: insertError } = await supabase.from('roster').insert({
            ...legacyPayload,
            team_id: teamId,
            user_id: userId,
            name: form.name.trim()
          });
          if (insertError) throw insertError;
          toast('Player added.', 'success');
        }
      }

      await reloadRoster({ showInitialLoader: false });
      setError('');
      resetForm();
      onDataUpdated?.();
    } catch (e) {
      setError(e.message || 'Failed to save player.');
    }
  };

  const deletePlayer = async (playerId) => {
    if (!(await confirmAction('Delete this player from this team?'))) return;
    const currentPlayer = roster.find((player) => player.id === playerId);

    try {
      if (usesTeamPlayers) {
        const { error: deleteLinkError } = await supabase.from('team_players').delete().eq('id', playerId);
        if (deleteLinkError) throw deleteLinkError;

        const { count, error: countError } = await supabase
          .from('team_players')
          .select('id', { count: 'exact', head: true })
          .eq('player_id', currentPlayer?.playerId || '');
        if (countError) throw countError;

        if ((count || 0) === 0 && currentPlayer?.playerId) {
          const { error: deletePlayerError } = await supabase
            .from('players')
            .delete()
            .eq('id', currentPlayer.playerId);
          if (deletePlayerError) throw deletePlayerError;
          if (currentPlayer.photoPath) {
            await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([currentPlayer.photoPath]);
          }
        }
      } else {
        const { error: deleteError } = await supabase.from('roster').delete().eq('id', playerId);
        if (deleteError) throw deleteError;
        if (currentPlayer?.photoPath) {
          await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([currentPlayer.photoPath]);
        }
      }

      await reloadRoster({ showInitialLoader: false });
      onDataUpdated?.();
      setError('');
      toast('Player removed.', 'success');
    } catch (e) {
      setError(e.message || 'Failed to delete player.');
      toast('Failed to delete player.', 'error');
    }
  };

  const uploadPhoto = async (playerId, file) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WEBP image.');
      return;
    }

    const currentPlayer = roster.find((player) => player.id === playerId);
    if (!currentPlayer) return;

    const ext = file.name.split('.').pop();
    const ownerKey = usesTeamPlayers ? currentPlayer.playerId : playerId;
    const folder = usesTeamPlayers ? 'players' : String(teamId);
    const path = `${userId}/${folder}/${ownerKey}.${ext}`;

    try {
      if (currentPlayer.photoPath && currentPlayer.photoPath !== path) {
        await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([currentPlayer.photoPath]);
      }

      const { error: uploadError } = await supabase.storage.from(PLAYER_PHOTO_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type
      });
      if (uploadError) throw uploadError;

      const { data: signedData, error: signedError } = await supabase.storage
        .from(PLAYER_PHOTO_BUCKET)
        .createSignedUrl(path, 60 * 60);
      if (signedError) throw signedError;

      if (usesTeamPlayers) {
        const { error: updateError } = await supabase
          .from('players')
          .update({ photo_path: path, photo_url: null })
          .eq('id', currentPlayer.playerId);
        if (updateError) throw updateError;
      } else {
        const { error: updateError } = await supabase
          .from('roster')
          .update({ photo_path: path, photo_url: null })
          .eq('id', playerId);
        if (updateError) throw updateError;
      }

      setRoster((prev) =>
        prev.map((player) =>
          player.id === playerId
            ? { ...player, photoUrl: signedData?.signedUrl || '', photoPath: path }
            : player
        )
      );
      setError('');
      toast('Photo uploaded.', 'success');
    } catch (e) {
      setError(e.message || 'Photo upload failed.');
    }
  };

  if (loading) {
    return <div className="p-10 text-slate-700">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Roster</p>
          <h2 className="text-2xl font-semibold">Player Info</h2>
        </div>
      </div>

      {usesTeamPlayers && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          Players can now be linked to multiple teams. Use “Existing player” to add someone from another team.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">
            <StatTooltipLabel
              label="Player details"
              tooltip={ROSTER_TOOLTIPS.details}
              enabled={showTooltips}
            />
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {usesTeamPlayers && !editingId && (
              <select
                className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.existingPlayerId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    existingPlayerId: event.target.value,
                    name: event.target.value
                      ? knownPlayers.find((row) => row.id === event.target.value)?.name || prev.name
                      : prev.name
                  }))
                }
              >
                <option value="">Create new player profile</option>
                {availableKnownPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            )}
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              disabled={usesTeamPlayers && !editingId && Boolean(form.existingPlayerId)}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Cap #"
              value={form.capNumber}
              onChange={(event) => setForm({ ...form, capNumber: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              type="date"
              placeholder="Birthday"
              value={form.birthday}
              onChange={(event) => setForm({ ...form, birthday: event.target.value })}
              title={showTooltips ? ROSTER_TOOLTIPS.birthday : undefined}
              disabled={usesTeamPlayers && !editingId && Boolean(form.existingPlayerId)}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Height (cm)"
              value={form.heightCm}
              onChange={(event) => setForm({ ...form, heightCm: event.target.value })}
              disabled={usesTeamPlayers && !editingId && Boolean(form.existingPlayerId)}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Weight (kg)"
              value={form.weightKg}
              onChange={(event) => setForm({ ...form, weightKg: event.target.value })}
              disabled={usesTeamPlayers && !editingId && Boolean(form.existingPlayerId)}
            />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.dominantHand}
              onChange={(event) => setForm({ ...form, dominantHand: event.target.value })}
              title={showTooltips ? ROSTER_TOOLTIPS.dominantHand : undefined}
              disabled={usesTeamPlayers && !editingId && Boolean(form.existingPlayerId)}
            >
              <option value="">Dominant hand</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="ambidextrous">Ambidextrous</option>
            </select>
            <textarea
              className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={3}
              title={showTooltips ? ROSTER_TOOLTIPS.notes : undefined}
              disabled={usesTeamPlayers && !editingId && Boolean(form.existingPlayerId)}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={savePlayer}
            >
              {editingId ? 'Update player' : 'Add player'}
            </button>
            <button
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
              onClick={resetForm}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">
            <StatTooltipLabel
              label="Roster list"
              tooltip={ROSTER_TOOLTIPS.list}
              enabled={showTooltips}
            />
          </h3>
          <div className="mt-3 space-y-3">
            {roster.length === 0 && (
              <ModuleEmptyState
                compact
                title="No players in this roster"
                description="Add the first player in the form on the left. The roster is shared across all waterpolo modules."
              />
            )}
            {roster
              .slice()
              .sort((a, b) => Number(a.capNumber) - Number(b.capNumber))
              .map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                      {player.photoUrl ? (
                        <img
                          src={player.photoUrl}
                          alt={player.name}
                          crossOrigin="anonymous"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No photo</div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">#{player.capNumber} {player.name}</div>
                      <div className="text-xs text-slate-500">
                        {computeAge(player.birthday) ?? '—'} yrs
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer text-xs font-semibold text-slate-600">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadPhoto(player.id, file);
                        }}
                      />
                      Upload photo
                    </label>
                    <button
                      className="text-xs font-semibold text-slate-600"
                      onClick={() => {
                        setForm({
                          existingPlayerId: '',
                          name: player.name,
                          capNumber: player.capNumber,
                          birthday: player.birthday,
                          heightCm: player.heightCm,
                          weightKg: player.weightKg,
                          dominantHand: player.dominantHand,
                          notes: player.notes
                        });
                        setEditingId(player.id);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-xs font-semibold text-red-500"
                      onClick={() => deletePlayer(player.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RosterView;
