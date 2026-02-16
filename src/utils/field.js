export const VIRIDIS = ['#440154', '#46327e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#a0da39', '#fde725'];

export const detectZone = (x, y, zones) => {
  if (x >= 80 && y >= 75) return 14;
  for (const zone of zones) {
    if (zone.id === 14) continue;
    if (x >= zone.left && x <= zone.left + zone.width && y >= zone.top && y <= zone.top + zone.height) {
      return zone.id;
    }
  }
  return null;
};

export const distanceMeters = (shot, fieldWidth = 15, fieldHeight = 12.5) => {
  const x = (shot.x / 100) * fieldWidth;
  const y = (shot.y / 100) * fieldHeight;
  return Math.sqrt((x - 7.5) ** 2 + y ** 2);
};

export const penaltyPosition = (index, zones) => {
  const colCount = 3;
  const col = index % colCount;
  const row = Math.floor(index / colCount);
  const zone = zones.find((z) => z.id === 14);
  const cellWidth = zone.width / colCount;
  const cellHeight = zone.height / 4;
  return {
    x: zone.left + cellWidth * col + cellWidth / 2,
    y: zone.top + cellHeight * row + cellHeight / 2
  };
};

export const valueToColor = (value, max, scheme) => {
  if (value == null || max === 0) return 'rgba(255,255,255,0)';
  const ratio = Math.min(value / max, 1);
  if (scheme === 'viridis' || scheme === 'viridisReverse') {
    const palette = scheme === 'viridisReverse' ? [...VIRIDIS].reverse() : VIRIDIS;
    const idx = ratio * (palette.length - 1);
    const low = Math.floor(idx);
    const high = Math.min(palette.length - 1, low + 1);
    const t = idx - low;
    const hexToRgb = (hex) => {
      const res = hex.replace('#', '');
      const num = parseInt(res, 16);
      return [num >> 16, (num >> 8) & 255, num & 255];
    };
    const [r1, g1, b1] = hexToRgb(palette[low]);
    const [r2, g2, b2] = hexToRgb(palette[high]);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgba(${r}, ${g}, ${b}, 0.5)`;
  }
  return 'rgba(255,255,255,0)';
};
