import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { computeAge } from '../../utils/time';
import ModuleEmptyState from '../../components/ModuleEmptyState';
import StatTooltipLabel from '../../components/StatTooltipLabel';
import { PLAYER_PHOTO_BUCKET, inferPhotoPath, withSignedRosterPhotos } from '../../lib/waterpolo/photos';

const ROSTER_TOOLTIPS = {
  details: 'Core player profile data used by report cards and filtering in other modules.',
  birthday: 'Birthdate is used to calculate age automatically.',
  dominantHand: 'Hand preference helps tactical analysis and matchup planning.',
  notes: 'Optional context such as role, strengths, or injury notes.',
  list: 'Roster is shared across all waterpolo modules for this team.'
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    capNumber: '',
    birthday: '',
    heightCm: '',
    weightKg: '',
    dominantHand: '',
    notes: ''
  });

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    const load = async () => {
      try {
        const payload = await loadData(teamId);
        const rosterWithPhotos = await withSignedRosterPhotos(payload.roster);
        if (!active) return;
        const mappedRoster = rosterWithPhotos.map((player) => ({
          id: player.id,
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
      } catch (e) {
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

  const resetForm = () => {
    setForm({
      name: '',
      capNumber: '',
      birthday: '',
      heightCm: '',
      weightKg: '',
      dominantHand: '',
      notes: ''
    });
    setEditingId(null);
  };

  const savePlayer = async () => {
    if (!form.name || !form.capNumber) {
      setError('Enter name and cap number.');
      return;
    }
    const payload = {
      name: form.name,
      cap_number: form.capNumber,
      birthday: form.birthday || null,
      height_cm: form.heightCm ? Number(form.heightCm) : null,
      weight_kg: form.weightKg ? Number(form.weightKg) : null,
      dominant_hand: form.dominantHand,
      notes: form.notes
    };
    let data;
    if (editingId) {
      const { data: updated, error: updateError } = await supabase
        .from('roster')
        .update(payload)
        .eq('id', editingId)
        .select('*')
        .single();
      if (updateError) return;
      data = updated;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('roster')
      .insert({ ...payload, team_id: teamId, user_id: userId })
      .select('*')
      .single();
      if (insertError) return;
      data = inserted;
    }
    const nextRoster = roster
      .map((player) => (player.id === editingId ? { ...player, ...form, id: data.id } : player))
      .concat(editingId ? [] : [{ ...form, id: data.id, photoUrl: '', photoPath: data.photo_path || '' }]);
    setRoster(nextRoster);
    resetForm();
    onDataUpdated?.();
  };

  const deletePlayer = async (playerId) => {
    if (!(await confirmAction('Delete this player?'))) return;
    const currentPlayer = roster.find((player) => player.id === playerId);
    const { error: deleteError } = await supabase.from('roster').delete().eq('id', playerId);
    if (deleteError) {
      toast('Failed to delete player.', 'error');
      return;
    }
    if (currentPlayer?.photoPath) {
      await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([currentPlayer.photoPath]);
    }
    setRoster(roster.filter((player) => player.id !== playerId));
    onDataUpdated?.();
    toast('Player deleted.', 'success');
  };

  const uploadPhoto = async (playerId, file) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WEBP image.');
      return;
    }
    const ext = file.name.split('.').pop();
    const path = `${userId}/${teamId}/${playerId}.${ext}`;
    const currentPlayer = roster.find((player) => player.id === playerId);
    const previousPath = currentPlayer?.photoPath;
    if (previousPath && previousPath !== path) {
      await supabase.storage.from(PLAYER_PHOTO_BUCKET).remove([previousPath]);
    }

    const { error: uploadError } = await supabase.storage.from(PLAYER_PHOTO_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type
    });
    if (uploadError) {
      setError(`Photo upload failed: ${uploadError.message}`);
      return;
    }
    const { data: signedData, error: signedError } = await supabase.storage
      .from(PLAYER_PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (signedError) {
      setError(`Photo access failed: ${signedError.message}`);
      return;
    }
    const { error: updateError } = await supabase
      .from('roster')
      .update({ photo_path: path, photo_url: null })
      .eq('id', playerId);
    if (updateError) {
      setError(`Photo save failed: ${updateError.message}`);
      return;
    }
    setRoster(
      roster.map((player) =>
        player.id === playerId
          ? { ...player, photoUrl: signedData?.signedUrl || '', photoPath: path }
          : player
      )
    );
    toast('Photo uploaded.', 'success');
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
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
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
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Height (cm)"
              value={form.heightCm}
              onChange={(event) => setForm({ ...form, heightCm: event.target.value })}
            />
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Weight (kg)"
              value={form.weightKg}
              onChange={(event) => setForm({ ...form, weightKg: event.target.value })}
            />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.dominantHand}
              onChange={(event) => setForm({ ...form, dominantHand: event.target.value })}
              title={showTooltips ? ROSTER_TOOLTIPS.dominantHand : undefined}
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
