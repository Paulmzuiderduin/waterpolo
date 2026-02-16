export const formatShotTime = () => '7:00';

export const normalizeTime = (value) => {
  if (!value) return '7:00';
  const parts = value.split(':');
  const minutes = Math.min(7, Math.max(0, Number(parts[0] || 0)));
  const seconds = Math.min(59, Math.max(0, Number(parts[1] || 0)));
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const splitTimeParts = (value) => {
  const normalized = normalizeTime(value);
  const [min, sec] = normalized.split(':');
  return { minutes: Number(min), seconds: Number(sec) };
};

export const timeToSeconds = (value) => {
  const normalized = normalizeTime(value);
  const [min, sec] = normalized.split(':').map(Number);
  return min * 60 + sec;
};

export const computeAge = (birthday) => {
  if (!birthday) return null;
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
};
