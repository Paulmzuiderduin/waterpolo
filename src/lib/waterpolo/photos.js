import { supabase } from '../supabase';

export const PLAYER_PHOTO_BUCKET = 'player-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export const inferPhotoPath = (player) => {
  if (player?.photo_path) return player.photo_path;
  const rawUrl = player?.photo_url;
  if (!rawUrl) return '';

  try {
    const url = new URL(rawUrl);
    const marker = '/object/public/player-photos/';
    const index = url.pathname.indexOf(marker);
    if (index >= 0) {
      return decodeURIComponent(url.pathname.slice(index + marker.length));
    }
  } catch {
    // Fall back to loose parsing below.
  }

  const fallback = rawUrl.split('player-photos/')[1];
  return fallback ? decodeURIComponent(fallback.split('?')[0]) : '';
};

export const withSignedRosterPhotos = async (players) => {
  const rows = players || [];
  const signedMap = new Map();

  const uniquePaths = Array.from(
    new Set(
      rows
        .map((player) => inferPhotoPath(player))
        .filter(Boolean)
    )
  );

  await Promise.all(
    uniquePaths.map(async (path) => {
      const { data, error } = await supabase.storage
        .from(PLAYER_PHOTO_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (!error && data?.signedUrl) {
        signedMap.set(path, data.signedUrl);
      }
    })
  );

  return rows.map((player) => {
    const photoPath = inferPhotoPath(player);
    return {
      ...player,
      photo_path: photoPath,
      photo_url: signedMap.get(photoPath) || ''
    };
  });
};
